/**
 * 云函数统一调用封装（微信小程序 + Donut H5/App 多端兼容）
 *
 * 调用方式：
 *   const { requestCloud } = require('../../utils/cloudRequest')
 *   const data = await requestCloud('getUser', 'get', {}, { showLoading: true })
 *
 * ★ Donut 多端（H5/App）特别处理：
 *   1. callFunction 前先等待 CloudBase Web SDK 匿名登录就绪 Promise（避免 -601002 INVALID_CREDENTIAL）
 *   2. -601002 单独给「请刷新页面/重启 App」的提示（= Web SDK 身份凭证无效，刷新通常能好）
 *   3. 所有请求自动注入 __visitorId / 本地资料摘要（写入归属 + C 规则展示用）
 */

// Donut H5/App：安全获取平台判断（不要在顶层 require platform.js，避免极端时序报错）
function _safeIsMiniprogram() {
  try {
    const p = require('./platform')
    if (p && typeof p.isMiniprogram === 'function') return p.isMiniprogram()
  } catch (_) {}
  // 兜底：Donut 端一定会有 wx.donut 对象
  const hasDonut = typeof wx === 'object' && !!wx && typeof wx.donut === 'object' && !!wx.donut
  return !hasDonut
}

async function _waitCloudWebSdkReady() {
  if (_safeIsMiniprogram()) return true
  try {
    const app = typeof getApp === 'function' ? getApp() : null
    if (app && typeof app.getCloudWebSdkReady === 'function') {
      return await Promise.race([
        app.getCloudWebSdkReady(),
        new Promise((resolve) => setTimeout(() => resolve(true), 4000)) // 最多等 4s，不阻塞
      ])
    }
  } catch (_) {}
  return true
}

// 从错误对象/字符串里把 errCode（如 -601002）抠出来，-601002 = CloudBase INVALID_CREDENTIAL
function _extractErrCode(err) {
  if (!err) return null
  if (typeof err.errCode === 'number') return err.errCode
  if (typeof err === 'number') return err
  const s = typeof err.message === 'string' ? err.message : String(err)
  const m = s.match(/errCode[:：\s]*(-?\d{3,8})/)
  return m ? Number(m[1]) : null
}

async function requestCloud(name, action, data = {}, config = {}) {
  const { showLoading = false, loadingText = '加载中...', throwError = true, timeout } = config

  if (showLoading) {
    try { wx.showLoading({ title: loadingText, mask: true }) } catch (_) {}
  }

  try {
    // 访客身份模式：所有云函数调用自动注入 visitorId + 本地资料摘要（仅用于写入归属）
    let injectedExtra = {}
    try {
      const v = require('./visitor')
      if (v && typeof v.getVisitorId === 'function') {
        injectedExtra.__visitorId = v.getVisitorId()
        const lp = v.getLocalProfile()
        injectedExtra.__visitorProfileNick = lp.nickName
        injectedExtra.__visitorProfileAvatar = lp.avatarUrl
      }
    } catch (e) {}

    // ★ Donut H5/App 端：等 CloudBase Web SDK 匿名登录预热完成再发请求
    //    （小程序端此函数是同步返回 true，零开销）
    await _waitCloudWebSdkReady()

    if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
      throw new Error('wx.cloud 未初始化成功，请重启小程序或刷新页面后重试')
    }

    const res = await wx.cloud.callFunction({
      name,
      data: { action, ...data, ...injectedExtra },
      timeout
    })

    if (showLoading) try { wx.hideLoading() } catch (_) {}

    if (res.result && res.result.code === 0) {
      return res.result.data
    } else {
      const errMsg = (res.result && res.result.message) ? res.result.message : '请求失败'
      if (throwError) {
        try { wx.showToast({ title: errMsg, icon: 'none' }) } catch (_) {}
        throw new Error(errMsg)
      }
      return null
    }
  } catch (err) {
    if (showLoading) try { wx.hideLoading() } catch (_) {}
    const code = _extractErrCode(err)
    const errText = (err && err.message) ? err.message : String(err || '未知错误')
    console.error(`Cloud API [${name}/${action}] Error: code=${code}`, err)

    // ★ 单独处理：-601002 INVALID_CREDENTIAL（Donut 端 CloudBase Web SDK 凭证无效）
    if (code === -601002) {
      const tip = '服务身份未就绪，请刷新页面或重启 App 后重试（-601002）'
      if (throwError) {
        try { wx.showToast({ title: tip, icon: 'none', duration: 2800 }) } catch (_) {}
        const err2 = new Error(tip)
        err2.errCode = -601002
        err2.isInvalidCredential = true
        throw err2
      }
      return null
    }

    // 常见网络类错误：给出更清晰的通用提示
    const isNetworkErr =
      /timeout|network|offline|abort|failed to fetch|net::/i.test(errText) ||
      typeof wx.getNetworkType !== 'function'
    if (throwError) {
      try {
        wx.showToast({
          title: isNetworkErr ? '网络不稳定，请稍后重试' : '网络或服务异常',
          icon: 'none',
          duration: 2200
        })
      } catch (_) {}
      throw err
    }
    return null
  }
}

module.exports = { requestCloud }
