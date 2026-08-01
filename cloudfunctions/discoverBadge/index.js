const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      case 'get':
        return await getBadges(OPENID, event)
      default:
        return { code: -1, message: '未知 action' }
    }
  } catch (e) {
    console.error('discoverBadge error:', e)
    return {
      code: 0,
      message: 'ok',
      data: {
        moments: { unreadCount: 0 },
        channels: { hasNew: false },
        memorial: { pendingCount: 0 },
        yan: { travelingCount: 0, newReplyCount: 0 }
      }
    }
  }
}

async function getBadges(OPENID, data) {
  const { lastViewMoments = 0, lastViewChannels = 0, lastViewYanReplies = 0 } = data

  const [momentsResult, channelsResult, memorialResult, yanResult] = await Promise.all([
    getMomentsBadge(lastViewMoments),
    getChannelsBadge(lastViewChannels),
    getMemorialBadge(OPENID),
    getYanBadge(OPENID, lastViewYanReplies)
  ])

  return {
    code: 0,
    message: 'ok',
    data: {
      moments: momentsResult,
      channels: channelsResult,
      memorial: memorialResult,
      yan: yanResult
    }
  }
}

async function getMomentsBadge(lastViewMoments) {
  try {
    let query = db.collection('moments')
    if (lastViewMoments && lastViewMoments > 0) {
      query = query.where({
        createdAt: _.gt(new Date(lastViewMoments))
      })
    }
    const countRes = await query.count()
    return {
      unreadCount: Math.min(countRes.total || 0, 99)
    }
  } catch (e) {
    console.warn('getMomentsBadge error:', e)
    return { unreadCount: 0 }
  }
}

async function getChannelsBadge(lastViewChannels) {
  try {
    const latestRes = await db.collection('videos')
      .where({ status: 'published' })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    if (!latestRes.data || !latestRes.data.length) {
      return { hasNew: false }
    }

    const latestVideo = latestRes.data[0]
    const latestTime = latestVideo.createdAt ? latestVideo.createdAt.getTime() : 0
    const hasNew = !lastViewChannels || latestTime > lastViewChannels

    let figureName = ''
    if (hasNew) {
      if (latestVideo.figureName) {
        figureName = latestVideo.figureName
      } else if (latestVideo.figureId) {
        try {
          let figureRes = await db.collection('figures')
            .where(_.or([
              { _id: latestVideo.figureId },
              { id: latestVideo.figureId },
              { figureId: latestVideo.figureId }
            ]))
            .limit(1)
            .get()
          if (!figureRes.data || !figureRes.data.length) {
            const stripped = latestVideo.figureId.startsWith('fig-') ? latestVideo.figureId.slice(4) : ''
            if (stripped) {
              figureRes = await db.collection('figures')
                .where(_.or([
                  { id: stripped },
                  { figureId: stripped }
                ]))
                .limit(1)
                .get()
            }
          }
          if (figureRes.data && figureRes.data.length) {
            figureName = figureRes.data[0].name || ''
          }
        } catch (e) {}
      }
    }

    return {
      hasNew,
      figureName,
      videoId: hasNew ? latestVideo._id : ''
    }
  } catch (e) {
    console.warn('getChannelsBadge error:', e)
    return { hasNew: false }
  }
}

async function getMemorialBadge(OPENID) {
  try {
    const [allMemorialsRes, answeredRes] = await Promise.all([
      db.collection('memorials').count(),
      db.collection('memorial_answers').where({ _openid: OPENID }).count()
    ])

    const total = allMemorialsRes.total || 0
    const answered = answeredRes.total || 0
    const pendingCount = Math.max(0, total - answered)

    return { pendingCount }
  } catch (e) {
    console.warn('getMemorialBadge error:', e)
    return { pendingCount: 0 }
  }
}

async function getYanBadge(OPENID, lastViewYanReplies) {
  try {
    const [travelingRes, arrivedRes] = await Promise.all([
      db.collection('yan_letters')
        .where({
          _openid: OPENID,
          status: _.in(['traveling', 'processing'])
        })
        .count(),
      db.collection('yan_letters')
        .where({
          _openid: OPENID,
          status: 'arrived'
        })
        .orderBy('arrivedAt', 'desc')
        .limit(50)
        .get()
    ])

    const travelingCount = travelingRes.total || 0

    let newReplyCount = 0
    if (arrivedRes.data && arrivedRes.data.length) {
      if (!lastViewYanReplies || lastViewYanReplies === 0) {
        newReplyCount = arrivedRes.data.length
      } else {
        newReplyCount = arrivedRes.data.filter(l => {
          const arrivedAt = l.arrivedAt ? l.arrivedAt.getTime() : 0
          return arrivedAt > lastViewYanReplies
        }).length
      }
    }

    return {
      travelingCount,
      newReplyCount
    }
  } catch (e) {
    console.warn('getYanBadge error:', e)
    return { travelingCount: 0, newReplyCount: 0 }
  }
}
