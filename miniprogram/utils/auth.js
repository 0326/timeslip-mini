const { storage } = require('./storage')

async function ensureUser(appInstance) {
  const app = appInstance || getApp({ allowDefault: true }) || getApp() || {}

  if (app.globalData && app.globalData.userInfo && app.globalData.openid) {
    return app.globalData.userInfo
  }

  try {
    const res = await wx.cloud.callFunction({
      name: 'getUser',
      data: { action: 'ensure' }
    })
    const { code, data } = res.result || {}

    if (code !== 0) {
      console.error('ensureUser 失败:', (res.result && res.result.message) || '未知错误')
      return null
    }

    if (!app.globalData) app.globalData = {}
    app.globalData.openid = data._openid
    app.globalData.userInfo = data
    app.globalData.points = data.points || 0
    app.globalData.memberLevel = data.memberLevel || '普通会员'
    app.globalData.ancientName = data.ancientName || ''
    app.globalData.crossNo = data.crossNo || ''

    storage.set('userInfo', data, 3600)
    return data
  } catch (err) {
    console.error('ensureUser 异常:', err)
    const cached = storage.get('userInfo')
    if (cached && app.globalData) {
      app.globalData.openid = cached._openid || ''
      app.globalData.userInfo = cached
    }
    return cached || null
  }
}

async function updateUserInfo(userInfo) {
  const app = getApp()

  try {
    if (!app.globalData || !app.globalData.openid) {
      await ensureUser()
    }

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

module.exports = { ensureUser, updateUserInfo }
