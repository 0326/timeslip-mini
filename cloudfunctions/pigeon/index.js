const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function tryUnlock(OPENID, key) {
  try {
    const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (!userRes.data || !userRes.data.length) return
    const user = userRes.data[0]
    const achievements = user.achievements || []
    if (achievements.some(a => a.key === key)) return
    const REWARDS = { first_chat: 10, first_letter: 10, first_like: 5, dna_done: 20, chat_10: 30, chat_50: 80, letter_5: 50, comment_10: 30, first_memorial: 20, memorial_5: 80, figure_10: 60, read_book: 15, all_dynasties: 200, collector: 500, time_master: 1000 }
    const reward = REWARDS[key] || 0
    achievements.push({ key, unlockedAt: new Date() })
    await db.collection('users').doc(user._id).update({
      data: { achievements, points: db.command.inc(reward), updatedAt: db.serverDate() }
    })
  } catch (e) { console.warn('tryUnlock fail', key, e.message) }
}

const PAPER_STYLES = [
  { key: 'rice', name: '宣纸', color: '#F5ECD7', desc: '唐代文人标配，古雅质朴' },
  { key: 'jade', name: '玉帛', color: '#EAF6F5', desc: '温润如玉，淡雅脱俗' },
  { key: 'bamboo', name: '竹简', color: '#F0E6C8', desc: '秦汉风骨，字字珠玑' }
]

const FIGURES = [
  { figureId: 'libai', figureName: '李白', style: '豪放飘逸' },
  { figureId: 'sushi', figureName: '苏轼', style: '旷达幽默' },
  { figureId: 'xiangyu', figureName: '项羽', style: '豪迈悲壮' },
  { figureId: 'caocao', figureName: '曹操', style: '沉雄霸气' },
  { figureId: 'wuzetian', figureName: '武则天', style: '庄重威严' },
  { figureId: 'mulan', figureName: '花木兰', style: '飒爽真挚' },
  { figureId: 'simaqian', figureName: '司马迁', style: '严谨深厚' },
  { figureId: 'kongzi', figureName: '孔子', style: '谆谆教诲' },
  { figureId: 'zhenghe', figureName: '郑和', style: '稳健开阔' },
  { figureId: 'baijuyi', figureName: '白居易', style: '质朴通俗' }
]

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action = 'send' } = event
  const data = normalizeEventData(event)
  try {
    switch (action) {
      case 'send': return await sendLetter(OPENID, data)
      case 'inbox': return await getInbox(OPENID, data)
      case 'read': return await markRead(OPENID, data)
      case 'delete': return await deleteLetter(OPENID, data)
      case 'styles': return { code: 0, message: 'ok', data: PAPER_STYLES }
      case 'figures': return { code: 0, message: 'ok', data: FIGURES }
      default: return { code: -1, message: '未知 pigeon action: ' + action }
    }
  } catch (err) {
    console.error('pigeon err', err)
    return { code: -1, message: err.message }
  }
}

function normalizeEventData(event) {
  const { action, data, ...rest } = event || {}
  return data && typeof data === 'object' ? { ...rest, ...data } : rest
}

async function sec(text, oid) {
  if (!text) return { ok: true }
  try {
    const r = await cloud.openapi.security.msgSecCheck({ openid: oid, version: 2, scene: 1, content: text })
    if (r && r.result && r.result.suggest !== 'pass') return { ok: false, reason: '内容不当' }
    return { ok: true }
  } catch (e) {
    return { ok: true }
  }
}

async function sendLetter(OPENID, data) {
  const { figureId, content, subject = '', paperStyle = 'rice', fromName = '某', seal = '' } = data
  if (!figureId || !content || !content.trim()) return { code: -1, message: '参数错误' }
  const s1 = await sec(content, OPENID), s2 = await sec(subject, OPENID)
  if (!s1.ok) return { code: 403, message: s1.reason }
  if (!s2.ok) return { code: 403, message: s2.reason }

  const fig = FIGURES.find(f => f.figureId === figureId)
  const now = db.serverDate()
  const userLetterId = 'pl_' + Date.now()
  const replyId = 'pr_' + (Date.now() + 1)

  await db.collection('letters').add({
    data: {
      _id: userLetterId,
      type: 'outbox',
      _openid: OPENID,
      figureId,
      figureName: fig ? fig.figureName : '古人',
      subject,
      content: content.trim(),
      paperStyle,
      fromName,
      seal,
      read: true,
      createdAt: now
    }
  })

  const replyContent = generateReply(fig, content, subject)
  const replyDoc = {
    _id: replyId,
    type: 'inbox',
    _openid: OPENID,
    figureId,
    figureName: fig ? fig.figureName : '古人',
    subject: '复：' + (subject || '来信'),
    content: replyContent,
    paperStyle,
    seal: fig ? fig.figureName + '印' : '',
    deliveryTime: Date.now() + 5000 + Math.floor(Math.random() * 15000),
    read: false,
    createdAt: now
  }
  await db.collection('letters').add({ data: replyDoc })

  tryUnlock(OPENID, 'first_letter')
  ;(async () => {
    try {
      const cnt = await db.collection('letters').where({ _openid: OPENID, type: 'inbox' }).count()
      if ((cnt.total || 0) >= 5) await tryUnlock(OPENID, 'letter_5')
    } catch (e) {}
  })()

  return { code: 0, message: 'ok', data: { userLetterId, replyId, replyContent, deliveryTime: replyDoc.deliveryTime } }
}

function generateReply(fig, content, subject) {
  const style = fig ? fig.style : '诚恳'
  const pool = {
    '豪放飘逸': [
      `噫！得此来函，如沐春风。读君所言，令某拍案而起，欲浮一大白！\n\n人生飘忽百年内，且须酣畅万古情。君若不弃，他日同游山川，何如？`,
      `「黄河之水天上来，奔流到海不复回！」\n\n君之信，亦是如此气势。幸甚至哉！`
    ],
    '旷达幽默': [
      `竹杖芒鞋轻胜马，一蓑烟雨任平生。\n\n读君来信，颇感亲切。人生如逆旅，我亦是行人。共勉之。`,
      `问汝平生功业？黄州惠州儋州。哈哈，与君笑谈。`
    ],
    default: [
      `手书已至，喜不自胜。\n\n蒙君垂询，某深感于心。此复此复，再拜。`,
      `来信已阅，所言之事，某已知悉。\n\n愿君长乐，岁稔年丰。`
    ]
  }
  const arr = pool[style] || pool.default
  return arr[Math.floor(Math.random() * arr.length)]
}

async function getInbox(OPENID, data) {
  const { type = 'all', limit = 50 } = data
  let where = { _openid: OPENID }
  if (['inbox', 'outbox'].includes(type)) where.type = type
  const r = await db.collection('letters')
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(limit, 100))
    .get()
  return { code: 0, message: 'ok', data: r.data }
}

async function markRead(OPENID, data) {
  const { _id } = data
  if (!_id) return { code: -1, message: '缺少 id' }
  const c = await db.collection('letters').doc(_id).get()
  if (!c.data) return { code: -1, message: '信件不存在' }
  if (c.data._openid !== OPENID) return { code: 403, message: '无权限' }
  await db.collection('letters').doc(_id).update({ data: { read: true } })
  return { code: 0, message: 'ok' }
}

async function deleteLetter(OPENID, data) {
  const { _id } = data
  if (!_id) return { code: -1, message: '缺少 _id' }
  const c = await db.collection('letters').doc(_id).get()
  if (!c.data) return { code: -1, message: '不存在' }
  if (c.data._openid !== OPENID) return { code: 403, message: '无权限' }
  await db.collection('letters').doc(_id).remove()
  return { code: 0, message: 'ok' }
}
