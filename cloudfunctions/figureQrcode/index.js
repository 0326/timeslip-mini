const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const QRCODE_DIR = 'mini-assets/qrcode'
const CACHE_COLLECTION = 'qrcode_cache'
const TOKEN_COLLECTION = 'access_token_cache'
const MAX_SCENE_LEN = 32

function resolveEnvVersion(input) {
  const v = String(input || process.env.QRCODE_ENV_VERSION || 'release')
  if (v === 'trial' || v === 'develop' || v === 'release') return v
  return 'release'
}

function fileKey(figureId) {
  return `${QRCODE_DIR}/figure-${figureId}.png`
}

function isHttpGateway(event) {
  return !!(event && event.httpMethod)
}

function wrapResult(result, event) {
  if (isHttpGateway(event)) {
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    }
  }
  return result
}

// ===== HTTP 工具（不依赖 fetch，使用 Node.js 内置 https 模块）=====

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve({ data, statusCode: res.statusCode, headers: res.headers }))
    }).on('error', reject)
  })
}

function httpsPost(url, bodyString) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString)
      }
    }
    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          buffer: Buffer.concat(chunks),
          statusCode: res.statusCode,
          headers: res.headers
        })
      })
    })
    req.on('error', reject)
    req.write(bodyString)
    req.end()
  })
}

// ===== access_token 管理 =====

async function getCachedToken() {
  try {
    const r = await db.collection(TOKEN_COLLECTION).limit(1).get()
    const row = r.data && r.data[0]
    if (!row) return null
    const elapsed = Date.now() - (row.updatedAt || 0)
    if (elapsed < 7000 * 1000) {
      return row.token
    }
    return null
  } catch (e) {
    return null
  }
}

async function setCachedToken(token) {
  try {
    const r = await db.collection(TOKEN_COLLECTION).limit(1).get()
    if (r.data && r.data[0]) {
      await db.collection(TOKEN_COLLECTION).doc(r.data[0]._id).update({
        data: { token, updatedAt: Date.now() }
      })
    } else {
      await db.collection(TOKEN_COLLECTION).add({
        data: { token, updatedAt: Date.now() }
      })
    }
  } catch (e) {
    // 忽略缓存写入失败
  }
}

async function fetchAccessToken() {
  const appId = process.env.WX_APP_ID
  const appSecret = process.env.WX_APP_SECRET
  if (!appId || !appSecret) {
    throw new Error('缺少 WX_APP_ID 或 WX_APP_SECRET 环境变量')
  }
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
  const resp = await httpsGet(url)
  const data = JSON.parse(resp.data)
  if (!data.access_token) {
    throw new Error(`获取 access_token 失败: errcode=${data.errcode} errmsg=${data.errmsg || ''}`)
  }
  return data.access_token
}

async function getAccessToken() {
  const cached = await getCachedToken()
  if (cached) return cached
  const token = await fetchAccessToken()
  await setCachedToken(token)
  return token
}

// ===== 小程序码生成 =====

async function generateUnlimited(scene, page, envVersion) {
  const token = await getAccessToken()
  const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${token}`
  const bodyStr = JSON.stringify({
    scene,
    page,
    env_version: envVersion,
    check_path: false,
    is_hyaline: false,
    width: 430
  })

  const resp = await httpsPost(url, bodyStr)

  // 微信 API 可能返回图片（Buffer）或 JSON 错误
  const contentType = resp.headers['content-type'] || ''
  if (contentType.includes('application/json')) {
    const err = JSON.parse(resp.buffer.toString('utf8'))
    throw new Error(`getwxacodeunlimit API 错误: errcode=${err.errcode} errmsg=${err.errmsg || ''}`)
  }

  // 返回的是图片二进制
  return resp.buffer
}

// ===== 缓存管理 =====

async function getCached(figureId) {
  try {
    const r = await db.collection(CACHE_COLLECTION)
      .where({ figureId })
      .limit(1)
      .get()
    return (r.data && r.data[0]) || null
  } catch (e) {
    return null
  }
}

async function setCached(figureId, fileID) {
  try {
    await db.collection(CACHE_COLLECTION).add({
      data: { figureId, fileID, generatedAt: db.serverDate() }
    })
  } catch (e) {
    // 并发重复写入时忽略
  }
}

async function getTempUrl(fileID) {
  const r = await cloud.getTempFileURL({ fileList: [fileID] })
  const item = r && r.fileList && r.fileList[0]
  if (!item || item.status !== 0) {
    throw new Error('GET_TEMP_URL_FAILED')
  }
  return item.tempFileURL
}

// ===== 主函数 =====

exports.main = async (event) => {
  const figureId = String(
    (event && event.figureId) ||
    (event && event.queryStringParameters && event.queryStringParameters.figureId) ||
    ''
  ).trim()
  if (!figureId) {
    return wrapResult({ code: -1, message: '缺少 figureId' }, event)
  }
  if (figureId.length > MAX_SCENE_LEN) {
    return wrapResult({ code: -1, message: 'figureId 超过 32 字符限制' }, event)
  }

  const page = 'pages/lantai/figure-detail'
  const envVersion = resolveEnvVersion(
    event.envVersion ||
    (event.queryStringParameters && event.queryStringParameters.envVersion)
  )

  // 1. 命中缓存直接取临时 URL
  const cached = await getCached(figureId)
  if (cached && cached.fileID) {
    try {
      const url = await getTempUrl(cached.fileID)
      return wrapResult({ code: 0, message: 'ok', data: { url, fileID: cached.fileID, cached: true } }, event)
    } catch (e) {
      // 缓存文件可能被误删，降级重新生成
    }
  }

  // 2. 生成小程序码
  let buffer
  try {
    buffer = await generateUnlimited(figureId, page, envVersion)
  } catch (e) {
    console.error('[figureQrcode] generateUnlimited failed:', e && e.message)
    return wrapResult({
      code: -1,
      message: 'WXACODE_GENERATE_FAILED',
      data: { error: e && e.message }
    }, event)
  }

  // 3. 上传到云存储
  const cloudPath = fileKey(figureId)
  let uploadRes
  try {
    uploadRes = await cloud.uploadFile({ cloudPath, fileContent: buffer })
  } catch (e) {
    console.error('[figureQrcode] uploadFile failed:', e && e.message)
    return wrapResult({ code: -1, message: 'UPLOAD_FAILED', data: { error: e && e.message } }, event)
  }

  const fileID = uploadRes.fileID

  // 4. 记录缓存
  await setCached(figureId, fileID)

  // 5. 取临时 URL 返回
  try {
    const url = await getTempUrl(fileID)
    return wrapResult({ code: 0, message: 'ok', data: { url, fileID, cached: false } }, event)
  } catch (e) {
    return wrapResult({ code: 0, message: 'ok(no-url)', data: { url: '', fileID, cached: false } }, event)
  }
}
