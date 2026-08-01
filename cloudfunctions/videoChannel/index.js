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
      case 'feedList': return await feedList(OPENID, data)
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
      case 'userCommentAdd': return await userCommentAdd(OPENID, data)

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
      case 'debugInfo': return await debugInfo()

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

async function feedList(OPENID, data) {
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

  // 批量查询用户点赞/关注状态、评论计数、视频号最新资料
  if (list.length > 0) {
    const videoIds = list.map(v => v._id)
    const channelIds = [...new Set(list.map(v => v.channelId).filter(Boolean))]

    // 从 video_channels 取最新头像/昵称/头衔（覆盖 videos 表中的冗余字段）
    const channelMap = {}
    try {
      if (channelIds.length > 0) {
        const chRes = await db.collection('video_channels')
          .where({ _id: _.in(channelIds) })
          .get()
        for (const ch of chRes.data) {
          channelMap[ch._id] = ch
        }
      }
    } catch (_) {}

    // 收集所有 figureId，回退查 figures 人物表取头像
    const allFigureIds = [...new Set(list.map(v => v.figureId).filter(Boolean))]
    const figureMap = {}
    try {
      if (allFigureIds.length > 0) {
        // 先用原始 figureId 查 figures.id
        const figRes = await db.collection('figures')
          .where({ id: _.in(allFigureIds) })
          .get()
        for (const f of figRes.data) {
          figureMap[f.id] = f
        }
        // 去掉 fig- 前缀再查一次（figures 表 id 可能存的是 "sushi" 而非 "fig-sushi"）
        const missing = allFigureIds.filter(fid => !figureMap[fid])
        const strippedIds = missing
          .filter(fid => fid.startsWith('fig-'))
          .map(fid => fid.slice(4))
        if (strippedIds.length > 0) {
          const figRes2 = await db.collection('figures')
            .where({ id: _.in(strippedIds) })
            .get()
          for (const f of figRes2.data) {
            const key = 'fig-' + f.id
            figureMap[key] = f
          }
        }
        // 也按 figureId 字段查一遍（兼容两种格式）
        const stillMissing = allFigureIds.filter(fid => !figureMap[fid])
        if (stillMissing.length > 0) {
          const figRes3 = await db.collection('figures')
            .where({ figureId: _.in(stillMissing) })
            .get()
          for (const f of figRes3.data) {
            const key = f.figureId || f.id
            if (key) figureMap[key] = f
          }
        }
      }
    } catch (_) {}

    // 评论计数（所有用户都需要）
    const commentCountMap = {}
    try {
      for (const vid of videoIds) {
        const c = await db.collection('video_comments').where({ videoId: vid }).count()
        commentCountMap[vid] = c.total
      }
    } catch (_) {}

    // 点赞和关注状态（需要登录）
    let likedSet = new Set()
    let followedSet = new Set()
    if (OPENID) {
      try {
        const likes = await db.collection('video_likes')
          .where({ videoId: _.in(videoIds), _openid: OPENID })
          .get()
        likedSet = new Set(likes.data.map(l => l.videoId))
      } catch (_) {}

      if (channelIds.length > 0) {
        try {
          const follows = await db.collection('video_follows')
            .where({ channelId: _.in(channelIds), _openid: OPENID })
            .get()
          followedSet = new Set(follows.data.map(f => f.channelId))
        } catch (_) {}
      }
    }

    list.forEach(v => {
      v.liked = likedSet.has(v._id)
      v.followed = followedSet.has(v.channelId)
      v.commentCount = commentCountMap[v._id] || 0
      const ch = v.channelId ? channelMap[v.channelId] : null
      if (ch) {
        if (ch.avatar) v.avatar = ch.avatar
        if (ch.figureName) v.figureName = ch.figureName
        if (ch.figureTitle) v.figureTitle = ch.figureTitle
        if (ch.figureId) v.figureId = ch.figureId
      }
      // 头像仍为空时，回退查 figures 人物表
      if (!v.avatar && v.figureId) {
        const fig = figureMap[v.figureId]
        if (fig) {
          v.avatar = fig.mini_avatar_url || fig.avatar_url || fig.avatar || ''
          if (!v.figureName && fig.name) v.figureName = fig.name
          if (!v.figureTitle && (fig.title || fig.figureTitle)) v.figureTitle = fig.title || fig.figureTitle
        }
      }
    })
  }

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

  const video = { ...res.data }

  // 关联查视频号主表，取最新头像/昵称/头衔
  try {
    if (video.channelId) {
      const chRes = await db.collection('video_channels').doc(video.channelId).get()
      const ch = chRes.data
      if (ch) {
        if (ch.avatar) video.avatar = ch.avatar
        if (ch.figureName) video.figureName = ch.figureName
        if (ch.figureTitle) video.figureTitle = ch.figureTitle
        if (ch.figureId) video.figureId = ch.figureId
      }
    }
  } catch (_) {}

  // 头像仍为空时，回退查 figures 人物表
  if (!video.avatar && video.figureId) {
    try {
      let figRes = await db.collection('figures').where({ id: video.figureId }).limit(1).get()
      if (!figRes.data || !figRes.data.length) {
        // 去掉 fig- 前缀重查
        const stripped = video.figureId.startsWith('fig-') ? video.figureId.slice(4) : ''
        if (stripped) {
          figRes = await db.collection('figures').where({ id: stripped }).limit(1).get()
        }
      }
      if (!figRes.data || !figRes.data.length) {
        figRes = await db.collection('figures').where({ figureId: video.figureId }).limit(1).get()
      }
      const fig = figRes.data && figRes.data[0]
      if (fig) {
        video.avatar = fig.mini_avatar_url || fig.avatar_url || fig.avatar || ''
        if (!video.figureName && fig.name) video.figureName = fig.name
        if (!video.figureTitle && (fig.title || fig.figureTitle)) video.figureTitle = fig.title || fig.figureTitle
      }
    } catch (_) {}
  }

  let liked = false
  if (OPENID) {
    const likeRes = await db.collection('video_likes')
      .where({ videoId, _openid: OPENID })
      .count()
    liked = likeRes.total > 0
  }
  video.liked = liked

  return {
    code: 0,
    message: 'ok',
    data: video
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

  // 尝试多种格式匹配 video_channels.figureId
  let channelRes = await db.collection('video_channels')
    .where({ figureId })
    .limit(1)
    .get()

  if (!channelRes.data || channelRes.data.length === 0) {
    // 尝试加 fig- 前缀
    const withPrefix = figureId.startsWith('fig-') ? figureId : 'fig-' + figureId
    channelRes = await db.collection('video_channels')
      .where({ figureId: withPrefix })
      .limit(1)
      .get()
  }

  if (!channelRes.data || channelRes.data.length === 0) {
    // 尝试去掉 fig- 前缀
    const stripped = figureId.startsWith('fig-') ? figureId.slice(4) : ''
    if (stripped) {
      channelRes = await db.collection('video_channels')
        .where({ figureId: stripped })
        .limit(1)
        .get()
    }
  }

  if (!channelRes.data || channelRes.data.length === 0) {
    // 最后尝试用 figures 表 _id 反查
    try {
      const figRes = await db.collection('figures').doc(figureId).get()
      if (figRes.data) {
        const figId = figRes.data.figureId || (figRes.data.id ? 'fig-' + figRes.data.id : '')
        if (figId) {
          channelRes = await db.collection('video_channels')
            .where({ figureId: figId })
            .limit(1)
            .get()
        }
      }
    } catch (_) {}
  }

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

async function userCommentAdd(OPENID, data) {
  const { videoId, content } = data
  if (!videoId || !content || !OPENID) return { code: -1, message: '参数不全', data: null }
  const text = String(content).trim()
  if (!text) return { code: -1, message: '评论内容不能为空', data: null }
  if (text.length > 200) return { code: -1, message: '评论过长', data: null }

  // 检查该视频是否开启了评论
  try {
    const vDoc = await db.collection('videos').doc(videoId).get()
    if (vDoc.data && vDoc.data.commentEnabled === false) {
      return { code: -1, message: '该视频未开放评论', data: null }
    }
  } catch (_) {}

  // 微信内容安全检测
  try {
    const msgCheck = await cloud.openapi.security.msgSecCheck({
      content: text
    })
    if (msgCheck && msgCheck.errCode !== 0) {
      return { code: -1, message: '评论内容包含违规信息，请修改后重试', data: null }
    }
  } catch (e) {
    // 如果检测接口异常，保守拒绝
    console.warn('msgSecCheck error:', e.message)
    return { code: -1, message: '内容审核服务暂时不可用，请稍后重试', data: null }
  }

  const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
  const user = (userRes.data && userRes.data[0]) || {}

  const doc = {
    videoId,
    fromFigureId: '',
    fromFigureName: user.nickName || '穿越者',
    fromFigureTitle: '',
    fromAvatar: user.avatarUrl || '',
    fromDynasty: '',
    toFigureId: '',
    toFigureName: '',
    content: text,
    createdAt: db.serverDate()
  }

  const res = await db.collection('video_comments').add({ data: doc })

  try {
    await db.collection('videos').doc(videoId).update({
      data: { commentCount: _.inc(1) }
    })
  } catch (_) {}

  return { code: 0, message: 'ok', data: { _id: res._id, ...doc } }
}

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

  const channels = res.data || []

  // 关联查 figures 表补全头像
  const figureIds = [...new Set(channels.map(c => c.figureId).filter(Boolean))]
  const figureMap = {}
  if (figureIds.length > 0) {
    try {
      // 先按原始 figureId 查
      let figRes = await db.collection('figures').where({ id: _.in(figureIds) }).get()
      for (const f of (figRes.data || [])) {
        const key = f.id
        if (key) figureMap[key] = f
      }
      // 去掉 fig- 前缀再查
      const stripped = figureIds
        .filter(fid => fid.startsWith('fig-') && !figureMap[fid])
        .map(fid => fid.slice(4))
      if (stripped.length > 0) {
        figRes = await db.collection('figures').where({ id: _.in(stripped) }).get()
        for (const f of (figRes.data || [])) {
          const key = 'fig-' + f.id
          if (key) figureMap[key] = f
        }
      }
    } catch (_) {}
  }

  for (const ch of channels) {
    const fig = ch.figureId ? figureMap[ch.figureId] : null
    if (fig) {
      if (!ch.avatar) ch.avatar = fig.mini_avatar_url || fig.avatar_url || fig.avatar || ''
      if (!ch.figureName && fig.name) ch.figureName = fig.name
      if (!ch.figureTitle && (fig.title || fig.figureTitle)) ch.figureTitle = fig.title || fig.figureTitle
    }
  }

  return { code: 0, message: 'ok', data: channels }
}

async function adminVideoCreate(OPENID, data) {
  await checkAdmin(OPENID)
  const {
    channelId, figureId, figureName, figureTitle = '', avatar = '', dynasty = '',
    title, description = '', coverUrl, videoUrl, duration = 0,
    historicalEvent = '', tags = [], commentEnabled = false
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
    commentEnabled: !!commentEnabled,
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

  const allowed = ['title', 'description', 'coverUrl', 'videoUrl', 'duration', 'historicalEvent', 'tags', 'status', 'commentEnabled']
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

// ==================== 诊断接口 ====================
async function debugInfo() {
  try {
    const videoCount = await db.collection('videos').count()
    const publishedCount = await db.collection('videos').where({ status: 'published' }).count()
    const channelCount = await db.collection('video_channels').count()

    // 统计 videoUrl 状态
    const allVideos = await db.collection('videos').limit(100).get()
    let emptyUrl = 0, httpUrl = 0, cloudUrl = 0
    const samples = []

    for (const v of allVideos.data) {
      if (!v.videoUrl) emptyUrl++
      else if (v.videoUrl.startsWith('cloud://')) cloudUrl++
      else if (v.videoUrl.startsWith('http')) httpUrl++

      if (samples.length < 3) {
        samples.push({
          _id: v._id,
          title: v.title,
          status: v.status,
          videoUrl: v.videoUrl ? v.videoUrl.substring(0, 60) : '(空)',
          coverUrl: v.coverUrl ? v.coverUrl.substring(0, 60) : '(空)',
          figureId: v.figureId,
          channelId: v.channelId ? v.channelId.substring(0, 20) : '(空)'
        })
      }
    }

    return {
      code: 0,
      message: 'ok',
      data: {
        totalVideos: videoCount.total,
        publishedVideos: publishedCount.total,
        totalChannels: channelCount.total,
        urlStats: { emptyUrl, httpUrl, cloudUrl },
        samples
      }
    }
  } catch (e) {
    return { code: -1, message: e.message, data: null }
  }
}
