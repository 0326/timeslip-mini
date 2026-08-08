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

/**
 * 已绑定微信身份（真实登录）
 */
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

/**
 * 有身份即可（已绑定微信 OR 有本地 visitorId 都算）
 * 用于所有原本用 checkLogin 拦截的页面：访客身份直接放行
 */
function hasIdentity() {
  if (isLoggedIn()) return true
  try {
    const v = require('./visitor')
    if (v && typeof v.getVisitorId === 'function') {
      const id = v.getVisitorId()
      return !!(id && typeof id === 'string' && id.length >= 8)
    }
  } catch (e) {}
  return false
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

/**
 * 页面级身份检查（现在 visitor 身份也算有效，不再强制跳登录页）
 *
 * 新语义：
 * - 99% 的页面应该调用 hasIdentity() 而不再需要 checkLogin
 * - 只有明确「必须绑定微信身份」才能做的事情（比如进 admin 后台、付费），才用 requireLogin
 * - checkLogin 保留作为兼容别名，但内部改为只要有 visitorId 就放行，不再跳登录
 */
function checkLogin(pageInst /*, needLogin = true */) {
  // 兼容旧代码：只要有身份（微信绑定 或 visitor）就放行
  if (isOnLoginPage()) return true
  if (hasIdentity()) return true
  // 极端兜底：理论上不会走到这里（visitorId 首次启动就生成），如果真没身份就静默生成一个
  try {
    const v = require('./visitor')
    if (v && typeof v.getVisitorId === 'function') {
      v.getVisitorId() // 副作用：不存在就创建一个
      return true
    }
  } catch (e) {}
  return true // 全部放行，不做任何跳转
}

// 真正需要强制绑定微信身份时才用（例如管理员后台之外的特殊操作）
function requireLogin(redirectAfterLogin) {
  if (isLoggedIn()) return true
  const currentUrl = typeof redirectAfterLogin === 'string' && redirectAfterLogin
    ? redirectAfterLogin
    : getCurrentPageUrl()
  let redirect = ''
  if (currentUrl) {
    if (isTabPage(currentUrl)) {
      redirect = 'tab:' + '/' + currentUrl.replace(/^\//, '')
    } else {
      redirect = currentUrl
    }
    redirect = encodeURIComponent(redirect)
  }
  const loginUrl = LOGIN_PAGE + '?needLogin=true' + (redirect ? '&redirect=' + redirect : '')
  wx.reLaunch({ url: loginUrl })
  return false
}

module.exports = {
  checkLogin,          // 兼容旧调用：Visitor 也算有效（永远返回 true，不跳登录）
  requireLogin,        // 新：强制需要微信绑定身份（真正跳登录）
  hasIdentity,         // 新：有 visitorId 或已绑定微信都算
  isLoggedIn,          // 原语义不变：仅 true 表示「已绑定微信」
  isAdmin,
  requireAdmin,
  isOnLoginPage,
  LOGIN_PAGE
}
