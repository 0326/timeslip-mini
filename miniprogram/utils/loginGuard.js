const { storage } = require('./storage')
const { isTemporaryFileUrl } = require('./helpers')

const LOGIN_PAGE = '/pages/login/index'

// tabBar 页面列表（switchTab 不能带参数）
const TAB_PAGES = [
  'pages/chat/index',
  'pages/lantai/index',
  'pages/discover/index',
  'pages/profile/index'
]

function isOnLoginPage() {
  try {
    const pages = getCurrentPages()
    const top = pages[pages.length - 1]
    return top && top.route === 'pages/login/index'
  } catch (e) {
    return false
  }
}

function isLoggedIn() {
  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.userInfo && app.globalData.openid) {
      const avatarUrl = app.globalData.userInfo.avatarUrl
      return !!(avatarUrl && !isTemporaryFileUrl(avatarUrl))
    }
  } catch (e) {}
  const cached = storage.get('userInfo')
  return !!(cached && cached._openid && cached.avatarUrl && !isTemporaryFileUrl(cached.avatarUrl))
}

function isAdmin() {
  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.userInfo) {
      const role = app.globalData.userInfo.role
      if (role === 'admin') return true
    }
  } catch (e) {}
  try {
    const cached = storage.get('userInfo')
    return !!(cached && cached.role === 'admin')
  } catch (e) {}
  return false
}

function requireAdmin(pageInst) {
  if (!isLoggedIn()) {
    wx.redirectTo({ url: LOGIN_PAGE })
    return false
  }
  if (!isAdmin()) {
    wx.showToast({ title: '无权限访问', icon: 'none' })
    setTimeout(() => {
      wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/profile/index' }) })
    }, 800)
    return false
  }
  return true
}

function getCurrentPageUrl() {
  try {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (!page) return ''
    let url = '/' + page.route
    if (page.options) {
      const query = Object.keys(page.options)
        .map(k => `${k}=${encodeURIComponent(page.options[k])}`)
        .join('&')
      if (query) url += '?' + query
    }
    return url
  } catch (e) {
    return ''
  }
}

function isTabPage(url) {
  return TAB_PAGES.some(p => url.indexOf(p) !== -1)
}

// 拦截：未登录则跳转到 login 页
// needLogin: 是否强制需要登录（默认 true）
function checkLogin(pageInst, needLogin = true) {
  if (isOnLoginPage()) return true
  if (isLoggedIn()) return true
  const currentUrl = getCurrentPageUrl()
  let redirect = ''
  if (currentUrl) {
    if (isTabPage(currentUrl)) {
      redirect = 'tab:' + '/' + currentUrl.replace('/', '')
    } else {
      redirect = currentUrl
    }
    redirect = encodeURIComponent(redirect)
  }
  const loginUrl = LOGIN_PAGE + '?needLogin=' + (needLogin ? 'true' : 'false') + (redirect ? '&redirect=' + redirect : '')
  wx.reLaunch({ url: loginUrl })
  return false
}

module.exports = {
  checkLogin,
  isLoggedIn,
  isAdmin,
  requireAdmin,
  isOnLoginPage,
  LOGIN_PAGE
}
