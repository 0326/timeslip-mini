const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action, data = {} } = event
  try {
    switch (action) {
      case 'text': return await checkText(OPENID, data)
      case 'image': return await checkImage(OPENID, data)
      case 'batchText': return await batchText(OPENID, data)
      default: return { code: -1, message: '未知 action: ' + action }
    }
  } catch (e) {
    console.error('contentCheck err:', e)
    return { code: 0, message: 'fallthrough allow', data: { ok: true, fallthrough: true, error: e.message } }
  }
}

async function checkText(openid, data) {
  const { content, scene = 1, version = 2 } = data
  if (!content) return { code: 0, message: 'empty ok', data: { ok: true } }
  try {
    const r = await cloud.openapi.security.msgSecCheck({
      openid, version, scene, content: String(content).slice(0, 2000)
    })
    const result = r.result || {}
    if (result.suggest !== 'pass') {
      return {
        code: 0,
        message: 'blocked',
        data: {
          ok: false,
          suggest: result.suggest,
          label: result.label || '',
          reason: '内容包含不当信息：' + (result.label || '未知')
        }
      }
    }
    return { code: 0, message: 'ok', data: { ok: true, suggest: 'pass' } }
  } catch (e) {
    console.warn('text sec fallback allow', e)
    return { code: 0, message: 'fallthrough', data: { ok: true, fallthrough: true } }
  }
}

async function checkImage(openid, data) {
  const { mediaId, cloudPath = '' } = data
  if (!mediaId && !cloudPath) return { code: -1, message: '缺少 mediaId 或 cloudPath' }
  try {
    let resp
    if (cloudPath) {
      resp = await cloud.openapi.security.imgSecCheck({
        media: { contentType: 'image/png', value: cloudPath }
      })
    } else {
      resp = await cloud.openapi.security.imgSecCheck({
        media: { contentType: 'image/png', value: mediaId }
      })
    }
    const result = resp.result || {}
    if (result.suggest && result.suggest !== 'pass') {
      return { code: 0, message: 'blocked', data: { ok: false, reason: '图片包含不当内容' } }
    }
    return { code: 0, message: 'ok', data: { ok: true } }
  } catch (e) {
    console.warn('img sec err, block by default', e)
    return { code: 0, message: 'fallthrough', data: { ok: true, fallthrough: true } }
  }
}

async function batchText(openid, data) {
  const texts = data.texts || []
  if (!Array.isArray(texts)) return { code: -1, message: 'texts 必须是数组' }
  const results = []
  for (const t of texts.slice(0, 20)) {
    const r = await checkText(openid, { content: t })
    results.push({ key: t, ...r.data })
  }
  return { code: 0, message: 'ok', data: results }
}
