const { storage } = require('./storage')

const LOGIN_PAGE = '/pages/login/index'

// 当前页面栈中是否已有 login 页，避免重复跳转
function isOnLoginPage() {
  try {
    const pages = getCurrentPages()
    const top = pages[pages.length - 1]
    return top && top.route === 'pages/login/index'
  } catch (e) {
    return false
  }
}

// 是否已登录：globalData.userInfo 优先，回退 storage
function isLoggedIn() {
  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.userInfo && app.globalData.openid) {
      return true
    }
  } catch (e) {}
  const cached = storage.get('userInfo')
  return !!(cached && cached._openid)
}

// 拦截：未登录则跳转到 login 页
// 传入 pageInst 仅用于规避 login 页自身调用时的循环
function checkLogin(pageInst) {
  if (isOnLoginPage()) return true
  if (isLoggedIn()) return true
  wx.reLaunch({ url: LOGIN_PAGE })
  return false
}

module.exports = {
  checkLogin,
  isLoggedIn,
  isOnLoginPage,
  LOGIN_PAGE
}
