const cloud = require('wx-server-sdk')
const https = require('https')
const { URL } = require('url')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, timeout: 60000 })
const db = cloud.database()
const _ = db.command

// 青月 Agent 配置（P0：从迁移自前端 constants.js，建立安全边界）
const AGENT_ID = 'agt-timeslip-2g9bj8k1d6e7cf65'
const ACP_ENDPOINT = `https://cloud1-d0gunpzup215cfd87.api.tcloudbasegateway.com/v1/aibot/bots/${AGENT_ID}/acp`
const PUBLISHABLE_KEY = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMWRjMzFlLWI0ZDAtNDQ4Yi1hNzZmLWIwY2M2M2Q4MTQ5OCJ9.eyJpc3MiOiJodHRwczovL2Nsb3VkMS1kMGd1bnB6dXAyMTVjZmQ4Ny5hcC1zaGFuZ2hhaS50Y2ItYXBpLnRlbmNlbnRjbG91ZGFwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJhdWQiOiJjbG91ZDEtZDBndW5wenVwMjE1Y2ZkODciLCJleHAiOjQwODkwMjIxODgsImlhdCI6MTc4NTMzODk4OCwibm9uY2UiOiJ6QzdaZlVSZVFLQ3ljMWhaMndNZ1hRIiwiYXRfaGFzaCI6InpDN1pmVVJFUUtDeWMxaFoyd01nWFEiLCJuYW1lIjoiQW5vbnltb3VzIiwic2NvcGUiOiJhbm9ueW1vdXMiLCJwcm9qZWN0X2lkIjoiY2xvdWQxLWQwZ3VucHp1cDIxNWNmZDg3IiwibWV0YSI6eyJwbGF0Zm9ybSI6IlB1Ymxpc2hhYmxlS2V5In0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.QeBz7kzMOwzUwUzYK1EBu3paT5wkFhOtHEmKB8_zRRcTtETV2JL400mjsPGNBzBi_STrjC61HdRdo__bIJ7EXhKCOZRhat4VDKMOjm6kkvLtXcljHKXo-pUn5ISnxRjI_SIMQo2jgE-eqFF4XlHGeiK3uUSeycZDS21XbPkYVCztZ4MowaPZq8eys9i7i8_WfghQ9gfH1eKiXyCyS5IsKxNuYtVNePFNGkpSPbbZ0jvISYS4JAQkjFLmHv-tI01899MQr0gRq930xEcZTIl5UocwPq_UsXuyltYr36G3WLEzx5tk1LBBvTAV9_KyqJV-5nrxnxHDerIVGwMNO2_ChA'

// 青月角色元数据（与前端 QINGYUE 对齐）
const FIGURE_ID = 'sys_qingyue'
const FIGURE_NAME = '青月'
const FIGURE_TITLE = '系统'
const FIGURE_AVATAR = '/images/qingyue.jpg'

const MAX_TEXT = 500

// 生成 UUID
function uuid() {
  try {
    const crypto = require('crypto')
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch (e) {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ACP JSON-RPC 请求（https，收集完整响应后解析）
function acpRequest(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
    const url = new URL(ACP_ENDPOINT)
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }
    const req = https.request(options, res => {
      let chunks = ''
      res.on('data', c => { chunks += c })
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`ACP_HTTP_${res.statusCode}: ${chunks.slice(0, 200)}`))
          return
        }
        // 优先尝试 JSON 解析（JSON-RPC 单帧）
        try {
          const parsed = JSON.parse(chunks)
          if (parsed && parsed.error) {
            reject(new Error(parsed.error.message || parsed.error.code || 'ACP_JSONRPC_ERROR'))
            return
          }
          resolve(parsed)
        } catch (e) {
          // 非 JSON，按 SSE 流原样返回
          resolve(chunks)
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// 从 session/new 响应中提取 sessionId
function extractSessionId(payload) {
  const result = payload && payload.result !== undefined ? payload.result : payload
  if (!result) return ''
  if (typeof result === 'string') return result
  if (typeof result.sessionId === 'string') return result.sessionId
  if (typeof result.id === 'string') return result.id
  return ''
}

// 创建 Agent 会话，优先用返回的 sessionId
async function createAgentSession() {
  const localId = uuid()
  try {
    const res = await acpRequest('session/new', {})
    const returned = extractSessionId(res)
    return returned || localId
  } catch (e) {
    console.warn('[qingyue-agent] session/new failed, fallback to local uuid:', e && e.message)
    return localId
  }
}

// 获取或创建 agentSessionId（存云端 chat_sessions.agentSessionId）
async function ensureAgentSession(OPENID) {
  const r = await db.collection('chat_sessions').where({ _openid: OPENID, figureId: FIGURE_ID }).limit(1).get()
  if (r.data.length && r.data[0].agentSessionId) {
    return r.data[0].agentSessionId
  }
  const agentSessionId = await createAgentSession()
  await upsertQingyueSession(OPENID, { agentSessionId })
  return agentSessionId
}

// 判断是否为 session 过期/不存在类错误（用于一次重试）
function isSessionError(e) {
  const msg = String((e && e.message) || '').toLowerCase()
  return msg.indexOf('session') >= 0 && (
    msg.indexOf('not found') >= 0 ||
    msg.indexOf('not exist') >= 0 ||
    msg.indexOf('expired') >= 0 ||
    msg.indexOf('invalid') >= 0
  )
}

// ============ SSE / 文本提取（迁移自前端 room.js） ============

function extractAcpText(payload) {
  const result = payload && payload.result !== undefined ? payload.result : payload
  if (!result) return ''
  if (typeof result === 'string') {
    return result.indexOf('data:') >= 0 ? extractSseAcpText(result) : result
  }
  if (typeof result.text === 'string') return result.text
  if (typeof result.answer === 'string') return result.answer
  if (typeof result.reply === 'string') return result.reply
  if (typeof result.content === 'string') return result.content
  if (typeof result.output === 'string') return result.output
  if (typeof result.output_text === 'string') return result.output_text
  if (result.message) return extractAcpText(result.message)
  if (Array.isArray(result.content)) {
    return result.content.map(item => {
      if (typeof item === 'string') return item
      return item && (item.text || item.content || '')
    }).filter(Boolean).join('')
  }
  if (Array.isArray(result)) {
    return result.map(item => extractAcpText(item)).filter(Boolean).join('')
  }
  if (result.data) return extractAcpText(result.data)
  return ''
}

function extractSseAcpText(raw) {
  const frames = String(raw || '')
    .split(/\n\n+/)
    .map(part => part.trim())
    .filter(Boolean)

  const visibleChunks = []
  const visibleUpdateTypes = [
    'agent_message_chunk',
    'assistant_message_chunk',
    'message_chunk',
    'text_message_chunk',
    'message',
    'text'
  ]

  frames.forEach(frame => {
    const lines = frame.split(/\n/).map(line => line.trim())
    const dataLines = lines
      .filter(line => line.indexOf('data:') === 0)
      .map(line => line.slice(5).trim())
      .filter(Boolean)
    if (!dataLines.length) return
    const dataText = dataLines.join('\n')
    if (dataText === '[DONE]') return
    let event
    try {
      event = JSON.parse(dataText)
    } catch (e) {
      return
    }
    const update = event && event.params && event.params.update
    if (!update) return
    const updateType = update.sessionUpdate || update.type || ''
    if (visibleUpdateTypes.indexOf(updateType) < 0) return
    const text = extractVisibleContentText(update.content || update.message || update.delta)
    if (!text) return
    visibleChunks.push(text)
  })

  return visibleChunks.join('')
}

function extractVisibleContentText(content) {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(item => extractVisibleContentText(item)).filter(Boolean).join('')
  }
  if (typeof content.text === 'string') return content.text
  if (typeof content.content === 'string') return content.content
  if (typeof content.delta === 'string') return content.delta
  if (Array.isArray(content.content)) return extractVisibleContentText(content.content)
  return ''
}

// ============ 内容安全 ============

async function checkText(text, openid) {
  if (!text) return { ok: true }
  try {
    const r = await cloud.openapi.security.msgSecCheck({
      openid, version: 2, scene: 1, content: String(text).slice(0, 2000)
    })
    if (r && r.result && r.result.suggest !== 'pass') {
      return { ok: false, reason: '内容包含不当信息：' + (r.result.label || '') }
    }
    return { ok: true }
  } catch (e) {
    console.warn('secCheck failed closed:', e && e.message)
    return { ok: false, reason: '内容检测服务暂不可用' }
  }
}

// ============ 落库 ============

async function saveMsg(doc) {
  await db.collection('chat_messages').add({ data: doc })
}

// 青月会话 upsert（patch 合并到现有记录，不存在则创建）
async function upsertQingyueSession(OPENID, patch) {
  const r = await db.collection('chat_sessions').where({ _openid: OPENID, figureId: FIGURE_ID }).limit(1).get()
  const now = db.serverDate()
  if (r.data.length) {
    await db.collection('chat_sessions').doc(r.data[0]._id).update({
      data: Object.assign({}, patch, { updatedAt: now })
    })
  } else {
    await db.collection('chat_sessions').add({
      data: Object.assign({
        _openid: OPENID,
        figureId: FIGURE_ID,
        figureName: FIGURE_NAME,
        figureTitle: FIGURE_TITLE,
        dynasty: '',
        avatar: FIGURE_AVATAR,
        lastMessage: '',
        lastTime: now,
        unread: 0,
        isSystem: true,
        agentSessionId: '',
        createdAt: now,
        updatedAt: now
      }, patch)
    })
  }
}

// 更新会话最后一条消息（P0 不累加 unread，用户在房间内）
async function bumpSession(OPENID, lastMsg) {
  const r = await db.collection('chat_sessions').where({ _openid: OPENID, figureId: FIGURE_ID }).limit(1).get()
  const now = db.serverDate()
  if (r.data.length) {
    await db.collection('chat_sessions').doc(r.data[0]._id).update({
      data: {
        lastMessage: lastMsg,
        lastTime: now,
        updatedAt: now
      }
    })
  } else {
    await db.collection('chat_sessions').add({
      data: {
        _openid: OPENID,
        figureId: FIGURE_ID,
        figureName: FIGURE_NAME,
        figureTitle: FIGURE_TITLE,
        dynasty: '',
        avatar: FIGURE_AVATAR,
        lastMessage: lastMsg,
        lastTime: now,
        unread: 0,
        isSystem: true,
        agentSessionId: '',
        createdAt: now,
        updatedAt: now
      }
    })
  }
}

// ============ Actions ============

async function handleSend(OPENID, data) {
  const { text } = data
  if (!text) return { code: -1, message: '缺少 text' }
  if (String(text).length > MAX_TEXT) return { code: -1, message: '消息不能超过500字' }

  // 内容安全
  const sec = await checkText(text, OPENID)
  if (!sec.ok) return { code: 403, message: sec.reason }

  // 获取或创建 agentSessionId
  let agentSessionId = await ensureAgentSession(OPENID)

  // 写 user message
  const now = db.serverDate()
  const userMsgId = 'u_' + Date.now() + Math.random().toString(36).slice(2, 6)
  await saveMsg({
    _id: userMsgId, _openid: OPENID,
    sessionId: agentSessionId,
    figureId: FIGURE_ID, role: 'user', content: text, mode: 'agent',
    createdAt: now, updatedAt: now
  })

  // 调 ACP session/prompt
  const startedAt = Date.now()
  let finalContent = ''
  try {
    const payload = await acpRequest('session/prompt', {
      sessionId: agentSessionId,
      prompt: [{ type: 'text', text }]
    })
    finalContent = extractAcpText(payload).trim()
    if (!finalContent) throw new Error('AGENT_EMPTY_RESPONSE')
  } catch (e) {
    // session 过期/不存在：重置一次后重试
    if (isSessionError(e)) {
      const newSessionId = await createAgentSession()
      await upsertQingyueSession(OPENID, { agentSessionId: newSessionId })
      const payload = await acpRequest('session/prompt', {
        sessionId: newSessionId,
        prompt: [{ type: 'text', text }]
      })
      finalContent = extractAcpText(payload).trim()
      if (!finalContent) throw new Error('AGENT_EMPTY_RESPONSE')
      agentSessionId = newSessionId
    } else {
      throw e
    }
  }

  // 输出内容安全
  const outSec = await checkText(finalContent, OPENID)
  if (!outSec.ok) return { code: 403, message: 'AI_CONTENT_REJECTED' }

  // 写 assistant message
  const aiMsgId = 'a_' + Date.now() + Math.random().toString(36).slice(2, 6)
  await saveMsg({
    _id: aiMsgId, _openid: OPENID,
    sessionId: agentSessionId,
    figureId: FIGURE_ID, role: 'assistant', content: finalContent, mode: 'agent', type: 'text',
    model: 'agent', latencyMs: Date.now() - startedAt,
    status: 'success', createdAt: now, updatedAt: now
  })

  // 更新会话
  try { await bumpSession(OPENID, finalContent) } catch (_) {}

  return {
    code: 0, message: 'ok',
    data: {
      figureId: FIGURE_ID,
      userMsg: { _id: userMsgId, role: 'user', content: text, createdAt: Date.now() },
      aiMsg: { _id: aiMsgId, role: 'assistant', content: finalContent, type: 'text', createdAt: Date.now() }
    }
  }
}

async function handleHistory(OPENID, data) {
  const { limit = 50 } = data
  try {
    const r = await db.collection('chat_messages')
      .where({ _openid: OPENID, figureId: FIGURE_ID })
      .orderBy('createdAt', 'desc')
      .limit(Math.min(limit, 100))
      .get()
    return { code: 0, message: 'ok', data: r.data.reverse() }
  } catch (e) {
    return { code: 0, message: 'ok(fallback)', data: [] }
  }
}

async function handleClearSession(OPENID) {
  // 1. 删青月云端消息
  try {
    await db.collection('chat_messages').where({ _openid: OPENID, figureId: FIGURE_ID }).remove()
  } catch (e) {}

  // 2. 删 ACP session（若有 agentSessionId）
  const r = await db.collection('chat_sessions').where({ _openid: OPENID, figureId: FIGURE_ID }).limit(1).get()
  const oldSessionId = r.data.length && r.data[0].agentSessionId
  if (oldSessionId) {
    try { await acpRequest('session/delete', { sessionId: oldSessionId }) } catch (e) {}
  }

  // 3. 重置 chat_sessions 的 agentSessionId
  try {
    if (r.data.length) {
      await db.collection('chat_sessions').doc(r.data[0]._id).update({
        data: {
          agentSessionId: '',
          lastMessage: '',
          lastTime: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
    }
  } catch (e) {}

  return { code: 0, message: 'ok' }
}

// ============ 入口 ============

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action, ...rest } = event || {}
  try {
    switch (action) {
      case 'send': return await handleSend(OPENID, rest)
      case 'history': return await handleHistory(OPENID, rest)
      case 'clearSession': return await handleClearSession(OPENID)
      default: return { code: -1, message: '未知 qingyue-agent action: ' + action }
    }
  } catch (err) {
    console.error('qingyue-agent err:', err && err.stack || err)
    return { code: -1, message: (err && err.message) || '青月服务异常' }
  }
}
