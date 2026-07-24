const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 默认解锁的人物（无需 user_figures 记录即视为已解锁）
const DEFAULT_UNLOCKED = ['fig-huangdi', 'fig-simqian', 'fig-liubang', 'fig-hanwu', 'fig-zhugeliang', 'fig-libai', 'fig-sushi', 'fig-yuefei']

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action, data = {} } = event
  try {
    switch (action) {
      case 'figure-list': return await figureList(OPENID, data)
      case 'figure-detail': return await figureDetail(OPENID, data)
      case 'figure-unlock': return await figureUnlock(OPENID, data)
      case 'figures': return await figureList(OPENID, data) // 兼容旧 action
      case 'figureDetail': return await figureDetail(OPENID, data) // 兼容旧 action
      case 'book-list': return await bookList(OPENID, data)
      case 'book-detail': return await bookDetail(OPENID, data)
      case 'books': return await bookList(OPENID, data) // 兼容
      case 'book-favorites': return await bookFavorites(OPENID, data)
      case 'book-favoriteToggle': return await bookFavToggle(OPENID, data)
      default: return { code: -1, message: '未知 action: ' + action }
    }
  } catch (e) {
    console.error('shiji err:', e)
    return { code: -1, message: e.message }
  }
}

async function figureList(OPENID, data) {
  const { unlockedOnly = false } = data
  let unlocked = new Set(DEFAULT_UNLOCKED)
  try {
    const r = await db.collection('user_figures').where({ _openid: OPENID }).get()
    r.data.forEach(x => unlocked.add(x.figureId))
  } catch (_) {}

  let list = []
  try {
    const r = await db.collection('historical_figures')
      .orderBy('initial', 'asc')
      .limit(100)
      .get()
    list = r.data || []
  } catch (e) {
    return { code: 0, message: 'ok', data: [] }
  }

  const result = list.map(f => ({
    ...f,
    _id: f.figureId, // 兼容前端旧字段
    name: f.figureName, // 兼容前端旧字段
    unlocked: unlocked.has(f.figureId)
  }))

  return {
    code: 0, message: 'ok',
    data: unlockedOnly ? result.filter(f => f.unlocked) : result
  }
}

async function figureDetail(OPENID, data) {
  const { figureId, id } = data
  const targetId = figureId || id
  if (!targetId) return { code: -1, message: '缺少 figureId' }

  let f = null
  try {
    const r = await db.collection('historical_figures').where({ figureId: targetId }).limit(1).get()
    if (r.data && r.data.length) f = r.data[0]
  } catch (_) {}

  if (!f) return { code: -1, message: '人物不存在' }

  let unlocked = DEFAULT_UNLOCKED.includes(targetId)
  try {
    const r = await db.collection('user_figures').where({ _openid: OPENID, figureId: targetId }).limit(1).get()
    if (r.data.length) unlocked = true
  } catch (_) {}

  // 关联典籍
  let relatedBooks = []
  try {
    const bRes = await db.collection('books').where({ figures: db.command.in([targetId]) }).get()
    relatedBooks = (bRes.data || []).map(b => ({
      id: b.bookId || b._id,
      title: b.title,
      chapter: (b.chapters || 0) + '篇'
    }))
  } catch (_) {}

  return {
    code: 0, message: 'ok',
    data: {
      ...f,
      _id: f.figureId,
      name: f.figureName,
      unlocked,
      relatedBooks
    }
  }
}

async function figureUnlock(OPENID, data) {
  const { figureId, cost = 100 } = data
  if (!figureId) return { code: -1, message: '缺少 figureId' }
  try {
    const check = await db.collection('user_figures').where({ _openid: OPENID, figureId }).limit(1).get()
    if (check.data.length) return { code: 0, message: '已解锁', data: { already: true } }
    await db.collection('user_figures').add({
      data: { figureId, unlockedAt: db.serverDate(), cost }
    })
    return { code: 0, message: '解锁成功' }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

async function bookList(OPENID, data) {
  try {
    const r = await db.collection('books').orderBy('dynasty', 'asc').limit(50).get()
    const list = (r.data || []).map(b => ({
      ...b,
      id: b.bookId || b._id
    }))
    return { code: 0, message: 'ok', data: list }
  } catch (e) {
    return { code: 0, message: 'ok', data: [] }
  }
}

async function bookDetail(OPENID, data) {
  const { bookId, _id } = data
  const targetId = bookId || _id
  if (!targetId) return { code: -1, message: '缺少 bookId' }
  try {
    const r = await db.collection('books').where(db.command.or([
      { bookId: targetId },
      { _id: targetId }
    ])).limit(1).get()
    if (!r.data || !r.data.length) return { code: -1, message: '典籍不存在' }
    return { code: 0, message: 'ok', data: r.data[0] }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

async function bookFavorites(OPENID, data) {
  try {
    const r = await db.collection('book_favorites').where({ _openid: OPENID }).get()
    const favIds = new Set(r.data.map(x => x.bookId))
    const bRes = await db.collection('books').limit(50).get()
    const list = (bRes.data || []).map(b => ({ ...b, favorite: favIds.has(b.bookId || b._id) }))
    return { code: 0, message: 'ok', data: list.filter(b => b.favorite) }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

async function bookFavToggle(OPENID, data) {
  const { bookId } = data
  if (!bookId) return { code: -1, message: '缺少 bookId' }
  try {
    const r = await db.collection('book_favorites').where({ _openid: OPENID, bookId }).limit(1).get()
    if (r.data.length) {
      await db.collection('book_favorites').doc(r.data[0]._id).remove()
      return { code: 0, message: 'ok', data: { favorite: false } }
    }
    await db.collection('book_favorites').add({
      data: { bookId, createdAt: db.serverDate() }
    })
    return { code: 0, message: 'ok', data: { favorite: true } }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
