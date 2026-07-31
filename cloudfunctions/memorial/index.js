const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function tryUnlock(OPENID, key) {
  try {
    const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (!userRes.data || !userRes.data.length) return
    const user = userRes.data[0]
    const achievements = user.achievements || []
    if (achievements.some(a => a.key === key)) return
    const REWARDS = { first_chat: 10, first_letter: 10, first_like: 5, dna_done: 20, first_visit: 10, first_profile: 10, chat_10: 30, chat_50: 80, letter_5: 50, comment_10: 30, chat_100: 150, letter_10: 100, first_memorial: 20, memorial_5: 80, read_book: 15, memorial_20: 200, read_5: 100, dna_share: 30, all_dynasties: 200, collector: 500, time_master: 1000, all_figures: 300, moment_popular: 200, memorial_master: 500 }
    const reward = REWARDS[key] || 0
    achievements.push({ key, unlockedAt: new Date() })
    await db.collection('users').doc(user._id).update({
      data: { achievements, points: db.command.inc(reward), updatedAt: db.serverDate() }
    })
  } catch (e) { console.warn('tryUnlock fail', key, e.message) }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event
  const data = normalizeEventData(event)
  try {
    switch (action) {
      case 'list': return await list(OPENID, data)
      case 'get': return await get(OPENID, data)
      case 'decide': return await decide(OPENID, data)
      case 'history': return await history(OPENID, data)
      default: return { code: -1, message: '未知 action: ' + action }
    }
  } catch (e) {
    console.error('memorial err:', e)
    return { code: -1, message: e.message || '服务异常' }
  }
}

function normalizeEventData(event) {
  const { action, data, ...rest } = event || {}
  return data && typeof data === 'object' ? { ...rest, ...data } : rest
}

async function list(OPENID, data) {
  const { chapter } = data
  try {
    let q = db.collection('memorials')
    if (chapter && chapter !== 'all') {
      q = q.where(db.command.or([{ dynasty: chapter }, { chapter: chapter }]))
    }
    const r = await q.limit(50).get()
    const list = (r.data || []).map(m => ({
      _id: m._id,
      title: m.title,
      submitter: m.submitter,
      dynasty: m.dynasty,
      dynastyName: m.dynastyName,
      background: m.background,
      unlocked: true,
      prerequisites: []
    }))
    return { code: 0, message: 'ok', data: { list } }
  } catch (e) {
    return { code: 0, message: 'ok', data: { list: [] } }
  }
}

async function get(OPENID, data) {
  const { _id, id } = data
  const targetId = _id || id
  if (!targetId) return { code: -1, message: '缺少 _id' }
  try {
    const r = await db.collection('memorials').doc(targetId).get()
    if (!r.data) return { code: -1, message: '奏折不存在' }
    return { code: 0, message: 'ok', data: r.data }
  } catch (e) {
    return { code: -1, message: '奏折不存在' }
  }
}

async function decide(OPENID, data) {
  const { memorialId, decision, zhupi } = data
  if (!memorialId || !decision) return { code: -1, message: '参数不全' }

  let m = null
  try {
    const r = await db.collection('memorials').doc(memorialId).get()
    m = r.data
  } catch (e) {}
  if (!m) return { code: -1, message: '奏折不存在' }

  const opt = (m.options || []).find(o => o.k === decision)
  if (!opt) return { code: -1, message: '选项错误' }

  const doc = {
    memorialId,
    title: m.title,
    submitter: m.submitter,
    dynasty: m.dynasty,
    dynastyName: m.dynastyName,
    decision,
    decisionText: opt.text,
    zhupi: zhupi || '',
    consequence: opt.consequence,
    score: opt.score,
    createdAt: db.serverDate()
  }
  let _id = ''
  try {
    const r = await db.collection('memorial_answers').add({ data: doc })
    _id = r._id
  } catch (e) {
    console.warn('save memorial answer failed:', e.message)
  }

  tryUnlock(OPENID, 'first_memorial')
  ;(async () => {
    try {
      const cnt = await db.collection('memorial_answers').where({ _openid: OPENID }).count()
      if ((cnt.total || 0) >= 5) await tryUnlock(OPENID, 'memorial_5')
      if ((cnt.total || 0) >= 20) await tryUnlock(OPENID, 'memorial_20')
      if ((cnt.total || 0) >= 50) await tryUnlock(OPENID, 'memorial_master')
    } catch (e) {}
  })()

  return { code: 0, message: 'ok', data: { ...doc, _id } }
}

async function history(OPENID, data) {
  const { limit = 20 } = data
  try {
    const r = await db.collection('memorial_answers')
      .where({ _openid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(Math.min(limit, 50))
      .get()
    return { code: 0, message: 'ok', data: { list: r.data || [] } }
  } catch (e) {
    return { code: 0, message: 'ok', data: { list: [] } }
  }
}
