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
    const REWARDS = { first_chat: 10, first_letter: 10, first_like: 5, dna_done: 20, chat_10: 30, chat_50: 80, letter_5: 50, comment_10: 30, first_memorial: 20, memorial_5: 80, read_book: 15, all_dynasties: 200, collector: 500, time_master: 1000 }
    const reward = REWARDS[key] || 0
    achievements.push({ key, unlockedAt: new Date() })
    await db.collection('users').doc(user._id).update({
      data: { achievements, points: db.command.inc(reward), updatedAt: db.serverDate() }
    })
  } catch (e) { console.warn('tryUnlock fail', key, e.message) }
}

const MAX_LIMIT = 100

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action = 'list' } = event
  const data = normalizeEventData(event)

  try {
    switch (action) {
      case 'list': return await listMoments(OPENID, data)
      case 'detail': return await getDetail(OPENID, data)
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

function normalizeRemoteAssetUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const value = url.trim()
  if (!value) return ''
  if (/^(wxfile|http:\/\/tmp|https?:\/\/tmp|https?:\/\/127\.0\.0\.1|https?:\/\/localhost|\/tmp\/|tmp\/)/i.test(value)) {
    return ''
  }
  if (/^(https?:\/\/|cloud:\/\/)/i.test(value)) return value
  return ''
}

function normalizeImageList(images) {
  if (!Array.isArray(images)) return []
  return images.map(normalizeRemoteAssetUrl).filter(Boolean).slice(0, 9)
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

// 批量查询 figures 集合获取角色头像等信息
async function batchFetchFigures(figureIds) {
  const figureMap = {}
  if (!figureIds || !figureIds.length) return figureMap
  const aliasMap = {}
  figureIds.filter(Boolean).forEach(id => {
    const value = String(id)
    const aliases = value.indexOf('fig-') === 0 ? [value, value.slice(4)] : [value, 'fig-' + value]
    aliases.forEach(alias => {
      if (!aliasMap[alias]) aliasMap[alias] = value
    })
  })
  const uniqueIds = Object.keys(aliasMap)
  if (!uniqueIds.length) return figureMap
  
  try {
    // 云数据库单次 in 查询最多支持 100 条
    const batches = []
    for (let i = 0; i < uniqueIds.length; i += 100) {
      batches.push(uniqueIds.slice(i, i + 100))
    }
    for (const batch of batches) {
      const fields = {
        id: true,
        figureId: true,
        name: true,
        figureName: true,
        identity: true,
        title: true,
        figureTitle: true,
        avatar_url: true,
        mini_avatar_url: true,
        avatar: true,
        dynasty: true
      }
      const byId = await db.collection('figures')
        .where({ id: _.in(batch) })
        .field(fields)
        .limit(batch.length)
        .get()
      const byFigureId = await db.collection('figures')
        .where({ figureId: _.in(batch) })
        .field(fields)
        .limit(batch.length)
        .get()
      ;[].concat(byId.data || [], byFigureId.data || []).forEach(f => {
        const keys = [f.id, f.figureId].filter(Boolean)
        keys.forEach(key => {
          figureMap[key] = f
          if (key.indexOf('fig-') === 0) figureMap[key.slice(4)] = f
          else figureMap['fig-' + key] = f
        })
      })
    }
  } catch (e) {
    console.warn('batchFetchFigures error:', e.message)
  }
  return figureMap
}

function buildFigureView(row, figureData = null) {
  // 优先使用从 figures 表查到的数据
  const f = figureData || {}
  const avatarRaw = f.mini_avatar_url || f.avatar_url || f.avatar || row.avatar || row.authorAvatar || row.mini_avatar_url || row.avatar_url || ''
  return {
    id: row.figureId || f.figureId || f.id || row._openid || '',
    name: f.figureName || f.name || row.figureName || row.name || row.authorName || '匿名古人',
    title: f.figureTitle || f.title || f.identity || row.figureTitle || row.authorTitle || '',
    avatar: normalizeRemoteAssetUrl(avatarRaw),
    mini_avatar_url: avatarRaw,
    avatar_url: f.avatar_url || row.avatar_url || '',
    dynasty: f.dynasty || row.dynasty || ''
  }
}

function buildHistoricalView(row) {
  if (!row.historicalEvent && !row.historicalDate) return null
  return {
    event: row.historicalEvent || '',
    date: row.historicalDate || '',
    articleId: row.historicalArticleId || '',
    chapterId: row.historicalChapterId || ''
  }
}

function buildLikePreview(likes, limit = 10) {
  if (!likes || !likes.length) return []
  const list = []
  for (let i = 0; i < Math.min(likes.length, limit); i++) {
    const l = likes[i]
    if (typeof l === 'string') {
      list.push({ id: l, name: l })
    } else {
      list.push({
        id: l.openid || l.id || '',
        name: l.name || l.figureName || '匿名'
      })
    }
  }
  return list
}

async function buildCommentPreview(momentId, limit = 2, figureMap = {}) {
  try {
    const r = await db.collection('moment_comments')
      .where({ momentId })
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get()
    
    // 收集评论中的 figureId，批量查询头像
    const commentFigureIds = r.data.map(c => c.figureId).filter(Boolean)
    let commentFigureMap = figureMap
    if (commentFigureIds.length) {
      const missingIds = commentFigureIds.filter(id => !figureMap[id])
      if (missingIds.length) {
        const extraMap = await batchFetchFigures(missingIds)
        commentFigureMap = { ...figureMap, ...extraMap }
      }
    }
    
    return r.data.map(c => {
      const figureData = c.figureId ? commentFigureMap[c.figureId] : null
      const f = figureData || {}
      const avatarRaw = f.mini_avatar_url || f.avatar_url || f.avatar || c.avatar || c.authorSnapshot?.avatar || ''
      return {
        id: c._id,
        figureId: c.figureId || '',
        name: f.figureName || f.name || c.name || c.authorSnapshot?.name || '匿名',
        avatar: normalizeRemoteAssetUrl(avatarRaw),
        mini_avatar_url: avatarRaw,
        avatar_url: f.avatar_url || '',
        dynasty: f.dynasty || c.dynasty || '',
        content: c.content || '',
        replyTo: c.replyTo || '',
        replyName: c.replyName || ''
      }
    })
  } catch (e) {
    return []
  }
}

// 批量查询多个 moment 的前 N 条评论，消除列表页 N+1 查询
async function batchFetchCommentPreviews(momentIds, figureMap = {}, limit = 2) {
  const result = {}
  if (!momentIds || !momentIds.length) return result
  try {
    const r = await db.collection('moment_comments')
      .where({ momentId: _.in(momentIds) })
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get()
    const grouped = {}
    ;(r.data || []).forEach(c => {
      if (!grouped[c.momentId]) grouped[c.momentId] = []
      if (grouped[c.momentId].length < limit) grouped[c.momentId].push(c)
    })
    // 收集所有评论的 figureId 批量补全
    const allFigureIds = []
    Object.values(grouped).forEach(list => {
      list.forEach(c => { if (c.figureId) allFigureIds.push(c.figureId) })
    })
    const missingIds = allFigureIds.filter(id => !figureMap[id])
    let extraMap = {}
    if (missingIds.length) {
      extraMap = await batchFetchFigures(Array.from(new Set(missingIds)))
    }
    const mergedMap = { ...figureMap, ...extraMap }
    Object.keys(grouped).forEach(mid => {
      result[mid] = grouped[mid].map(c => {
        const figureData = c.figureId ? mergedMap[c.figureId] : null
        const f = figureData || {}
        const avatarRaw = f.mini_avatar_url || f.avatar_url || f.avatar || c.avatar || (c.authorSnapshot && c.authorSnapshot.avatar) || ''
        return {
          id: c._id,
          figureId: c.figureId || '',
          name: f.figureName || f.name || c.name || (c.authorSnapshot && c.authorSnapshot.name) || '匿名',
          avatar: normalizeRemoteAssetUrl(avatarRaw),
          mini_avatar_url: avatarRaw,
          avatar_url: f.avatar_url || '',
          dynasty: f.dynasty || c.dynasty || '',
          content: c.content || '',
          replyTo: c.replyTo || '',
          replyName: c.replyName || ''
        }
      })
    })
  } catch (e) {
    console.warn('batchFetchCommentPreviews error:', e.message)
  }
  return result
}

async function buildMomentView(row, openid, options = {}) {
  const { withCommentPreview = true, figureMap = {}, commentPreview: presetCommentPreview } = options
  const likes = row.likes || []
  const liked = likes.some(l => (typeof l === 'string' ? l : l.openid) === openid)
  const likeCount = likes.length
  const likePreview = buildLikePreview(likes)
  const commentCount = typeof row.commentCount === 'number' ? row.commentCount : 0
  let commentPreview = []
  if (Array.isArray(presetCommentPreview)) {
    commentPreview = presetCommentPreview
  } else if (withCommentPreview && commentCount > 0) {
    commentPreview = await buildCommentPreview(row._id, 2, figureMap)
  }

  const ts = row.createdAt
  let createdAtMs = 0
  if (ts instanceof Date) createdAtMs = ts.getTime()
  else if (typeof ts === 'number') createdAtMs = ts > 1e12 ? ts : ts * 1000

  // 获取对应的 figure 数据
  const figureData = row.figureId ? figureMap[row.figureId] : null

  return {
    _id: row._id,
    figure: buildFigureView(row, figureData),
    content: row.content || '',
    images: normalizeImageList(row.images),
    historical: buildHistoricalView(row),
    location: row.location || '',
    createdAt: createdAtMs,
    interaction: {
      liked,
      likeCount,
      likePreview,
      commentCount,
      commentPreview
    }
  }
}

async function listMoments(OPENID, data) {
  const { figureId, cursor = '', limit = 20, dynasty = '' } = data
  const pageLimit = Math.min(limit, 50)
  let where = {}
  if (figureId) where.figureId = figureId
  if (dynasty && dynasty !== 'all') where.dynasty = dynasty

  let q = db.collection('moments').where(where).orderBy('createdAt', 'desc')
  if (cursor) {
    // cursor 失效（上一页最后一条被删除等）时直接返回空，避免重复返回第一页
    let last = null
    try {
      const r = await db.collection('moments').doc(cursor).get()
      if (r && r.data) last = r.data
    } catch (_) { last = null }
    if (!last) {
      return { code: 0, message: 'ok', data: { moments: [], nextCursor: '', hasMore: false } }
    }
    const ts = last.createdAt instanceof Date ? last.createdAt : new Date(last.createdAt)
    where.createdAt = _.lte(ts)
    where._id = _.neq(cursor)
    q = db.collection('moments').where(where).orderBy('createdAt', 'desc')
  }
  q = q.limit(pageLimit + 1)

  const res = await q.get()
  const rows = res.data || []
  const hasMore = rows.length > pageLimit
  const sliced = hasMore ? rows.slice(0, pageLimit) : rows

  // 批量查询所有动态对应的 figure 信息（头像、名称等）
  const figureIds = sliced.map(r => r.figureId).filter(Boolean)
  const figureMap = await batchFetchFigures(figureIds)

  // 批量查询所有动态的前 2 条评论，消除 N+1
  const commentPreviewMap = await batchFetchCommentPreviews(sliced.map(r => r._id), figureMap)

  const moments = []
  for (const r of sliced) {
    moments.push(await buildMomentView(r, OPENID, { figureMap, commentPreview: commentPreviewMap[r._id] || [] }))
  }
  const nextCursor = hasMore ? sliced[sliced.length - 1]._id : ''

  return {
    code: 0,
    message: 'ok',
    data: { moments, nextCursor, hasMore }
  }
}

async function getDetail(OPENID, data) {
  const { momentId } = data
  if (!momentId) return { code: -1, message: '缺少 momentId' }
  const doc = await db.collection('moments').doc(momentId).get()
  if (!doc.data) return { code: -1, message: '动态不存在' }
  // 查询对应的 figure 信息
  const figureMap = doc.data.figureId ? await batchFetchFigures([doc.data.figureId]) : {}
  const moment = await buildMomentView(doc.data, OPENID, { withCommentPreview: false, figureMap })
  return { code: 0, message: 'ok', data: { moment } }
}

async function toggleLike(OPENID, data) {
  const { momentId } = data
  if (!momentId) return { code: -1, message: '缺少 momentId' }

  // 事务前查当前用户昵称，写入点赞快照，避免 likePreview 全显示「匿名」
  let userName = '匿名'
  try {
    const u = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (u && u.data && u.data.length) {
      const user = u.data[0]
      userName = user.nickName || user.nickname || user.name || userName
    }
  } catch (_) {}

  try {
    const result = await db.runTransaction(async transaction => {
      const snapshot = await transaction.collection('moments').doc(momentId).get()
      if (!snapshot.data) {
        await transaction.rollback('动态不存在')
        return null
      }
      const doc = snapshot.data
      const likes = Array.isArray(doc.likes) ? doc.likes : []
      const idx = likes.findIndex(l => (typeof l === 'string' ? l : l.openid) === OPENID)
      const liked = idx === -1
      let nextLikes
      if (liked) {
        nextLikes = likes.concat([{ openid: OPENID, name: userName, at: new Date() }])
      } else {
        nextLikes = likes.filter(l => (typeof l === 'string' ? l : l.openid) !== OPENID)
      }
      await transaction.collection('moments').doc(momentId).update({
        data: {
          likes: nextLikes,
          updatedAt: new Date()
        }
      })
      return {
        liked,
        likes: nextLikes
      }
    })

    if (!result) return { code: -1, message: '动态不存在' }

    if (result.liked) {
      await tryUnlock(OPENID, 'first_like')
    }

    const latestLikes = result.likes || []
    const likeCount = latestLikes.length
    const likePreview = buildLikePreview(latestLikes)

    return {
      code: 0,
      message: 'ok',
      data: { liked: result.liked, likeCount, likePreview }
    }
  } catch (e) {
    console.error('toggleLike transaction error:', e)
    return { code: -1, message: e && e.message ? e.message : '点赞失败' }
  }
}

async function listComments(OPENID, data) {
  const { momentId, cursor = '', limit = 30 } = data
  if (!momentId) return { code: -1, message: '缺少 momentId' }
  const pageLimit = Math.min(limit, MAX_LIMIT)
  let where = { momentId }
  let q = db.collection('moment_comments').where(where).orderBy('createdAt', 'asc')
  if (cursor) {
    try {
      const last = await db.collection('moment_comments').doc(cursor).get()
      if (last && last.data) {
        const ts = last.data.createdAt instanceof Date
          ? last.data.createdAt
          : new Date(last.data.createdAt)
        where.createdAt = _.gte(ts)
        where._id = _.neq(cursor)
        q = db.collection('moment_comments').where(where).orderBy('createdAt', 'asc')
      }
    } catch (_) {}
  }
  q = q.limit(pageLimit + 1)

  const res = await q.get()
  const rows = res.data || []
  const hasMore = rows.length > pageLimit
  const sliced = hasMore ? rows.slice(0, pageLimit) : rows

  // 批量查询评论对应的 figure 头像信息
  const commentFigureIds = sliced.map(c => c.figureId).filter(Boolean)
  const figureMap = await batchFetchFigures(commentFigureIds)

  const comments = sliced.map(c => {
    const ts = c.createdAt
    let createdAtMs = 0
    if (ts instanceof Date) createdAtMs = ts.getTime()
    else if (typeof ts === 'number') createdAtMs = ts > 1e12 ? ts : ts * 1000
    const figureData = c.figureId ? figureMap[c.figureId] : null
    const f = figureData || {}
    const avatarRaw = f.mini_avatar_url || f.avatar_url || f.avatar || c.avatar || c.authorSnapshot?.avatar || ''
    return {
      _id: c._id,
      momentId: c.momentId,
      figure: {
        id: c.figureId || f.figureId || f.id || c._openid || '',
        name: f.figureName || f.name || c.name || c.authorSnapshot?.name || '匿名',
        title: f.figureTitle || f.title || f.identity || c.figureTitle || '',
        avatar: normalizeRemoteAssetUrl(avatarRaw),
        mini_avatar_url: avatarRaw,
        avatar_url: f.avatar_url || '',
        dynasty: f.dynasty || c.dynasty || ''
      },
      content: c.content || '',
      replyTo: c.replyTo || '',
      replyName: c.replyName || '',
      likeCount: (c.likes || []).length,
      createdAt: createdAtMs,
      canDelete: c._openid === OPENID
    }
  })
  const nextCursor = hasMore ? sliced[sliced.length - 1]._id : ''

  return {
    code: 0,
    message: 'ok',
    data: { comments, nextCursor, hasMore }
  }
}

async function createComment(OPENID, data) {
  const { momentId, content, replyTo = '', replyName = '' } = data
  if (!momentId || !content || !content.trim()) return { code: -1, message: '参数不全' }

  const sec = await secCheckText(content, OPENID)
  if (!sec.ok) return { code: 403, message: sec.reason }

  let nickname = '匿名'
  let avatar = ''
  let dynasty = ''
  let figureId = ''
  let figureTitle = ''
  try {
    const u = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (u && u.data && u.data.length) {
      const user = u.data[0]
      nickname = user.nickName || user.nickname || user.name || nickname
      avatar = normalizeRemoteAssetUrl(user.avatarUrl || user.avatar || avatar)
      dynasty = user.dynasty || ''
      figureId = user.figureId || ''
      figureTitle = user.figureTitle || ''
    }
  } catch (_) {}

  const doc = {
    momentId,
    content: content.trim(),
    replyTo,
    replyName,
    figureId,
    figureTitle,
    dynasty,
    name: nickname,
    avatar,
    authorSnapshot: { name: nickname, avatar, openid: OPENID },
    likes: [],
    createdAt: db.serverDate()
  }
  const r = await db.collection('moment_comments').add({ data: doc })

  // 成就解锁：直接 await，避免云函数 return 后异步任务被冻结
  try {
    const cnt = await db.collection('moment_comments').where({ _openid: OPENID }).count()
    if ((cnt.total || 0) >= 10) await tryUnlock(OPENID, 'comment_10')
  } catch (e) {}

  // 更新 moment 的 commentCount；get 失败时返回 null，前端保留本地 +1 的值，不返回错误的 1/0
  let finalCommentCount = null
  try {
    await db.collection('moments').doc(momentId).update({
      data: { commentCount: _.inc(1), updatedAt: db.serverDate() }
    })
    try {
      const md = await db.collection('moments').doc(momentId).get()
      if (md && md.data && typeof md.data.commentCount === 'number') {
        finalCommentCount = md.data.commentCount
      }
    } catch (_) {}
  } catch (_) {}

  const ts = doc.createdAt instanceof Date ? doc.createdAt.getTime() : Date.now()
  const comment = {
    _id: r._id,
    momentId,
    figure: {
      id: figureId || OPENID,
      name: nickname,
      title: figureTitle,
      avatar,
      dynasty
    },
    content: doc.content,
    replyTo,
    replyName,
    likeCount: 0,
    createdAt: ts,
    canDelete: true
  }

  return {
    code: 0,
    message: 'ok',
    data: { comment, commentCount: finalCommentCount }
  }
}

async function removeComment(OPENID, data) {
  const { commentId } = data
  if (!commentId) return { code: -1, message: '缺少 commentId' }
  const c = await db.collection('moment_comments').doc(commentId).get()
  if (!c.data) return { code: -1, message: '评论不存在' }
  if (c.data._openid !== OPENID) return { code: 403, message: '无权删除' }
  const momentId = c.data.momentId
  await db.collection('moment_comments').doc(commentId).remove()
  let finalCommentCount = null
  try {
    await db.collection('moments').doc(momentId).update({
      data: { commentCount: _.inc(-1), updatedAt: db.serverDate() }
    })
    try {
      const md = await db.collection('moments').doc(momentId).get()
      if (md && md.data && typeof md.data.commentCount === 'number') {
        finalCommentCount = Math.max(0, md.data.commentCount)
      }
    } catch (_) {}
  } catch (_) {}
  return { code: 0, message: 'ok', data: { commentCount: finalCommentCount } }
}
