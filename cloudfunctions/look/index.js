const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const LOOK_COVER_FILE_PREFIX = 'cloud://cloud1-d0gunpzup215cfd87.636c-cloud1-d0gunpzup215cfd87-1457646459/look/'

function normalizeArticleAsset(article) {
  if (!article || typeof article !== 'object') return article

  const normalized = { ...article }
  if (typeof normalized.coverImage === 'string') {
    const match = normalized.coverImage.match(/^\/images\/look\/([^/]+)$/)
    if (match) normalized.coverImage = LOOK_COVER_FILE_PREFIX + match[1]
  }
  return normalized
}

function normalizeArticleList(list) {
  return (list || []).map(normalizeArticleAsset)
}

async function safeCount(collectionName, where) {
  try {
    return await db.collection(collectionName).where(where).count()
  } catch (err) {
    console.warn(`optional collection ${collectionName} unavailable:`, err.message)
    return { total: 0 }
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action = '' } = event
  const data = normalizeEventData(event)

  try {
    switch (action) {
      // ============ 公共接口 ============
      case 'articleList': return await articleList(data)
      case 'articleDetail': return await articleDetail(OPENID, data)
      case 'relatedArticles': return await relatedArticles(data)
      case 'commentList': return await commentList(data)
      case 'articlesByFigure': return await articlesByFigure(data)
      case 'voteResults': return await voteResults(OPENID, data)

      // ============ 用户接口（需登录） ============
      case 'toggleLike': return await toggleLike(OPENID, data)
      case 'toggleBookmark': return await toggleBookmark(OPENID, data)
      case 'vote': return await vote(OPENID, data)
      case 'submitComment': return await submitComment(OPENID, data)
      case 'myBookmarks': return await myBookmarks(OPENID, data)
      case 'increaseView': return await increaseView(data)

      // ============ 管理员接口 ============
      case 'adminArticleCreate': return await adminArticleCreate(OPENID, data)
      case 'adminArticleUpdate': return await adminArticleUpdate(OPENID, data)
      case 'adminArticleRemove': return await adminArticleRemove(OPENID, data)
      case 'adminArticleList': return await adminArticleList(OPENID, data)
      case 'adminCommentRemove': return await adminCommentRemove(OPENID, data)

      // ============ 批量导入接口（仅限开发环境） ============
      case 'batchImport': return await batchImport(data)

      default: return { code: -1, message: '未知 action: ' + action, data: null }
    }
  } catch (err) {
    console.error('look err:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

function normalizeEventData(event) {
  const { action, data, ...rest } = event || {}
  return data && typeof data === 'object' ? { ...rest, ...data } : rest
}

// ==================== 管理员鉴权 ====================
async function checkAdmin(OPENID) {
  const res = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
  if (!res.data || res.data.length === 0) throw new Error('用户不存在')
  const role = res.data[0].role || 'user'
  if (role !== 'admin' && role !== 'superadmin') throw new Error('无管理员权限')
  return res.data[0]
}

// ==================== 公共接口 ====================

async function articleList(data) {
  const { category = 'all', page = 0, pageSize = 10 } = data
  const limit = Math.min(pageSize, 20)
  const skip = page * limit

  let where = { status: 'published' }
  if (category !== 'all') {
    where.category = category
  }

  const countRes = await db.collection('articles').where(where).count()
  const total = countRes.total

  const res = await db.collection('articles')
    .where(where)
    .orderBy('sortOrder', 'desc')
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(limit)
    .field({
      _id: true,
      title: true,
      subtitle: true,
      coverImage: true,
      category: true,
      dynasty: true,
      summary: true,
      viewCount: true,
      likeCount: true,
      bookmarkCount: true,
      commentCount: true,
      tags: true,
      author: true,
      sortOrder: true,
      createdAt: true
    })
    .get()

  return {
    code: 0,
    message: 'ok',
    data: {
      list: normalizeArticleList(res.data),
      total,
      hasMore: skip + res.data.length < total
    }
  }
}

async function articleDetail(OPENID, data) {
  const { articleId } = data
  if (!articleId) return { code: -1, message: '缺少 articleId', data: null }

  const res = await db.collection('articles').doc(articleId).get()
  if (!res.data || res.data.status === 'deleted') {
    return { code: -1, message: '文章不存在', data: null }
  }

  const article = normalizeArticleAsset(res.data)

  let liked = false
  let bookmarked = false
  let pollVoted = false
  let pollResults = null

  if (OPENID) {
    const [likeRes, bookmarkRes] = await Promise.all([
      safeCount('article_likes', { articleId, _openid: OPENID }),
      safeCount('article_bookmarks', { articleId, _openid: OPENID })
    ])
    liked = likeRes.total > 0
    bookmarked = bookmarkRes.total > 0

    if (article.poll) {
      let pollRes = { data: [] }
      try {
        pollRes = await db.collection('article_polls')
          .where({ articleId, _openid: OPENID })
          .limit(1)
          .get()
      } catch (err) {
        console.warn('optional collection article_polls unavailable:', err.message)
      }
      pollVoted = pollRes.data && pollRes.data.length > 0
      pollResults = await getPollResults(articleId, article.poll.options.length)
    }
  }

  return {
    code: 0,
    message: 'ok',
    data: {
      article,
      liked,
      bookmarked,
      pollVoted,
      pollResults
    }
  }
}

async function relatedArticles(data) {
  const { articleId, limit = 3 } = data
  if (!articleId) return { code: 0, message: 'ok', data: { list: [] } }

  const current = await db.collection('articles').doc(articleId).get()
  if (!current.data) return { code: 0, message: 'ok', data: { list: [] } }

  const figureIds = current.data.figureIds || []
  const category = current.data.category
  const tags = current.data.tags || []

  let related = []

  // 优先按人物关联
  if (figureIds.length) {
    const res = await db.collection('articles')
      .where({
        _id: _.neq(articleId),
        status: 'published',
        figureIds: _.in(figureIds)
      })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .field({
        _id: true, title: true, subtitle: true, coverImage: true,
        category: true, dynasty: true, summary: true,
        viewCount: true, likeCount: true
      })
      .get()
    related = res.data
  }

  // 不足则按分类补充
  if (related.length < limit) {
    const existingIds = [articleId, ...related.map(r => r._id)]
    const res = await db.collection('articles')
      .where({
        _id: _.nin(existingIds),
        status: 'published',
        category
      })
      .orderBy('createdAt', 'desc')
      .limit(limit - related.length)
      .field({
        _id: true, title: true, subtitle: true, coverImage: true,
        category: true, dynasty: true, summary: true,
        viewCount: true, likeCount: true
      })
      .get()
    related = related.concat(res.data)
  }

  // 仍不足则按标签补充
  if (related.length < limit && tags.length) {
    const existingIds = [articleId, ...related.map(r => r._id)]
    const res = await db.collection('articles')
      .where({
        _id: _.nin(existingIds),
        status: 'published',
        tags: _.in(tags)
      })
      .orderBy('createdAt', 'desc')
      .limit(limit - related.length)
      .field({
        _id: true, title: true, subtitle: true, coverImage: true,
        category: true, dynasty: true, summary: true,
        viewCount: true, likeCount: true
      })
      .get()
    related = related.concat(res.data)
  }

  return { code: 0, message: 'ok', data: { list: normalizeArticleList(related) } }
}

async function commentList(data) {
  const { articleId, page = 0, pageSize = 20 } = data
  if (!articleId) return { code: -1, message: '缺少 articleId', data: null }

  const limit = Math.min(pageSize, 50)
  const res = await db.collection('article_comments')
    .where({ articleId, status: 'normal' })
    .orderBy('createdAt', 'desc')
    .skip(page * limit)
    .limit(limit)
    .get()

  return {
    code: 0,
    message: 'ok',
    data: {
      list: res.data,
      hasMore: res.data.length === limit
    }
  }
}

async function articlesByFigure(data) {
  const { figureId, limit = 5 } = data
  if (!figureId) return { code: 0, message: 'ok', data: { list: [] } }

  const res = await db.collection('articles')
    .where({
      status: 'published',
      figureIds: figureId
    })
    .orderBy('createdAt', 'desc')
    .limit(Math.min(limit, 20))
    .field({
      _id: true, title: true, subtitle: true, coverImage: true,
      category: true, dynasty: true, summary: true,
      viewCount: true, likeCount: true, createdAt: true
    })
    .get()

  return { code: 0, message: 'ok', data: { list: normalizeArticleList(res.data) } }
}

async function voteResults(OPENID, data) {
  const { articleId } = data
  if (!articleId) return { code: -1, message: '缺少 articleId', data: null }

  const article = await db.collection('articles').doc(articleId).get()
  if (!article.data || !article.data.poll) {
    return { code: 0, message: 'ok', data: { results: null, voted: false } }
  }

  const optionCount = article.data.poll.options.length
  const results = await getPollResults(articleId, optionCount)
  let voted = false
  if (OPENID) {
    const pollRes = await db.collection('article_polls')
      .where({ articleId, _openid: OPENID })
      .limit(1)
      .get()
    voted = pollRes.data && pollRes.data.length > 0
  }

  return { code: 0, message: 'ok', data: { results, voted } }
}

async function getPollResults(articleId, optionCount) {
  const results = new Array(optionCount).fill(0)
  let res = { data: [] }
  try {
    res = await db.collection('article_polls')
      .where({ articleId })
      .get()
  } catch (err) {
    console.warn('optional collection article_polls unavailable:', err.message)
  }
  if (res.data) {
    res.data.forEach(r => {
      if (r.optionIndex >= 0 && r.optionIndex < optionCount) {
        results[r.optionIndex]++
      }
    })
  }
  const total = results.reduce((a, b) => a + b, 0)
  return {
    counts: results,
    total,
    percentages: results.map(c => total > 0 ? Math.round(c / total * 100) : 0)
  }
}

// ==================== 用户接口 ====================

async function toggleLike(OPENID, data) {
  const { articleId } = data
  if (!articleId || !OPENID) return { code: -1, message: '参数不全', data: null }

  const articleDoc = await db.collection('articles').doc(articleId).get()
  if (!articleDoc.data || articleDoc.data.status === 'deleted') {
    return { code: -1, message: '文章不存在', data: null }
  }

  const exist = await db.collection('article_likes')
    .where({ articleId, _openid: OPENID })
    .get()

  let liked
  if (exist.data && exist.data.length > 0) {
    await db.collection('article_likes').doc(exist.data[0]._id).remove()
    await db.collection('articles').doc(articleId).update({
      data: { likeCount: _.inc(-1) }
    })
    liked = false
  } else {
    await db.collection('article_likes').add({
      data: { articleId, _openid: OPENID, createdAt: db.serverDate() }
    })
    await db.collection('articles').doc(articleId).update({
      data: { likeCount: _.inc(1) }
    })
    liked = true
  }

  return { code: 0, message: 'ok', data: { liked } }
}

async function toggleBookmark(OPENID, data) {
  const { articleId } = data
  if (!articleId || !OPENID) return { code: -1, message: '参数不全', data: null }

  const articleDoc = await db.collection('articles').doc(articleId).get()
  if (!articleDoc.data || articleDoc.data.status === 'deleted') {
    return { code: -1, message: '文章不存在', data: null }
  }

  const exist = await db.collection('article_bookmarks')
    .where({ articleId, _openid: OPENID })
    .get()

  let bookmarked
  if (exist.data && exist.data.length > 0) {
    await db.collection('article_bookmarks').doc(exist.data[0]._id).remove()
    await db.collection('articles').doc(articleId).update({
      data: { bookmarkCount: _.inc(-1) }
    })
    bookmarked = false
  } else {
    await db.collection('article_bookmarks').add({
      data: { articleId, _openid: OPENID, createdAt: db.serverDate() }
    })
    await db.collection('articles').doc(articleId).update({
      data: { bookmarkCount: _.inc(1) }
    })
    bookmarked = true
  }

  return { code: 0, message: 'ok', data: { bookmarked } }
}

async function vote(OPENID, data) {
  const { articleId, optionIndex } = data
  if (!articleId || optionIndex === undefined || !OPENID) {
    return { code: -1, message: '参数不全', data: null }
  }

  const articleDoc = await db.collection('articles').doc(articleId).get()
  if (!articleDoc.data || !articleDoc.data.poll) {
    return { code: -1, message: '该文章没有投票', data: null }
  }

  if (optionIndex < 0 || optionIndex >= articleDoc.data.poll.options.length) {
    return { code: -1, message: '无效的选项', data: null }
  }

  const exist = await db.collection('article_polls')
    .where({ articleId, _openid: OPENID })
    .get()

  if (exist.data && exist.data.length > 0) {
    return { code: -1, message: '已投过票', data: null }
  }

  await db.collection('article_polls').add({
    data: { articleId, optionIndex, _openid: OPENID, createdAt: db.serverDate() }
  })

  const results = await getPollResults(articleId, articleDoc.data.poll.options.length)
  return { code: 0, message: 'ok', data: { results, voted: true } }
}

async function submitComment(OPENID, data) {
  const { articleId, content, replyTo = '' } = data
  if (!articleId || !content || !OPENID) {
    return { code: -1, message: '参数不全', data: null }
  }
  if (content.length > 500) {
    return { code: -1, message: '评论最多500字', data: null }
  }

  // 内容安全审核
  try {
    const checkRes = await cloud.openapi.security.msgSecCheck({
      content,
      scene: 2,
      version: 2
    })
    if (checkRes.errCode && checkRes.errCode !== 0) {
      return { code: -1, message: '评论内容不合规', data: null }
    }
  } catch (e) {
    console.warn('msgSecCheck failed:', e)
  }

  // 获取用户信息
  const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
  const user = (userRes.data && userRes.data[0]) || {}
  const nickName = user.nickName || user.nickname || '穿越者'
  const avatarUrl = user.avatarUrl || ''

  const doc = {
    articleId,
    _openid: OPENID,
    nickName,
    avatarUrl,
    content,
    likeCount: 0,
    replyTo,
    status: 'normal',
    createdAt: db.serverDate()
  }

  const res = await db.collection('article_comments').add({ data: doc })

  await db.collection('articles').doc(articleId).update({
    data: { commentCount: _.inc(1) }
  })

  return { code: 0, message: 'ok', data: { _id: res._id, ...doc } }
}

async function myBookmarks(OPENID, data) {
  const { page = 0, pageSize = 10 } = data
  if (!OPENID) return { code: 0, message: 'ok', data: { list: [], hasMore: false } }

  const limit = Math.min(pageSize, 20)
  const skip = page * limit

  const bookmarkRes = await db.collection('article_bookmarks')
    .where({ _openid: OPENID })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(limit)
    .get()

  if (!bookmarkRes.data.length) {
    return { code: 0, message: 'ok', data: { list: [], hasMore: false } }
  }

  const articleIds = bookmarkRes.data.map(b => b.articleId)
  const articleRes = await db.collection('articles')
    .where({
      _id: _.in(articleIds),
      status: 'published'
    })
    .field({
      _id: true, title: true, subtitle: true, coverImage: true,
      category: true, dynasty: true, summary: true,
      viewCount: true, likeCount: true, createdAt: true
    })
    .get()

  // 按收藏顺序排列
  const articleMap = {}
  articleRes.data.forEach(a => { articleMap[a._id] = a })
  const list = articleIds
    .map(id => articleMap[id])
    .filter(a => a)

  return {
    code: 0,
    message: 'ok',
    data: {
      list: normalizeArticleList(list),
      hasMore: skip + bookmarkRes.data.length < bookmarkRes.data.length + limit
    }
  }
}

async function increaseView(data) {
  const { articleId } = data
  if (!articleId) return { code: -1, message: '缺少 articleId', data: null }

  try {
    await db.collection('articles').doc(articleId).update({
      data: { viewCount: _.inc(1) }
    })
    return { code: 0, message: 'ok', data: { counted: true } }
  } catch (e) {
    return { code: 0, message: 'ok', data: { counted: false } }
  }
}

// ==================== 管理员接口 ====================

async function adminArticleCreate(OPENID, data) {
  await checkAdmin(OPENID)
  const {
    title, subtitle = '', coverImage = '', category = 'figure_truth',
    tags = [], figureIds = [], dynasty = '', summary = '',
    content = [], poll = null, author = '穿越圈编辑部', sortOrder = 0
  } = data

  if (!title) return { code: -1, message: '缺少标题', data: null }
  if (!content || !content.length) return { code: -1, message: '缺少正文内容', data: null }

  const doc = {
    title,
    subtitle,
    coverImage,
    category,
    tags: Array.isArray(tags) ? tags : [],
    figureIds: Array.isArray(figureIds) ? figureIds : [],
    dynasty,
    summary,
    content,
    poll,
    viewCount: 0,
    likeCount: 0,
    bookmarkCount: 0,
    commentCount: 0,
    status: 'published',
    author,
    sortOrder,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }

  const res = await db.collection('articles').add({ data: doc })
  return { code: 0, message: 'ok', data: { _id: res._id, ...doc } }
}

async function adminArticleUpdate(OPENID, data) {
  await checkAdmin(OPENID)
  const { articleId, ...updateData } = data
  if (!articleId) return { code: -1, message: '缺少 articleId', data: null }

  const allowed = [
    'title', 'subtitle', 'coverImage', 'category', 'tags',
    'figureIds', 'dynasty', 'summary', 'content', 'poll',
    'author', 'sortOrder', 'status'
  ]
  const toUpdate = { updatedAt: db.serverDate() }
  allowed.forEach(k => {
    if (updateData[k] !== undefined) toUpdate[k] = updateData[k]
  })

  await db.collection('articles').doc(articleId).update({ data: toUpdate })
  return { code: 0, message: 'ok', data: { updated: true } }
}

async function adminArticleRemove(OPENID, data) {
  await checkAdmin(OPENID)
  const { articleId } = data
  if (!articleId) return { code: -1, message: '缺少 articleId', data: null }

  await db.collection('articles').doc(articleId).update({
    data: { status: 'deleted', updatedAt: db.serverDate() }
  })
  return { code: 0, message: 'ok', data: { removed: true } }
}

// ==================== 批量导入 ====================
async function batchImport(data) {
  const articles = data.articles || []
  if (!articles.length) return { code: -1, message: '无文章数据', data: null }

  let inserted = 0
  let skipped = 0
  const errors = []

  for (const article of articles) {
    try {
      // 检查是否已存在（用 title 去重）
      const existing = await db.collection('articles').where({ title: article.title }).limit(1).get()
      if (existing.data && existing.data.length > 0) {
        skipped++
        continue
      }
      // 移除自定义 _id，让数据库自动生成
      const doc = { ...article }
      delete doc._id
      await db.collection('articles').add({ data: doc })
      inserted++
    } catch (err) {
      errors.push({ title: article.title, error: err.message })
    }
  }

  return {
    code: 0,
    message: `导入完成: 成功${inserted}条, 跳过${skipped}条, 失败${errors.length}条`,
    data: { inserted, skipped, errors }
  }
}

async function adminArticleList(OPENID, data) {
  await checkAdmin(OPENID)
  const { status = '', page = 0, pageSize = 20 } = data
  const limit = Math.min(pageSize, 100)
  const skip = page * limit

  let where = {}
  if (status) where.status = status

  const countRes = await db.collection('articles').where(where).count()
  const res = await db.collection('articles')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(limit)
    .field({
      _id: true, title: true, subtitle: true, coverImage: true,
      category: true, status: true, author: true,
      viewCount: true, likeCount: true, sortOrder: true,
      createdAt: true
    })
    .get()

  return {
    code: 0,
    message: 'ok',
    data: {
      list: normalizeArticleList(res.data),
      total: countRes.total,
      hasMore: skip + res.data.length < countRes.total
    }
  }
}

async function adminCommentRemove(OPENID, data) {
  await checkAdmin(OPENID)
  const { commentId, articleId } = data
  if (!commentId) return { code: -1, message: '缺少 commentId', data: null }

  await db.collection('article_comments').doc(commentId).update({
    data: { status: 'deleted' }
  })

  if (articleId) {
    try {
      await db.collection('articles').doc(articleId).update({
        data: { commentCount: _.inc(-1) }
      })
    } catch (_) {}
  }

  return { code: 0, message: 'ok', data: { removed: true } }
}
