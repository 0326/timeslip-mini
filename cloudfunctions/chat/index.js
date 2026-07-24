const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const MAX_HISTORY = 30

const FIGURES = {
  'fig-kongzi': { name: '孔子', dynasty: '春秋·鲁', title: '儒家圣人', tone: '温厚谆谆，多用比喻，自称"丘"或"吾"。常引《诗》《书》，每以"子曰"结，语短而意长。' },
  'fig-simqian': { name: '司马迁', dynasty: '西汉', title: '太史公', tone: '严谨深沉，引史实作评，自称"愚"或"仆"，好作"太史公曰"式评论。' },
  'fig-libai': { name: '李白', dynasty: '唐', title: '诗仙', tone: '豪放飘逸，好饮好酒，自称"某"或"吾"。开口成诗，必带酒、月、剑、山水。' },
  'fig-sushi': { name: '苏轼', dynasty: '北宋', title: '东坡居士', tone: '旷达幽默，善谈美食与养生，自称"某"或"吾"。亦庄亦谐，引《赤壁赋》《念奴娇》。' },
  'fig-wujiang': { name: '项羽', dynasty: '秦末·楚', title: '西楚霸王', tone: '豪迈壮烈，少言而气壮，自称"本王"或"籍"。重情重义，惜败于垓下。' },
  'fig-caocao': { name: '曹操', dynasty: '东汉末', title: '魏武帝', tone: '深沉果决，权谋在胸，自称"孤"或"吾"。好引《短歌行》《观沧海》。' },
  'fig-wuzetian': { name: '武则天', dynasty: '唐', title: '则天大圣皇帝', tone: '雍容威严，自称"朕"或"本宫"。爱论朝政与人才，不废女儿柔情。' },
  'fig-mulan': { name: '花木兰', dynasty: '南北朝', title: '巾帼英雄', tone: '质朴飒爽，孝义为先，自称"妾身"或"末将"。少文饰，多直言。' },
  'fig-baijuyi': { name: '白居易', dynasty: '唐', title: '诗魔', tone: '平易浅切，关心民生，自称"某"或"乐天"。老妪能解，多用白描。' },
  'fig-zhenghe': { name: '郑和', dynasty: '明', title: '三保太监', tone: '沉稳开阔，见多识广，自称"奴婢"或"本使"。善言远洋风物，重信义。' }
}

function safeGet(figureId) { return FIGURES[figureId] || { name: '古代贤人', title: '', dynasty: '', tone: '温文尔雅，自称"某"' } }

function buildChatPrompt(figureId, userInput, history = []) {
  const f = safeGet(figureId)
  const h = history.slice(-8).map(m => `${m.role === 'user' ? '用户' : f.name}：${m.content}`).join('\n')
  return `你现在是${f.dynasty ? f.dynasty + '人、' : ''}${f.name}${f.title ? '（' + f.title + '）' : ''}。
性格风格：${f.tone}
严格遵守以下规则：
1. 必须以${f.name}的身份回答，不得脱离人设；
2. 使用半文半白风格，引用真实著作或名句，每段控制100字以内；
3. 不使用现代网络词汇，不以AI身份回答，不论用户说什么都维持${f.name}的视角；
4. 可在结尾用两句短诗点睛，若无灵感则不勉强。

最近对话上下文：
${h}
用户问：${userInput}

请现在以${f.name}的身份回复：`
}

function buildMomentCommentPrompt(figureId, userInput, momentContent) {
  const f = safeGet(figureId)
  return `你是${f.name}${f.title ? '（' + f.title + '）' : ''}。你正在刷"穿越朋友圈"，看到一条动态：
【动态内容】：${momentContent || ''}
【你看到一位朋友评论】：${userInput || ''}
请以${f.name}的口吻，用1-2句文言文或半文半白的风格回复这个朋友的评论，要自然、有趣、符合你的人设。只输出回复文本，不要任何前缀，30字以内。`
}

function buildPigeonPrompt(figureId, letterContent, fromName = '远方友人') {
  const f = safeGet(figureId)
  return `你是${f.name}${f.title ? '（' + f.title + '）' : ''}。刚收到一封由飞鸽传来的信。
【来信人】：${fromName}
【来信内容】：
${letterContent || ''}
请以${f.name}的身份写一封回信：
- 文言或半文半白格式，开头称呼、中间抒情议事、结尾署名；
- 长度120-200字，感情真挚，符合${f.tone}；
- 可引用历史典故或你本人的名句，但要自然；
- 不要出现AI、现代词，保持古人身份。
只输出回信正文内容。`
}

function buildMemorialPrompt(memorialId, decision, optionText) {
  return `你是一位深通中国历史的太史令，正在进行"奏折推演"。
【当前奏折】id=${memorialId}，用户的决策为【${decision}】：${optionText || ''}。
请模拟此决策之后的历史推演：
1) 第一个月：朝野反应 + 关键人物态度；
2) 三个月后：政策效果或矛盾爆发；
3) 一年后：对朝局与民生的总结 + 太史公评。
输出为 JSON 字符串格式，字段：
{"months":[{"month":"第一个月","summary":"..."},{"month":"第三个月","summary":"..."},{"month":"第十二个月","summary":"..."}],"newMemorial":{"title":"下一份奏折标题","submitter":"上奏人","content":"摘要"}}
不要任何其他文字。`
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { mode = 'chat', action, data = {} } = event

  const runAction = action || mode
  try {
    switch (runAction) {
      case 'send':
      case 'chat': return await modeChat(OPENID, data)
      case 'moment_comment': return await modeMomentComment(OPENID, data)
      case 'pigeon_reply': return await modePigeonReply(OPENID, data)
      case 'memorial_simulate': return await modeMemorialSimulate(OPENID, data)
      case 'history': return await handleHistory(OPENID, data)
      case 'clear': return await handleClear(OPENID, data)
      default: return { code: -1, message: '未知 chat action/mode: ' + runAction }
    }
  } catch (err) {
    console.error('chat cloudFn err:', err)
    return { code: -1, message: err.message || '聊天服务异常' }
  }
}

async function modeChat(OPENID, data) {
  const { figureId, content, sessionId, history = [] } = data
  if (!figureId || !content) return { code: -1, message: '缺少 figureId 或 content' }
  const sec = await checkText(content, OPENID)
  if (!sec.ok) return { code: 403, message: sec.reason }

  const prompt = buildChatPrompt(figureId, content, history)
  const reply = mockAIGenerate('chat', figureId, content)

  const now = db.serverDate()
  const userMsgId = 'u_' + Date.now() + Math.random().toString(36).slice(2, 6)
  const aiMsgId = 'a_' + Date.now() + Math.random().toString(36).slice(2, 6)

  saveMsg({
    _id: userMsgId, _openid: OPENID,
    sessionId: sessionId || `${OPENID}_${figureId}`,
    figureId, role: 'user', content, mode: 'chat',
    createdAt: now, updatedAt: now
  })
  saveMsg({
    _id: aiMsgId, _openid: OPENID,
    sessionId: sessionId || `${OPENID}_${figureId}`,
    figureId, role: 'assistant', content: reply, mode: 'chat', type: 'text',
    prompt, createdAt: now, updatedAt: now
  })

  try { await bumpSession(OPENID, figureId, content) } catch (_) {}

  return {
    code: 0, message: 'ok',
    data: {
      figureId,
      userMsg: { _id: userMsgId, role: 'user', content, createdAt: new Date().toISOString() },
      aiMsg: { _id: aiMsgId, role: 'assistant', content: reply, type: 'text', createdAt: new Date().toISOString() },
      prompt: process.env.NODE_ENV === 'dev' ? prompt : undefined
    }
  }
}

async function modeMomentComment(OPENID, data) {
  const { figureId, userComment, momentContent } = data
  if (!userComment) return { code: -1, message: '缺少评论内容' }
  const sec = await checkText(userComment, OPENID)
  if (!sec.ok) return { code: 403, message: sec.reason }
  const prompt = buildMomentCommentPrompt(figureId, userComment, momentContent)
  const reply = mockAIGenerate('moment_comment', figureId, userComment)
  try {
    await db.collection('moment_comments').add({
      data: {
        figureId: figureId || 'ai',
        name: safeGet(figureId).name,
        avatar: '',
        content: reply,
        replyTo: userComment,
        likes: [],
        aiGenerate: true,
        createdAt: db.serverDate()
      }
    })
  } catch (_) {}
  return { code: 0, message: 'ok', data: { reply, prompt: undefined } }
}

async function modePigeonReply(OPENID, data) {
  const { figureId, letterContent, fromName = '远方友人', letterId } = data
  if (!letterContent) return { code: -1, message: '缺少信件内容' }
  const sec = await checkText(letterContent, OPENID)
  if (!sec.ok) return { code: 403, message: sec.reason }
  const prompt = buildPigeonPrompt(figureId, letterContent, fromName)
  const reply = mockAIGenerate('pigeon_reply', figureId, letterContent)
  try {
    if (letterId) {
      await db.collection('letters').doc(letterId).update({
        data: { aiReply: reply, repliedAt: db.serverDate() }
      })
    }
  } catch (_) {}
  return {
    code: 0, message: 'ok',
    data: {
      reply,
      figure: safeGet(figureId),
      deliveredAt: Date.now() + 3000
    }
  }
}

async function modeMemorialSimulate(OPENID, data) {
  const { memorialId, decision, optionText = '' } = data
  if (!memorialId || !decision) return { code: -1, message: '参数不全' }
  const prompt = buildMemorialPrompt(memorialId, decision, optionText)
  const raw = mockAIGenerate('memorial_simulate', null, `${decision}|${optionText}`)
  let result
  try {
    result = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (_) {
    result = {
      months: [
        { month: '第一个月', summary: '诏令初下，朝野议论纷然，公卿有异议者数人。' },
        { month: '第三个月', summary: '行之三月，利弊渐显：有利国计者，亦有不便民生者。' },
        { month: '第十二个月', summary: '一岁之后，功过分明。太史公曰：谋事在人，成事在天。' }
      ],
      newMemorial: {
        title: '续陈时弊疏',
        submitter: '朝中拾遗',
        content: '伏见前诏颁行一年，利害已显，臣请续陈……'
      }
    }
  }
  try {
    await db.collection('memorial_simulations').add({
      data: { memorialId, decision, optionText, result, prompt, createdAt: db.serverDate() }
    })
  } catch (_) {}
  return { code: 0, message: 'ok', data: result }
}

function mockAIGenerate(mode, figureId, input) {
  const f = safeGet(figureId || '')
  switch (mode) {
    case 'chat':
      return `${pickChatGreeting(f.name)}\n\n${pickChatBody(f, input)}\n\n${pickPoem(f)}`
    case 'moment_comment':
      const cPool = {
        'fig-libai': ['妙哉！当浮一大白！', '哈哈，此论甚合我意。', '不如同醉，共看明月。'],
        'fig-sushi': ['东坡闻之，抚掌大笑。', '有味，有味！', '人生如逆旅，此语不虚。'],
        default: ['善哉斯言！', '此言甚是。', '深有同感。']
      }
      return (cPool[figureId] || cPool.default)[Math.floor(Math.random() * 3)]
    case 'pigeon_reply':
      return `某某吾友台鉴：\n  来函已达，某展读数四，甚慰甚念。${pickPigeonBody(f, input)}\n\n  秋风渐起，愿君珍重。纸短情长，不尽一一。\n\n${f.name} 顿首`
    case 'memorial_simulate':
      return JSON.stringify({
        months: [
          { month: '第一个月', summary: '诏下，有司奉行，初无波澜。然民间有智者私议："此策之弊，恐在他日。"' },
          { month: '第三个月', summary: '三月既望，利弊现焉：利于公者什一，病于民者亦见。' },
          { month: '第十二个月', summary: '岁末复盘，太史公执简而叹："一策之兴，系乎其人。得人则兴，失人则废。"' }
        ],
        newMemorial: {
          title: '请损益前诏疏',
          submitter: '门下省',
          content: '前者所行，已见成效，然臣等窃以为，或可斟酌损益，以臻至善。'
        }
      })
    default:
      return '已悉。'
  }
}

function pickChatGreeting(name) {
  const arr = [`"善！"${name}抚案而起，`, `${name}轻捻须髯，莞尔曰：`, `适闻君言，${name}欣然作答：`]
  return arr[Math.floor(Math.random() * arr.length)]
}
function pickChatBody(f, input) {
  const t = (input || '').slice(0, 30)
  return `君所言「${t}」，深合我心。昔某亦曾思此事，今遇知音，不觉忘言。愿与君共论之。`
}
function pickPoem(f) {
  const id = f ? Object.keys(FIGURES).find(k => FIGURES[k].name === f.name) : null
  const p = {
    'fig-libai': '——「今人不见古时月，今月曾经照古人。」',
    'fig-sushi': '——「但愿人长久，千里共婵娟。」',
    'fig-kongzi': '——「学而时习之，不亦说乎？」',
    'fig-caocao': '——「对酒当歌，人生几何？」',
    'fig-wujiang': '——「力拔山兮气盖世，时不利兮骓不逝。」',
    'fig-wuzetian': '——「无字碑上无字，功过留与后人。」',
    'fig-simqian': '——「究天人之际，通古今之变，成一家之言。」',
    'fig-mulan': '——「将军百战死，壮士十年归。」',
    'fig-baijuyi': '——「文章合为时而著，歌诗合为事而作。」',
    'fig-zhenghe': '——「长风破浪会有时，直挂云帆济沧海。」'
  }
  return p[id] || ''
}
function pickPigeonBody(f, input) {
  const t = (input || '君之情谊').slice(0, 20)
  return `览${t}，使某感怀不已。人生世间，知音难遇，今得吾友，何幸如之！`
}

async function saveMsg(doc) {
  try { await db.collection('chat_messages').add({ data: doc }) }
  catch (e) { console.warn('saveMsg fail', e.message) }
}

async function bumpSession(OPENID, figureId, lastMsg) {
  const f = safeGet(figureId)
  const r = await db.collection('chat_sessions').where({ _openid: OPENID, figureId }).limit(1).get()
  const doc = {
    _openid: OPENID, figureId,
    figureName: f.name, figureTitle: f.title, dynasty: f.dynasty,
    lastMessage: lastMsg, lastTime: db.serverDate(),
    unread: 1
  }
  if (r.data.length) {
    await db.collection('chat_sessions').doc(r.data[0]._id).update({
      data: {
        lastMessage: lastMsg,
        lastTime: db.serverDate(),
        unread: _.inc(1)
      }
    })
  } else {
    await db.collection('chat_sessions').add({ data: doc })
  }
}

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
    console.warn('secCheck fallthrough', e.message)
    return { ok: true, fallthrough: true }
  }
}

async function handleHistory(OPENID, data) {
  const { figureId, limit = 50 } = data
  if (!figureId) return { code: -1, message: '缺少 figureId' }
  try {
    const r = await db.collection('chat_messages')
      .where({ _openid: OPENID, figureId })
      .orderBy('createdAt', 'desc')
      .limit(Math.min(limit, 100))
      .get()
    return { code: 0, message: 'ok', data: r.data.reverse() }
  } catch (e) {
    return { code: 0, message: 'ok(fallback)', data: [] }
  }
}

async function handleClear(OPENID, data) {
  const { figureId } = data
  if (!figureId) return { code: -1, message: '缺少 figureId' }
  try {
    const r = await db.collection('chat_messages')
      .where({ _openid: OPENID, figureId }).remove()
    return { code: 0, message: 'ok', data: { removed: r.stats.removed || 0 } }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
