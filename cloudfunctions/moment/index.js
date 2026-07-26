const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action = 'list' } = event
  const data = normalizeEventData(event)

  try {
    switch (action) {
      case 'list': return await listMoments(OPENID, data)
      case 'create': return await createMoment(OPENID, data)
      case 'remove': return await removeMoment(OPENID, data)
      case 'like': return await toggleLike(OPENID, data)
      case 'commentCreate': return await createComment(OPENID, data)
      case 'commentList': return await listComments(OPENID, data)
      case 'commentRemove': return await removeComment(OPENID, data)
      default: return { code: -1, message: '未知 moment action: ' + action }
    }
  } catch (err) {
    console.error('moment err:', err)
    return { code: -1, message: err.message || '动态服务异常' }
  }
}

function normalizeEventData(event) {
  const { action, data, ...rest } = event || {}
  return data && typeof data === 'object' ? { ...rest, ...data } : rest
}

async function secCheckText(text, openid) {
  if (!text) return { ok: true }
  try {
    const r = await cloud.openapi.security.msgSecCheck({
      openid, version: 2, scene: 1, content: text
    })
    if (r && r.result && r.result.suggest !== 'pass') {
      return { ok: false, reason: '内容包含不当信息' }
    }
    return { ok: true }
  } catch (e) {
    console.warn('msgSecCheck warn', e)
    return { ok: true }
  }
}

async function listMoments(OPENID, data) {
  const { figureId, lastId = '', limit = 20, type = 'all' } = data
  let where = {}
  if (figureId) where.figureId = figureId
  if (type === 'following') where._openid = OPENID

  const q = db.collection('moments').where(where)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(limit, 50))

  const res = await q.get()
  const rows = await populateMoments(res.data, OPENID)
  return { code: 0, message: 'ok', data: rows }
}

async function populateMoments(rows, openid) {
  if (!rows.length) return rows
  const userIds = [...new Set(rows.map(r => r._openid).filter(Boolean))]
  let users = {}
  if (userIds.length) {
    try {
      const u = await db.collection('users').where({
        _openid: _.in(userIds)
      }).get()
      u.data.forEach(x => { users[x._openid] = x })
    } catch (_) {}
  }
  return rows.map(r => {
    const u = users[r._openid] || {}
    const likes = r.likes || []
    return {
      ...r,
      authorName: r.name || u.nickname || '匿名古人',
      authorAvatar: r.avatar || u.avatar || '',
      authorTitle: r.figureTitle || '',
      liked: likes.some(l => (typeof l === 'string' ? l : l.openid) === openid),
      likeCount: likes.length
    }
  })
}

async function createMoment(OPENID, data) {
  const { figureId, name, avatar, figureTitle, dynasty, content, images = [], location = '', visibility = 'public' } = data
  if (!content || !content.trim()) return { code: -1, message: '内容不可为空' }

  const sec = await secCheckText(content, OPENID)
  if (!sec.ok) return { code: 403, message: sec.reason }

  const doc = {
    figureId: figureId || '',
    name: name || '',
    avatar: avatar || '',
    figureTitle: figureTitle || '',
    dynasty: dynasty || '',
    content: content.trim(),
    images: images.slice(0, 9),
    location,
    visibility,
    likes: [],
    commentCount: 0,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }
  const r = await db.collection('moments').add({ data: doc })
  return { code: 0, message: 'ok', data: { _id: r._id, ...doc } }
}

async function removeMoment(OPENID, data) {
  const { _id } = data
  if (!_id) return { code: -1, message: '缺少 _id' }
  const check = await db.collection('moments').doc(_id).get()
  if (!check.data) return { code: -1, message: '动态不存在' }
  if (check.data._openid !== OPENID) return { code: 403, message: '无权删除' }
  await db.collection('moments').doc(_id).remove()
  try {
    await db.collection('moment_comments').where({ momentId: _id }).remove()
  } catch (_) {}
  return { code: 0, message: 'ok' }
}

async function toggleLike(OPENID, data) {
  const { momentId } = data
  if (!momentId) return { code: -1, message: '缺少 momentId' }
  const doc = await db.collection('moments').doc(momentId).get()
  if (!doc.data) return { code: -1, message: '动态不存在' }
  const likes = doc.data.likes || []
  const idx = likes.findIndex(l => (typeof l === 'string' ? l : l.openid) === OPENID)
  let newLikes
  if (idx === -1) newLikes = _.push([{ openid: OPENID, at: new Date() }])
  else newLikes = _.pull({ openid: OPENID })
  await db.collection('moments').doc(momentId).update({
    data: { likes: newLikes, updatedAt: db.serverDate() }
  })
  return { code: 0, message: 'ok', data: { liked: idx === -1 } }
}

async function listComments(OPENID, data) {
  const { momentId, limit = 30 } = data
  if (!momentId) return { code: -1, message: '缺少 momentId' }
  const r = await db.collection('moment_comments')
    .where({ momentId })
    .orderBy('createdAt', 'asc')
    .limit(Math.min(limit, 100))
    .get()
  return { code: 0, message: 'ok', data: r.data }
}

async function createComment(OPENID, data) {
  const { momentId, content, replyTo = '', replyName = '', name = '', avatar = '', dynasty = '' } = data
  if (!momentId || !content || !content.trim()) return { code: -1, message: '参数不全' }
  const sec = await secCheckText(content, OPENID)
  if (!sec.ok) return { code: 403, message: sec.reason }

  const doc = {
    momentId,
    content: content.trim(),
    replyTo,
    replyName,
    name: name || '匿名',
    avatar,
    dynasty,
    likes: [],
    createdAt: db.serverDate()
  }
  const r = await db.collection('moment_comments').add({ data: doc })
  try {
    await db.collection('moments').doc(momentId).update({
      data: { commentCount: _.inc(1), updatedAt: db.serverDate() }
    })
  } catch (_) {}
  return { code: 0, message: 'ok', data: { _id: r._id, ...doc } }
}

async function removeComment(OPENID, data) {
  const { commentId } = data
  if (!commentId) return { code: -1, message: '缺少 commentId' }
  const c = await db.collection('moment_comments').doc(commentId).get()
  if (!c.data) return { code: -1, message: '评论不存在' }
  if (c.data._openid !== OPENID) return { code: 403, message: '无权删除' }
  await db.collection('moment_comments').doc(commentId).remove()
  try {
    await db.collection('moments').doc(c.data.momentId).update({
      data: { commentCount: _.inc(-1), updatedAt: db.serverDate() }
    })
  } catch (_) {}
  return { code: 0, message: 'ok' }
}
