const { storage } = require('./storage')
const { requestCloud } = require('./cloudRequest')

// 登录：使用前端采集的 nickName + avatarUrl 创建/更新用户
async function login(nickName, avatarUrl) {
  const app = getApp()
  try {
    const res = await wx.cloud.callFunction({
      name: 'getUser',
      data: { action: 'login', nickName, avatarUrl }
    })
    const { code, data, message } = res.result || {}
    if (code !== 0 || !data) {
      return { ok: false, message: message || '登录失败' }
    }

    if (!app.globalData) app.globalData = {}
    app.globalData.openid = data._openid
    app.globalData.userInfo = data
    app.globalData.points = data.points || 0
    app.globalData.memberLevel = data.memberLevel || '普通会员'
    app.globalData.crossNo = data.crossNo || ''

    storage.set('userInfo', data, 3600)
    if (app.emitUserUpdate) app.emitUserUpdate(data)
    return { ok: true, data, isNewUser: res.result.isNewUser }
  } catch (err) {
    console.error('login 异常:', err)
    return { ok: false, message: '网络或服务异常' }
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
function restoreFromCache() {
  try {
    const app = getApp()
    if (!app.globalData) app.globalData = {}
    if (app.globalData.userInfo && app.globalData.openid) return true

    const cached = storage.get('userInfo')
    if (cached && cached._openid) {
      app.globalData.openid = cached._openid
      app.globalData.userInfo = cached
      app.globalData.points = cached.points || 0
      app.globalData.memberLevel = cached.memberLevel || '普通会员'
      app.globalData.crossNo = cached.crossNo || ''
      return true
    }
    return false
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

module.exports = { login, getUserInfo, restoreFromCache, clearLoginState, updateUserInfo, logout }
