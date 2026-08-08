/**
 * 多端环境检测工具（微信官方 Donut 多端框架兼容层）
 *
 * 统一封装小程序 / Donut App / Donut H5 的判断，
 * 避免页面和组件里散落各种 typeof wx.xxx 判断。
 *
 * 用法：
 *   const {
 *     isMiniprogram, isDonutApp, isH5, getPlatform,
 *     canIUseChooseAvatar, canIUseSubscribeMessage, canIUseShareMenu
 *   } = require('../../utils/platform')
 */

let _cached = null

function _detect() {
  let sys = {}
  try {
    if (typeof wx.getSystemInfoSync === 'function') sys = wx.getSystemInfoSync() || {}
  } catch (e) { sys = {} }
  const platform = (sys.platform || '').toLowerCase()
  const envVersion = (sys.envVersion || '').toLowerCase()

  // Donut 特有 API：wx.donut.getPlatform() 返回 'web' | 'android' | 'ios' 等
  const hasDonutApi = typeof wx.donut === 'object' && !!wx.donut
  const donutPlatform = hasDonutApi && typeof wx.donut.getPlatform === 'function'
    ? String(wx.donut.getPlatform() || '').toLowerCase()
    : ''

  // H5（Donut 编译产物）
  if (donutPlatform === 'web' || platform === 'h5') {
    return { name: 'h5', tag: 'donut-h5' }
  }
  // 原生 App（Donut 编译产物）
  if (donutPlatform === 'android' || donutPlatform === 'ios') {
    return { name: 'app', tag: 'donut-app' }
  }
  // 微信小程序宿主：有 envVersion（develop/trial/release）或宿主特征
  if (envVersion === 'develop' || envVersion === 'trial' || envVersion === 'release') {
    return { name: 'miniprogram', tag: 'miniprogram' }
  }
  // 兜底：如果 getUpdateManager 存在（小程序 API）且不是 Donut 宿主，视为小程序
  if (typeof wx.getUpdateManager === 'function' && !hasDonutApi) {
    return { name: 'miniprogram', tag: 'miniprogram' }
  }
  return { name: 'unknown', tag: 'unknown' }
}

function _ensure() {
  if (!_cached) _cached = _detect()
  return _cached
}

function getPlatform()     { return _ensure().name }
function getPlatformTag()  { return _ensure().tag }
function isMiniprogram()   { return _ensure().name === 'miniprogram' }
function isDonutApp()      { return _ensure().name === 'app' }
function isH5()            { return _ensure().name === 'h5' }

/* ---------- 能力检测（按平台退化） ---------- */

// wx.chooseAvatar / open-type="chooseAvatar" 仅微信小程序端
function canIUseChooseAvatar() {
  return isMiniprogram() && typeof wx.chooseAvatar !== 'undefined'
}
// 订阅消息模板仅微信小程序端
function canIUseSubscribeMessage() {
  return isMiniprogram() && typeof wx.requestSubscribeMessage === 'function'
}
// showShareMenu 仅微信小程序端（Donut 端走系统分享）
function canIUseShareMenu() {
  return isMiniprogram() && typeof wx.showShareMenu === 'function'
}

module.exports = {
  getPlatform,
  getPlatformTag,
  isMiniprogram,
  isDonutApp,
  isH5,
  canIUseChooseAvatar,
  canIUseSubscribeMessage,
  canIUseShareMenu
}
