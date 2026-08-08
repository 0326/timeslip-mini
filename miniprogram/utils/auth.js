const { storage } = require('./storage')
const { requestCloud } = require('./cloudRequest')
const { isTemporaryFileUrl } = require('./helpers')
const { getVisitorId, getLocalProfile, afterBindWx } = require('./visitor')

// 登录：使用前端采集的 nickName + avatarUrl 创建/更新用户（绑定微信身份）
// 绑定成功后自动调用 bindVisitor：将 visitor 模式下写入云端的所有数据迁移到新 OPENID 下
//
// 兼容三种调用方式：
//   1) 显式传参：login(nickName, avatarUrl)      — 传统方式
//   2) 只传对象：login({ nickName, avatarUrl })  — 对象方式
//   3) 无参数调用：login()                      — 自动兜底，优先用本地 visitor profile，其次用默认值「穿越客+微信头像占位」
async function login(arg1, arg2) {
  let nickName = ''
  let avatarUrl = ''
  if (typeof arg1 === 'string') {
    nickName = arg1
    avatarUrl = arg2 || ''
  } else if (arg1 && typeof arg1 === 'object') {
    nickName = arg1.nickName || ''
    avatarUrl = arg1.avatarUrl || ''
  }
  // 兜底：未传昵称头像 → 用本地访客 profile（用户自己填过的优先复用）
  if (!nickName || !avatarUrl) {
    try {
      const lp = getLocalProfile()
      if (!nickName && lp && lp.nickName) nickName = lp.nickName
      if (!avatarUrl && lp && lp.avatarUrl) avatarUrl = lp.avatarUrl
    } catch (_) {}
  }
  // 再兜底：还是空就用默认值
  if (!nickName) nickName = '穿越客'
  if (!avatarUrl) avatarUrl = '/images/logo-256.png'

  const app = getApp()
  try {
    const curVisitorId = getVisitorId()
    const res = await wx.cloud.callFunction({
      name: 'getUser',
      data: { action: 'login', nickName, avatarUrl, __visitorId: curVisitorId }
    })
    const { code, data, message } = res.result || {}
    if (code !== 0 || !data) {
      // 兼容两种使用方式：1) 解构 const { ok, data } = await login() 2) if (!user) 判定
      return null
    }

    if (!app.globalData) app.globalData = {}
    app.globalData.openid = data._openid
    app.globalData.userInfo = data
    app.globalData.points = data.points || 0
    app.globalData.memberLevel = data.memberLevel || '普通会员'
    app.globalData.crossNo = data.crossNo || ''

    storage.set('userInfo', data, 86400)

    // 关键：绑定成功后，将此前 visitor 模式写入的所有云端数据一次性迁移到当前 OPENID
    let migratedCount = 0
    try {
      if (curVisitorId && typeof curVisitorId === 'string' && curVisitorId.length >= 8) {
        const migrateRes = await wx.cloud.callFunction({
          name: 'getUser',
          data: { action: 'bindVisitor', visitorId: curVisitorId }
        })
        if (migrateRes && migrateRes.result && migrateRes.result.code === 0) {
          migratedCount = (migrateRes.result.data && migrateRes.result.data.totalCount) || 0
        }
      }
    } catch (mErr) {
      console.warn('[auth.login] bindVisitor 数据迁移失败（不影响登录本身）：', mErr && mErr.message)
    }

    afterBindWx()
    if (app.emitUserUpdate) app.emitUserUpdate(data)
    // 返回：1) 主返回值 = 用户对象（用于 if (!user) 判断）2) 附加字段 ok/isNewUser/migratedCount 供解构使用
    data.ok = true
    data.isNewUser = !!(res && res.result && res.result.isNewUser)
    data.migratedCount = migratedCount
    return data
  } catch (err) {
    console.error('login 异常:', err)
    return null
  }
}

// 查询当前用户信息（只查询，不创建）
async function getUserInfo() {
  try {
    const data = await requestCloud('getUser', 'get', {}, { throwError: false })
    return data || null
  } catch (e) {
    return null
  }
}

// 从缓存恢复用户态（不触发云函数），返回是否恢复成功
// 访客模式：优先恢复已绑定微信的 userInfo；否则恢复 visitor 身份 + 本地资料
// 返回值：
//   true  = 已恢复到「已绑定微信」身份
//   false = 没有绑定微信，但已保证 globalData.visitorId / localProfile 至少可用
function restoreFromCache() {
  try {
    const app = getApp()
    if (!app.globalData) app.globalData = {}

    // 1) 优先恢复已绑定微信的身份（正常登录过的用户）
    if (app.globalData.userInfo && app.globalData.openid) return true
    const cached = storage.get('userInfo')
    if (cached) {
      const primaryId =
        cached._openid ||
        cached.unionid ||
        cached.unionId ||
        cached.__donutUserOpenid ||
        ''
      const hasValidIdentity = !!(primaryId || cached._id)
      if (hasValidIdentity && cached.avatarUrl && !isTemporaryFileUrl(cached.avatarUrl)) {
        if (primaryId) app.globalData.openid = primaryId
        if (cached.unionid || cached.unionId) app.globalData.unionid = cached.unionid || cached.unionId
        app.globalData.userInfo = cached
        app.globalData.points = cached.points || 0
        app.globalData.memberLevel = cached.memberLevel || '普通会员'
        app.globalData.crossNo = cached.crossNo || ''
        return true
      }
    }

    // 2) 访客模式：未绑定微信，生成/恢复 visitorId + 本地资料（保证全局变量不为空）
    const vid = getVisitorId()
    const lp = getLocalProfile()
    app.globalData.visitorId = vid
    app.globalData.localProfile = lp
    app.globalData.isBoundWx = !!app.globalData.openid
    // 给需要 userInfo 的代码一个 visitor 包装对象（纯本地展示用）
    if (!app.globalData.userInfo) {
      app.globalData.userInfo = {
        _id: '',
        _openid: '',
        nickName: lp.nickName,
        avatarUrl: lp.avatarUrl,
        role: 'visitor',
        crossNo: '',
        points: 0,
        memberLevel: '游客',
        createdAt: new Date().getTime(),
        isVisitor: true
      }
    }
    return false
  } catch (e) {
    console.warn('restoreFromCache fallback to visitor:', e && e.message)
    // 兜底：保证 visitorId 可用
    try {
      const app2 = getApp()
      if (app2 && !app2.globalData) app2.globalData = {}
      if (app2 && !app2.globalData.visitorId) app2.globalData.visitorId = getVisitorId()
    } catch (_) {}
    return false
  }
}

/**
 * 返回当前用户用于界面展示的身份信息（已绑定微信 or 访客本地资料）
 * 页面应该统一使用这个函数而不是直接读 globalData.userInfo，避免访客模式空值
 */
function getDisplayUser() {
  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.openid && app.globalData.userInfo && !app.globalData.userInfo.isVisitor) {
      return app.globalData.userInfo
    }
    const lp = getLocalProfile()
    const vid = getVisitorId()
    return {
      _id: '',
      _openid: '',
      nickName: lp.nickName,
      avatarUrl: lp.avatarUrl,
      role: 'visitor',
      crossNo: '',
      points: 0,
      memberLevel: '游客',
      isVisitor: true,
      visitorId: vid
    }
  } catch (e) {
    const lp = getLocalProfile()
    return { nickName: lp.nickName, avatarUrl: lp.avatarUrl, isVisitor: true }
  }
}

/**
 * 是否已绑定微信身份（visitor 模式返回 false）
 */
function isBoundWx() {
  try {
    const app = getApp()
    if (!app || !app.globalData) return false
    if (app.globalData.userInfo && app.globalData.userInfo.isVisitor) return false
    return !!(app.globalData.openid && app.globalData.userInfo)
  } catch (e) {
    return false
  }
}

// 清除登录态（数据库查不到用户时调用）
function clearLoginState() {
  try {
    storage.remove('userInfo')
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.userInfo = null
      app.globalData.openid = ''
      app.globalData.points = 0
      app.globalData.crossNo = ''
    }
  } catch (e) {}
}

async function updateUserInfo(userInfo) {
  const app = getApp()
  try {
    const res = await wx.cloud.callFunction({
      name: 'getUser',
      data: { action: 'update', ...userInfo }
    })

    if (res.result && res.result.code === 0) {
      if (app.globalData.userInfo) {
        Object.assign(app.globalData.userInfo, userInfo)
      }
      storage.set('userInfo', app.globalData.userInfo, 3600)
      if (app.emitUserUpdate) app.emitUserUpdate(app.globalData.userInfo)
      return true
    }
    return false
  } catch (err) {
    console.error('updateUserInfo 失败:', err)
    return false
  }
}

// 退出登录：清缓存与 globalData
function logout() {
  clearLoginState()
}

module.exports = {
  login,
  getUserInfo,
  restoreFromCache,
  clearLoginState,
  updateUserInfo,
  logout,
  getDisplayUser,
  isBoundWx
}
