const cloud = require('wx-server-sdk')
const https = require('https')
const { URL } = require('url')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, timeout: 60000 })
const db = cloud.database()
const _ = db.command
const AGENT_ID = 'agt-timeslip-2g9bj8k1d6e7cf65'
const ACP_ENDPOINT = `https://cloud1-d0gunpzup215cfd87.api.tcloudbasegateway.com/v1/aibot/bots/${AGENT_ID}/acp`
const DEFAULT_PUBLISHABLE_KEY = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMWRjMzFlLWI0ZDAtNDQ4Yi1hNzZmLWIwY2M2M2Q4MTQ5OCJ9.eyJpc3MiOiJodHRwczovL2Nsb3VkMS1kMGd1bnB6dXAyMTVjZmQ4Ny5hcC1zaGFuZ2hhaS50Y2ItYXBpLnRlbmNlbnRjbG91ZGFwaS5jb20iLCJzdWIiOiJhbm9uIiwiYXVkIjoiY2xvdWQxLWQwZ3VucHp1cDIxNWNmZDg3IiwiZXhwIjo0MDg5MDIyMTg4LCJpYXQiOjE3ODUzMzg5ODgsIm5vbmNlIjoiekM3WmZVUmVRS0N5YzFoWjJ3TWdYUSIsImF0X2hhc2giOiJ6QzdaZlVSZVFLQ3ljMWhaMndNZ1hRIiwibmFtZSI6IkFub255bW91cyIsInNjb3BlIjoiYW5vbnltb3VzIiwicHJvamVjdF9pZCI6ImNsb3VkMS1kMGd1bnB6dXAyMTVjZmQ4NyIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJ1c2VyX3R5cGUiOiIiLCJjbGllbnRfdHlwZSI6ImNsaWVudF91c2VyIiwiaXNfc3lzdGVtX2FkbWluIjpmYWxzZX0.QeBz7kzMOwzUwUzYK1EBu3paT5wkFhOtHEmKB8_zRRcTtETV2JL400mjsPGNBzBi_STrjC61HdRdo__bIJ7EXhKCOZRhat4VDKMOjm6kkvLtXcljHKXo-pUn5ISnxRjI_SIMQo2jgE-eqFF4XlHGeiK3uUSeycZDS21XbPkYVCztZ4MowaPZq8eys9i7i8_WfghQ9gfH1eKiXyCyS5IsKxNuYtVNePFNGkpSPbbZ0jvISYS4JAQkjFLmHv-tI01899MQr0gRq930xEcZTIl5UocwPq_UsXuyltYr36G3WLEzx5tk1LBBvTAV9_KyqJV-5nrxnxHDerIVGwMNO2_ChA'

// 青月角色元数据（与前端 QINGYUE 对齐）
const FIGURE_ID = 'sys_qingyue'
const FIGURE_NAME = '青月'
const FIGURE_TITLE = '系统'
const FIGURE_AVATAR = '/images/qingyue.jpg'

const MAX_TEXT = 500
const MAX_HISTORY = 20
const MAX_SEARCH_RESULTS = 5

function getPublishableKey() {
  return (process.env.QINGYUE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY).trim()
}

function acpRequest(method, params) {
  return new Promise((resolve, reject) => {
    const token = getPublishableKey()
    if (!token) {
      reject(new Error('QINGYUE_PUBLISHABLE_KEY_MISSING'))
      return
    }

    const body = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
    const url = new URL(ACP_ENDPOINT)
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 55000
    }, res => {
      let chunks = ''
      res.on('data', c => { chunks += c })
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`ACP_HTTP_${res.statusCode}: ${chunks.slice(0, 500)}`))
          return
        }
        try {
          const parsed = JSON.parse(chunks)
          if (parsed && parsed.error) {
            reject(new Error(parsed.error.message || parsed.error.code || 'ACP_JSONRPC_ERROR'))
            return
          }
          resolve(parsed)
        } catch (e) {
          resolve(chunks)
        }
      })
    })
    req.on('timeout', () => {
      req.destroy(new Error('ACP_REQUEST_TIMEOUT'))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function buildPromptWithHistory(text, history) {
  const pairs = (history || []).slice(-8)
  if (!pairs.length) return text
  const historyText = pairs
    .map(m => `${m.role === 'user' ? '用户' : '青月'}：${m.content}`)
    .join('\n')
  return `【最近对话】\n${historyText}\n\n【用户当前问题】\n${text}`
}

function shouldUseWebSearch(text) {
  const t = String(text || '').toLowerCase()
  const realtimeKeywords = [
    '今天', '明天', '后天', '现在', '当前', '最近', '最新', '实时',
    '天气', '气温', '下雨', '台风', '空气质量',
    '新闻', '热搜', '上映', '开放', '闭馆', '门票', '价格', '股价',
    '汇率', '赛事', '比分', '日程', '政策', '公告'
  ]
  return realtimeKeywords.some(keyword => t.indexOf(keyword) >= 0)
}

function buildSearchQuery(text) {
  const raw = String(text || '').trim()
  if (!raw) return ''
  if (raw.indexOf('天气') >= 0 && !/[省市县区]|北京|上海|广州|深圳|杭州|南京|苏州|成都|重庆|武汉|西安|长沙|厦门|青岛|天津/.test(raw)) {
    return raw + ' 上海'
  }
  return raw
}

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: Object.assign({
        'User-Agent': 'Mozilla/5.0 qingyue-agent web-search',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }, headers),
      timeout: 12000
    }, res => {
      let body = ''
      res.on('data', chunk => { body += chunk })
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`WEB_SEARCH_HTTP_${res.statusCode}`))
          return
        }
        resolve(body)
      })
    })
    req.on('timeout', () => req.destroy(new Error('WEB_SEARCH_TIMEOUT')))
    req.on('error', reject)
    req.end()
  })
}

function decodeHtml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripHtml(html) {
  return decodeHtml(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim())
}

function normalizeDuckDuckGoUrl(url) {
  const raw = decodeHtml(url || '')
  try {
    const parsed = new URL(raw, 'https://duckduckgo.com')
    const uddg = parsed.searchParams.get('uddg')
    if (uddg) return decodeURIComponent(uddg)
    return parsed.href
  } catch (e) {
    return raw
  }
}

function normalizeSearchUrl(url, base) {
  const raw = decodeHtml(url || '')
  try {
    return new URL(raw, base).href
  } catch (e) {
    return raw
  }
}

function parseSoWeatherResult(html) {
  const raw = String(html || '')
  const weatherStart = raw.indexOf('id="mohe-weather"')
  if (weatherStart < 0) return null

  const weatherEndCandidates = [
    raw.indexOf('mh-source-wrap', weatherStart),
    raw.indexOf('</li>', weatherStart)
  ].filter(i => i > weatherStart)
  const weatherEnd = weatherEndCandidates.length ? Math.min(...weatherEndCandidates) : weatherStart + 30000
  const snippet = stripHtml(raw.slice(weatherStart, weatherEnd)).slice(0, 1200)
  if (!snippet) return null

  return {
    title: '360搜索天气卡片',
    url: 'https://www.so.com/s',
    snippet
  }
}

function parseSoSearchResults(html) {
  const results = []
  const weather = parseSoWeatherResult(html)
  if (weather) results.push(weather)

  const blocks = String(html || '').split(/<li[^>]+class="[^"]*res-list[^"]*"[^>]*>/i).slice(1)
  blocks.forEach(block => {
    if (results.length >= MAX_SEARCH_RESULTS) return
    if (block.indexOf('id="mohe-weather"') >= 0) return

    const titleMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i)
      || block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,300}?)<\/a>/i)
    if (!titleMatch) return

    const snippetMatch = block.match(/<p[^>]+class="[^"]*(?:res-desc|content|summary|g-card-desc)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
      || block.match(/<div[^>]+class="[^"]*(?:res-rich|res-desc|content|summary)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)

    const title = stripHtml(titleMatch[2])
    const url = normalizeSearchUrl(titleMatch[1], 'https://www.so.com')
    const snippet = stripHtml(snippetMatch && snippetMatch[1]) || stripHtml(block).slice(0, 260)
    if (!title || !url || title.length > 120) return
    results.push({ title, url, snippet })
  })

  if (!results.length) {
    const fallback = stripHtml(html).slice(0, 1200)
    if (fallback) {
      results.push({
        title: '360搜索页面摘要',
        url: 'https://www.so.com/s',
        snippet: fallback
      })
    }
  }

  return results.slice(0, MAX_SEARCH_RESULTS)
}

function parseDuckDuckGoResults(html) {
  const results = []
  const blocks = String(html || '').split(/<div class="result results_links[^"]*">/i).slice(1)
  blocks.forEach(block => {
    if (results.length >= MAX_SEARCH_RESULTS) return
    const titleMatch = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!titleMatch) return
    const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i)
    const title = stripHtml(titleMatch[2])
    const url = normalizeDuckDuckGoUrl(titleMatch[1])
    const snippet = stripHtml(snippetMatch && snippetMatch[1])
    if (!title || !url) return
    results.push({ title, url, snippet })
  })
  return results
}

async function webSearch(query) {
  const q = buildSearchQuery(query)
  if (!q) return []
  const providers = [
    {
      name: 'so',
      url: 'https://www.so.com/s?q=' + encodeURIComponent(q),
      parse: parseSoSearchResults
    },
    {
      name: 'duckduckgo',
      url: 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q),
      parse: parseDuckDuckGoResults
    }
  ]
  const errors = []
  for (const provider of providers) {
    try {
      const html = await httpGet(provider.url)
      const results = provider.parse(html)
      if (results && results.length) {
        return results.map(item => Object.assign({ source: provider.name }, item))
      }
      errors.push(`${provider.name}: EMPTY_RESULTS`)
    } catch (e) {
      errors.push(`${provider.name}: ${e && e.message ? e.message : e}`)
    }
  }
  throw new Error(`WEB_SEARCH_FAILED: ${errors.join('; ')}`)
}

function buildPromptWithWeb(text, history, searchResults) {
  const base = buildPromptWithHistory(text, history)
  if (!searchResults || !searchResults.length) return base
  const now = new Date().toISOString()
  const webText = searchResults.map((r, i) => {
    return `${i + 1}. ${r.title}\n摘要：${r.snippet || '无摘要'}\n链接：${r.url}`
  }).join('\n\n')
  return `${base}

【联网搜索结果】
检索时间：${now}
以下搜索结果可能包含实时信息。回答时请优先基于这些结果，不要编造；如果搜索结果不足以确认，请明确说明。

${webText}`
}

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

// 从 chat_messages 查历史，组装为 history 参数
async function getHistoryForBot(OPENID) {
  try {
    const r = await db.collection('chat_messages')
      .where({ _openid: OPENID, figureId: FIGURE_ID })
      .orderBy('createdAt', 'desc')
      .limit(MAX_HISTORY)
      .get()
    return r.data.reverse().map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content || '').slice(0, 1000)
    }))
  } catch (e) {
    return []
  }
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

async function bumpSession(OPENID, lastMsg) {
  const r = await db.collection('chat_sessions').where({ _openid: OPENID, figureId: FIGURE_ID }).limit(1).get()
  const now = db.serverDate()
  if (r.data.length) {
    await db.collection('chat_sessions').doc(r.data[0]._id).update({
      data: { lastMessage: lastMsg, lastTime: now, updatedAt: now }
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

  // 写 user message（先落库，再调 Agent，保证历史完整）
  const now = db.serverDate()
  const userMsgId = 'u_' + Date.now() + Math.random().toString(36).slice(2, 6)
  await saveMsg({
    _id: userMsgId, _openid: OPENID,
    figureId: FIGURE_ID, role: 'user', content: text, mode: 'agent',
    createdAt: now, updatedAt: now
  })

  // 取历史（含刚写的 user message 之前的记录）
  const history = await getHistoryForBot(OPENID)
  // sendMessage 的 history 应为本次 msg 之前的对话，不含当前 msg
  // getHistoryForBot 已包含刚写入的 user message，需去掉最后一条
  const historyBefore = history.slice(0, -1)

  // 调用 Agent ACP（云函数运行时没有 cloud.extend.AI.bot，不能用 SDK 路径）
  const startedAt = Date.now()
  let finalContent = ''
  try {
    let searchResults = []
    if (shouldUseWebSearch(text)) {
      try {
        searchResults = await webSearch(text)
      } catch (searchErr) {
        console.warn('[qingyue-agent] web search failed:', searchErr && searchErr.message)
      }
    }
    const payload = await acpRequest('session/prompt', {
      prompt: [
        {
          type: 'text',
          text: buildPromptWithWeb(text, historyBefore, searchResults)
        }
      ]
    })
    finalContent = extractAcpText(payload).trim()
    if (!finalContent) throw new Error('AGENT_EMPTY_RESPONSE')
  } catch (e) {
    console.error('[qingyue-agent] ACP failed:', e && e.message, e && e.stack)
    throw e
  }

  // 输出内容安全
  const outSec = await checkText(finalContent, OPENID)
  if (!outSec.ok) return { code: 403, message: 'AI_CONTENT_REJECTED' }

  // 写 assistant message
  const aiMsgId = 'a_' + Date.now() + Math.random().toString(36).slice(2, 6)
  await saveMsg({
    _id: aiMsgId, _openid: OPENID,
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
  // 删青月云端消息（会话延续改为 history 传入，无需删 Agent 端 session）
  try {
    await db.collection('chat_messages').where({ _openid: OPENID, figureId: FIGURE_ID }).remove()
  } catch (e) {}

  try {
    const r = await db.collection('chat_sessions').where({ _openid: OPENID, figureId: FIGURE_ID }).limit(1).get()
    if (r.data.length) {
      await db.collection('chat_sessions').doc(r.data[0]._id).update({
        data: {
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
      case 'webSearch': return { code: 0, message: 'ok', data: await webSearch(rest.query || rest.text || '') }
      case 'history': return await handleHistory(OPENID, rest)
      case 'clearSession': return await handleClearSession(OPENID)
      default: return { code: -1, message: '未知 qingyue-agent action: ' + action }
    }
  } catch (err) {
    console.error('qingyue-agent err:', err && err.stack || err)
    return { code: -1, message: (err && err.message) || '青月服务异常' }
  }
}
