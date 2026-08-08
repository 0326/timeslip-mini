const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const { resolveIdentity, ownerMatch, attachOwnerFields } = require('./_identityHelper')
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const id = resolveIdentity(event, cloud.getWXContext())
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
    var today = (function() {
      var d = new Date()
      var y = d.getFullYear()
      var m = ('0' + (d.getMonth() + 1)).slice(-2)
      var day = ('0' + d.getDate()).slice(-2)
      return y + '-' + m + '-' + day
    })()

    var cfg = null
    try {
      var cRes = await db.collection('memorial_config').where({ _id: 'main_config' }).limit(1).get()
      if (cRes.data && cRes.data.length) cfg = cRes.data[0]
    } catch (_) {}
    var defaultDaily = cfg && cfg.daily_count ? cfg.daily_count : 10

    var todayDoc = null
    try {
      var tRes = await db.collection('memorial_daily').where({ _openid: OPENID, date: today }).limit(1).get()
      if (tRes.data && tRes.data.length) todayDoc = tRes.data[0]
    } catch (_) {}

    // 今日队列存在：按"队列长度-已完成数"算未批
    if (todayDoc) {
      var queue = Array.isArray(todayDoc.queue) ? todayDoc.queue : []
      var doneIds = todayDoc.completed_ids && Array.isArray(todayDoc.completed_ids) ? todayDoc.completed_ids : []
      var pendingCount = 0
      for (var i = 0; i < queue.length; i++) {
        var qid = typeof queue[i] === 'object' ? (queue[i].memorial_id || queue[i].id) : queue[i]
        if (doneIds.indexOf(qid) === -1) pendingCount++
      }
      return { pendingCount: pendingCount }
    }

    // 今日队列为空：还未生成（新用户或今天还没进过批奏折页）
    // 显示默认每日未批数（通常10），避免"显示100份"误导
    var answeredRes = await db.collection('memorial_answers').where({ _openid: OPENID }).count()
    var answered = answeredRes.total || 0
    if (answered <= 0) return { pendingCount: defaultDaily }

    // 老用户但今日未生成：显示0（等他进入批奏折页生成新队列后再刷新badge）
    return { pendingCount: 0 }
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
