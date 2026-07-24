const { db } = require('./db')

async function ensureUser(appInstance) {
  const app = appInstance || getApp({ allowDefault: true }) || getApp() || {}

  if (app.globalData && app.globalData.userInfo && app.globalData.openid) {
    return app.globalData.userInfo
  }

  try {
    const res = await wx.cloud.callFunction({ name: 'user' })
    const { code, data } = res.result

    if (code !== 0) {
      console.error('ensureUser 失败:', res.result.message)
      return null
    }

    if (!app.globalData) app.globalData = {}
    app.globalData.openid = data._openid
    app.globalData.userInfo = data
    app.globalData.points = data.points || 0
    app.globalData.memberLevel = data.memberLevel || '普通会员'

    return data
  } catch (err) {
    console.error('ensureUser 异常:', err)
    return null
  }
}

async function updateUserInfo(userInfo) {
  const app = getApp()

  try {
    const openid = app.globalData.openid
    if (!openid) {
      await ensureUser()
    }

    await db.collection('users').where({
      _openid: app.globalData.openid
    }).update({
      data: {
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        updatedAt: db.serverDate()
      }
    })

    if (app.globalData.userInfo) {
      app.globalData.userInfo.nickName = userInfo.nickName
      app.globalData.userInfo.avatarUrl = userInfo.avatarUrl
    }

    return true
  } catch (err) {
    console.error('updateUserInfo 失败:', err)
    return false
  }
}

module.exports = { ensureUser, updateUserInfo }
