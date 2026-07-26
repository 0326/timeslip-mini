const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action = '' } = event
  const data = normalizeEventData(event)

  try {
    switch (action) {
      // ============ 公共接口 ============
      case 'feedList': return await feedList(data)
      case 'videoDetail': return await videoDetail(OPENID, data)
      case 'commentList': return await commentList(data)
      case 'channelDetail': return await channelDetail(OPENID, data)
      case 'channelVideos': return await channelVideos(data)
      case 'channelByFigure': return await channelByFigure(OPENID, data)

      // ============ 用户接口（需登录） ============
      case 'toggleLike': return await toggleLike(OPENID, data)
      case 'likeStatus': return await likeStatus(OPENID, data)
      case 'toggleFollow': return await toggleFollow(OPENID, data)
      case 'followStatus': return await followStatus(OPENID, data)
      case 'followedChannels': return await followedChannels(OPENID, data)
      case 'increaseView': return await increaseView(OPENID, data)

      // ============ 管理员接口 ============
      case 'adminChannelCreate': return await adminChannelCreate(OPENID, data)
      case 'adminChannelUpdate': return await adminChannelUpdate(OPENID, data)
      case 'adminChannelList': return await adminChannelList(OPENID, data)
      case 'adminVideoCreate': return await adminVideoCreate(OPENID, data)
      case 'adminVideoUpdate': return await adminVideoUpdate(OPENID, data)
      case 'adminVideoRemove': return await adminVideoRemove(OPENID, data)
      case 'adminVideoList': return await adminVideoList(OPENID, data)
      case 'adminCommentAdd': return await adminCommentAdd(OPENID, data)
      case 'adminCommentRemove': return await adminCommentRemove(OPENID, data)

      default: return { code: -1, message: '未知 action: ' + action, data: null }
    }
  } catch (err) {
    console.error('videoChannel err:', err)
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

async function feedList(data) {
  const { lastCreatedAt = '', lastId = '', limit = 10, type = 'recommend', figureId = '' } = data
  let where = { status: 'published' }
  if (figureId) where.figureId = figureId

  if (lastCreatedAt && lastId) {
    where.createdAt = _.lt(new Date(lastCreatedAt))
  }

  const res = await db.collection('videos')
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(limit, 20))
    .get()

  const list = res.data
  const hasMore = list.length === Math.min(limit, 20)
  const newLast = list.length > 0 ? list[list.length - 1] : null

  return {
    code: 0,
    message: 'ok',
    data: {
      list,
      hasMore,
      lastCreatedAt: newLast ? newLast.createdAt : null,
      lastId: newLast ? newLast._id : null
    }
  }
}

async function videoDetail(OPENID, data) {
  const { videoId } = data
  if (!videoId) return { code: -1, message: '缺少 videoId', data: null }

  const res = await db.collection('videos').doc(videoId).get()
  if (!res.data || res.data.status === 'deleted') {
    return { code: -1, message: '视频不存在', data: null }
  }

  let liked = false
  if (OPENID) {
    const likeRes = await db.collection('video_likes')
      .where({ videoId, _openid: OPENID })
      .count()
    liked = likeRes.total > 0
  }

  return {
    code: 0,
    message: 'ok',
    data: { ...res.data, liked }
  }
}

async function commentList(data) {
  const { videoId, limit = 30 } = data
  if (!videoId) return { code: -1, message: '缺少 videoId', data: null }

  const res = await db.collection('video_comments')
    .where({ videoId })
    .orderBy('createdAt', 'asc')
    .limit(Math.min(limit, 100))
    .get()

  return { code: 0, message: 'ok', data: res.data }
}

async function channelDetail(OPENID, data) {
  const { channelId, figureId } = data
  let where = {}
  if (channelId) where._id = channelId
  else if (figureId) where.figureId = figureId
  else return { code: -1, message: '缺少 channelId 或 figureId', data: null }

  const res = await db.collection('video_channels').where(where).limit(1).get()
  if (!res.data || res.data.length === 0) {
    return { code: -1, message: '视频号不存在', data: null }
  }

  const channel = res.data[0]
  let followed = false
  if (OPENID) {
    const followRes = await db.collection('video_follows')
      .where({ channelId: channel._id, _openid: OPENID })
      .count()
    followed = followRes.total > 0
  }

  return { code: 0, message: 'ok', data: { ...channel, followed } }
}

async function channelVideos(data) {
  const { channelId, limit = 20, lastCreatedAt = '' } = data
  if (!channelId) return { code: -1, message: '缺少 channelId', data: null }

  let where = { channelId, status: 'published' }
  if (lastCreatedAt) {
    where.createdAt = _.lt(new Date(lastCreatedAt))
  }

  const res = await db.collection('videos')
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(limit, 50))
    .get()

  return { code: 0, message: 'ok', data: res.data }
}

async function channelByFigure(OPENID, data) {
  const { figureId } = data
  if (!figureId) return { code: -1, message: '缺少 figureId', data: null }

  const channelRes = await db.collection('video_channels')
    .where({ figureId })
    .limit(1)
    .get()

  if (!channelRes.data || channelRes.data.length === 0) {
    return { code: 0, message: 'ok', data: null }
  }

  const channel = channelRes.data[0]
  let followed = false
  if (OPENID) {
    const followRes = await db.collection('video_follows')
      .where({ channelId: channel._id, _openid: OPENID })
      .count()
    followed = followRes.total > 0
  }

  const videoRes = await db.collection('videos')
    .where({ channelId: channel._id, status: 'published' })
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get()

  return {
    code: 0,
    message: 'ok',
    data: {
      channel: { ...channel, followed },
      videos: videoRes.data
    }
  }
}

// ==================== 用户接口 ====================

async function toggleLike(OPENID, data) {
  const { videoId } = data
  if (!videoId || !OPENID) return { code: -1, message: '参数不全', data: null }

  const videoDoc = await db.collection('videos').doc(videoId).get()
  if (!videoDoc.data || videoDoc.data.status === 'deleted') {
    return { code: -1, message: '视频不存在', data: null }
  }

  const exist = await db.collection('video_likes')
    .where({ videoId, _openid: OPENID })
    .get()

  let liked
  if (exist.data && exist.data.length > 0) {
    await db.collection('video_likes').doc(exist.data[0]._id).remove()
    await db.collection('videos').doc(videoId).update({
      data: { likeCount: _.inc(-1) }
    })
    liked = false
  } else {
    await db.collection('video_likes').add({
      data: { videoId, _openid: OPENID, createdAt: db.serverDate() }
    })
    await db.collection('videos').doc(videoId).update({
      data: { likeCount: _.inc(1) }
    })
    liked = true
  }

  return { code: 0, message: 'ok', data: { liked } }
}

async function likeStatus(OPENID, data) {
  const { videoId } = data
  if (!videoId || !OPENID) return { code: 0, message: 'ok', data: { liked: false } }

  const res = await db.collection('video_likes')
    .where({ videoId, _openid: OPENID })
    .count()

  return { code: 0, message: 'ok', data: { liked: res.total > 0 } }
}

async function toggleFollow(OPENID, data) {
  const { channelId } = data
  if (!channelId || !OPENID) return { code: -1, message: '参数不全', data: null }

  const channelDoc = await db.collection('video_channels').doc(channelId).get()
  if (!channelDoc.data) return { code: -1, message: '视频号不存在', data: null }

  const exist = await db.collection('video_follows')
    .where({ channelId, _openid: OPENID })
    .get()

  let followed, followerCount
  if (exist.data && exist.data.length > 0) {
    await db.collection('video_follows').doc(exist.data[0]._id).remove()
    const up = await db.collection('video_channels').doc(channelId).update({
      data: { followerCount: _.inc(-1), updatedAt: db.serverDate() }
    })
    followed = false
    followerCount = Math.max(0, (channelDoc.data.followerCount || 0) - 1)
  } else {
    await db.collection('video_follows').add({
      data: {
        channelId,
        figureId: channelDoc.data.figureId || '',
        _openid: OPENID,
        createdAt: db.serverDate()
      }
    })
    await db.collection('video_channels').doc(channelId).update({
      data: { followerCount: _.inc(1), updatedAt: db.serverDate() }
    })
    followed = true
    followerCount = (channelDoc.data.followerCount || 0) + 1
  }

  return { code: 0, message: 'ok', data: { followed, followerCount } }
}

async function followStatus(OPENID, data) {
  const { channelId } = data
  if (!channelId || !OPENID) return { code: 0, message: 'ok', data: { followed: false } }

  const res = await db.collection('video_follows')
    .where({ channelId, _openid: OPENID })
    .count()

  return { code: 0, message: 'ok', data: { followed: res.total > 0 } }
}

async function followedChannels(OPENID, data) {
  if (!OPENID) return { code: 0, message: 'ok', data: [] }

  const res = await db.collection('video_follows')
    .where({ _openid: OPENID })
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  return { code: 0, message: 'ok', data: res.data }
}

async function increaseView(OPENID, data) {
  const { videoId } = data
  if (!videoId) return { code: -1, message: '缺少 videoId', data: null }

  try {
    await db.collection('videos').doc(videoId).update({
      data: { viewCount: _.inc(1) }
    })
    return { code: 0, message: 'ok', data: { counted: true } }
  } catch (e) {
    return { code: 0, message: 'ok', data: { counted: false } }
  }
}

// ==================== 管理员接口 ====================

async function adminChannelCreate(OPENID, data) {
  await checkAdmin(OPENID)
  const { figureId, figureName, figureTitle = '', avatar = '', dynasty = '', dynastyName = '', bio = '' } = data
  if (!figureId || !figureName) return { code: -1, message: '缺少 figureId 或 figureName', data: null }

  const exist = await db.collection('video_channels').where({ figureId }).count()
  if (exist.total > 0) return { code: -1, message: '该人物已开通视频号', data: null }

  const doc = {
    figureId,
    figureName,
    figureTitle,
    avatar,
    dynasty,
    dynastyName,
    bio,
    followerCount: 0,
    videoCount: 0,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }

  const res = await db.collection('video_channels').add({ data: doc })

  return { code: 0, message: 'ok', data: { _id: res._id, ...doc } }
}

async function adminChannelUpdate(OPENID, data) {
  await checkAdmin(OPENID)
  const { channelId, ...updateData } = data
  if (!channelId) return { code: -1, message: '缺少 channelId', data: null }

  const allowed = ['figureName', 'figureTitle', 'avatar', 'dynasty', 'dynastyName', 'bio']
  const toUpdate = { updatedAt: db.serverDate() }
  allowed.forEach(k => {
    if (updateData[k] !== undefined) toUpdate[k] = updateData[k]
  })

  await db.collection('video_channels').doc(channelId).update({ data: toUpdate })
  return { code: 0, message: 'ok', data: { updated: true } }
}

async function adminChannelList(OPENID, data) {
  await checkAdmin(OPENID)
  const { limit = 50 } = data

  const res = await db.collection('video_channels')
    .orderBy('createdAt', 'desc')
    .limit(Math.min(limit, 100))
    .get()

  return { code: 0, message: 'ok', data: res.data }
}

async function adminVideoCreate(OPENID, data) {
  await checkAdmin(OPENID)
  const {
    channelId, figureId, figureName, figureTitle = '', avatar = '', dynasty = '',
    title, description = '', coverUrl, videoUrl, duration = 0,
    historicalEvent = '', tags = []
  } = data

  if (!channelId || !title || !videoUrl || !coverUrl) {
    return { code: -1, message: '参数不全', data: null }
  }

  const channelDoc = await db.collection('video_channels').doc(channelId).get()
  if (!channelDoc.data) return { code: -1, message: '视频号不存在', data: null }

  const doc = {
    channelId,
    figureId: figureId || channelDoc.data.figureId || '',
    figureName: figureName || channelDoc.data.figureName || '',
    figureTitle: figureTitle || channelDoc.data.figureTitle || '',
    avatar: avatar || channelDoc.data.avatar || '',
    dynasty: dynasty || channelDoc.data.dynasty || '',
    title,
    description,
    coverUrl,
    videoUrl,
    duration,
    historicalEvent,
    tags: Array.isArray(tags) ? tags : [],
    likeCount: 0,
    viewCount: 0,
    status: 'published',
    createdAt: db.serverDate()
  }

  const res = await db.collection('videos').add({ data: doc })

  try {
    await db.collection('video_channels').doc(channelId).update({
      data: { videoCount: _.inc(1), updatedAt: db.serverDate() }
    })
  } catch (_) {}

  return { code: 0, message: 'ok', data: { _id: res._id, ...doc } }
}

async function adminVideoUpdate(OPENID, data) {
  await checkAdmin(OPENID)
  const { videoId, ...updateData } = data
  if (!videoId) return { code: -1, message: '缺少 videoId', data: null }

  const allowed = ['title', 'description', 'coverUrl', 'videoUrl', 'duration', 'historicalEvent', 'tags', 'status']
  const toUpdate = {}
  allowed.forEach(k => {
    if (updateData[k] !== undefined) toUpdate[k] = updateData[k]
  })

  await db.collection('videos').doc(videoId).update({ data: toUpdate })
  return { code: 0, message: 'ok', data: { updated: true } }
}

async function adminVideoRemove(OPENID, data) {
  await checkAdmin(OPENID)
  const { videoId } = data
  if (!videoId) return { code: -1, message: '缺少 videoId', data: null }

  const doc = await db.collection('videos').doc(videoId).get()
  if (!doc.data) return { code: -1, message: '视频不存在', data: null }

  await db.collection('videos').doc(videoId).update({
    data: { status: 'deleted' }
  })

  if (doc.data.channelId) {
    try {
      await db.collection('video_channels').doc(doc.data.channelId).update({
        data: { videoCount: _.inc(-1) }
      })
    } catch (_) {}
  }

  return { code: 0, message: 'ok', data: { removed: true } }
}

async function adminVideoList(OPENID, data) {
  await checkAdmin(OPENID)
  const { channelId = '', limit = 50, lastCreatedAt = '' } = data

  let where = { status: _.neq('deleted') }
  if (channelId) where.channelId = channelId
  if (lastCreatedAt) where.createdAt = _.lt(new Date(lastCreatedAt))

  const res = await db.collection('videos')
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(limit, 100))
    .get()

  return { code: 0, message: 'ok', data: res.data }
}

async function adminCommentAdd(OPENID, data) {
  await checkAdmin(OPENID)
  const {
    videoId, fromFigureId, fromFigureName = '', fromFigureTitle = '',
    fromAvatar = '', fromDynasty = '', toFigureId = '', toFigureName = '', content
  } = data

  if (!videoId || !fromFigureId || !content) {
    return { code: -1, message: '参数不全', data: null }
  }

  const doc = {
    videoId,
    fromFigureId,
    fromFigureName,
    fromFigureTitle,
    fromAvatar,
    fromDynasty,
    toFigureId,
    toFigureName,
    content,
    createdAt: db.serverDate()
  }

  const res = await db.collection('video_comments').add({ data: doc })
  return { code: 0, message: 'ok', data: { _id: res._id, ...doc } }
}

async function adminCommentRemove(OPENID, data) {
  await checkAdmin(OPENID)
  const { commentId } = data
  if (!commentId) return { code: -1, message: '缺少 commentId', data: null }

  await db.collection('video_comments').doc(commentId).remove()
  return { code: 0, message: 'ok', data: { removed: true } }
}
