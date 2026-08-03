// cloudfunctions/yan/index.js
// 雁书主云函数：用户请求处理（发送信件、列表、详情、人物、信使、标记已读、领取风物、藏馆）
// 回信生成逻辑已移至 yan-timer 定时云函数，此处不再调用 processArrived
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const common = require('./common')

// 云存储路径前缀（P1-1：carriers action 中返回前端用的完整图片 URL）
const CLOUD_PREFIX = 'cloud://cloud1-d0gunpzup215cfd87.636c-cloud1-d0gunpzup215cfd87-1457646459/mini-assets/yan/'

const PROCESSING_STALE_MS = 2 * 60 * 1000

// ========== 主入口 ==========
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action = 'send' } = event
  const data = normalizeEventData(event)
  try {
    switch (action) {
      case 'send': return await sendLetter(OPENID, data)
      case 'list': return await getList(OPENID, data)
      case 'collection': return await getCollection(OPENID, data)
      case 'figures': return await getFigures()
      case 'carriers': return await getCarriers(OPENID)
      case 'read': return await markRead(OPENID, data)
      case 'detail': return await getDetail(OPENID, data)
      case 'claim': return await claimGift(OPENID, data)
      default: return { code: -1, message: '未知 yan action: ' + action }
    }
  } catch (err) {
    console.error('yan err:', err)
    return { code: -1, message: '雁书服务异常' }
  }
}

function normalizeEventData(event) {
  const { action, data, ...rest } = event || {}
  return data && typeof data === 'object' ? { ...rest, ...data } : rest
}

// ========== 人物列表接口 ==========
async function getFigures() {
  await common.loadDbFigures()
  const list = common.getActiveFigures()
  const dynastySet = new Map()
  list.forEach(f => {
    if (f.dynasty && !dynastySet.has(f.dynasty)) {
      dynastySet.set(f.dynasty, { key: f.dynasty, name: common.DYNASTY_NAME_MAP[f.dynasty] || f.dynastyName || f.dynasty })
    }
  })
  const dynasties = [{ key: 'random', name: '随机漂流' }, ...Array.from(dynastySet.values())]
  const safeFigures = list.map(f => ({
    figureId: f.figureId,
    _dbId: f._dbId || '',
    name: f.name,
    title: f.title,
    dynasty: f.dynasty,
    dynastyName: f.dynastyName,
    avatar: f.avatar
  }))
  return { code: 0, message: 'ok', data: { dynasties, figures: safeFigures } }
}

// ========== 信使配置（P1-1 增强：返回前端完整字段+云存储图片路径） ==========
async function getCarriers(OPENID) {
  const isAdmin = await checkAdmin(OPENID)
  const data = common.CARRIER_LIST.map(c => {
    const speedLabel = c.speedLabel || (common.DEV_MODE
      ? '秒级'
      : (c.duration / 3600000) + '小时')
    const loadMap = { small: 30, medium: 60, large: 100 }
    const rarityType =
      c.rareWeight <= 30 ? 'common' :
      c.rareWeight <= 60 ? 'fine' :
      c.rareWeight <= 90 ? 'rare' : 'legendary'
    const locked = !!(c.adminOnly && !isAdmin)
    return {
      key: c.key,
      name: c.name,
      image: CLOUD_PREFIX + c.key + '.jpg',
      flyImage: c.key === 'daocao' ? CLOUD_PREFIX + 'dadiao-fly.png' : CLOUD_PREFIX + c.key + '-fly.jpg',
      duration: c.duration,
      speed: Math.max(10, Math.round(100 - c.duration / (24 * 3600 * 1000) * 100)),
      speedLabel,
      accuracy: Math.round(c.accuracy * 100),
      accuracyLabel: Math.round(c.accuracy * 100) + '%',
      load: loadMap[c.power] || 30,
      loadLabel: c.powerLabel,
      rarity: c.rareWeight,
      rarityLabel: c.rareLabel,
      rarityType,
      tags: c.tags,
      desc: c.desc,
      aura: c.aura || 'rgba(201,162,77,0.2)',
      adminOnly: !!c.adminOnly,
      locked
    }
  })
  return { code: 0, message: 'ok', data }
}

// ========== 管理员权限校验 ==========
async function checkAdmin(OPENID) {
  try {
    const r = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    return !!(r.data && r.data[0] && r.data[0].role === 'admin')
  } catch (e) {
    return false
  }
}

// ========== 发送雁书（P0-3 安全加固+P1-4 订阅状态记录） ==========
async function sendLetter(OPENID, data) {
  const { carrier: carrierKey, dynasty, figureId, subscribed = false } = data
  const content = String(data.content || '').trim()
  const fromName = String(data.fromName || '').trim().slice(0, 20) || '远方友人'

  // 1. 内容基础校验
  if (!content) return { code: -1, message: '请书写信笺内容' }
  if (content.length > 150) return { code: -1, message: '信笺内容不超过150字' }

  const carrier = common.CARRIERS[carrierKey]
  if (!carrier) return { code: -1, message: '未知信使' }

  if (carrier.adminOnly) {
    const isAdmin = await checkAdmin(OPENID)
    if (!isAdmin) return { code: -1, message: '该信使尚未解锁' }
  }

  // 2. content 安全审核（fail-open：异常时放行，标记 pending）
  const sec = await common.checkText(content, OPENID)
  if (!sec.ok) return { code: 403, message: sec.reason }

  // 3. fromName 安全审核（非默认值时）
  if (fromName !== '远方友人') {
    const nameSec = await common.checkText(fromName, OPENID)
    if (!nameSec.ok) return { code: 403, message: '署名包含不当内容' }
  }

  // 4. 发送频率限制：每用户每小时最多5封
  const oneHourAgo = Date.now() - 3600000
  const recentCount = await db.collection('yan_letters')
    .where({
      _openid: OPENID,
      sentAt: _.gt(oneHourAgo)
    })
    .count()
  if ((recentCount.total || 0) >= 5) {
    return { code: -1, message: '鸿雁需歇息，请稍后再试' }
  }

  // 5. 确保人物数据已加载
  await common.loadDbFigures()

  // 6. 投递目标判定（随机漂流 / 指定人物漂移）
  const isDrift = dynasty === 'random' || !figureId || figureId === 'random'
  let targetFigureId = figureId
  let drifted = false
  if (isDrift) {
    targetFigureId = common.randomFigure(null, dynasty).figureId
  } else if (carrier.accuracy < 1.0 && Math.random() > carrier.accuracy) {
    drifted = true
    targetFigureId = common.randomFigure(figureId).figureId
  }

  const figure = common.findFigure(targetFigureId)
  const now = Date.now()
  const letterId = 'yl_' + now + '_' + Math.random().toString(36).slice(2, 8)

  const letter = {
    _id: letterId,
    _openid: OPENID,
    carrier: carrierKey,
    carrierName: carrier.name,
    figureId: targetFigureId,
    figureName: figure.name,
    figureTitle: figure.title,
    dynasty: figure.dynasty,
    dynastyName: figure.dynastyName,
    content: content.trim(),
    fromName,
    status: 'traveling',
    drifted,
    deliveryMode: isDrift ? 'random' : 'direct',
    sentAt: now,
    arriveAt: now + carrier.duration,
    reply: null,
    gift: null,
    read: false,
    claimed: false,
    subscribed: !!subscribed,          // P1-4：订阅状态
    pendingReview: !!sec.pending,      // P0-3：安全审核待人工
    createdAt: db.serverDate()
  }

  await db.collection('yan_letters').add({ data: letter })

  return {
    code: 0, message: 'ok',
    data: {
      letterId,
      carrier: carrierKey,
      carrierName: carrier.name,
      figureName: figure.name,
      dynastyName: figure.dynastyName,
      duration: carrier.duration,
      arriveAt: letter.arriveAt,
      drifted
    }
  }
}

// ========== 获取记录列表（P0-2：不再调用 processArrived，仅轻量查询） ==========
async function getList(OPENID, data) {
  const { tab = 'all' } = data
  try {
    let where = { _openid: OPENID }
    if (tab === 'traveling') {
      where = _.and([
        { _openid: OPENID },
        _.or([{ status: 'traveling' }, { status: 'processing' }, { status: 'returned' }])
      ])
    }
    if (tab === 'arrived') {
      where.status = 'arrived'
    }

    const r = await db.collection('yan_letters')
      .where(where)
      .orderBy('sentAt', 'desc')
      .limit(100)
      .get()

    const letters = (r.data || []).map(l => formatLetter(l))
    const unread = letters.filter(l => l.status === 'arrived' && !l.read).length

    return { code: 0, message: 'ok', data: { letters, unread } }
  } catch (e) {
    return { code: 0, message: 'ok', data: { letters: [], unread: 0 } }
  }
}

// ========== 信件详情（P0-2：不再调用 processArrived） ==========
async function getDetail(OPENID, data) {
  const { letterId } = data
  if (!letterId) return { code: -1, message: '缺少 letterId' }
  try {
    const r = await db.collection('yan_letters').doc(letterId).get()
    if (!r.data) return { code: -1, message: '信件不存在' }
    if (r.data._openid !== OPENID) return { code: 403, message: '无权限' }
    return { code: 0, message: 'ok', data: formatLetter(r.data) }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// ========== 标记已读 ==========
async function markRead(OPENID, data) {
  const { letterId } = data
  if (!letterId) return { code: -1, message: '缺少 letterId' }
  try {
    const r = await db.collection('yan_letters').doc(letterId).get()
    if (!r.data) return { code: -1, message: '信件不存在' }
    if (r.data._openid !== OPENID) return { code: 403, message: '无权限' }
    if (r.data.status === 'returned') {
      const receiveResult = await db.collection('yan_letters')
        .where({ _id: letterId, _openid: OPENID, status: 'returned' })
        .update({ data: { read: true, status: 'arrived', receivedAt: db.serverDate() } })
      if (receiveResult.stats && receiveResult.stats.updated && r.data.gift && !r.data.claimed) {
        await collectGift(OPENID, r.data.gift)
        await db.collection('yan_letters').doc(letterId).update({ data: { claimed: true } })
      }
    } else {
      await db.collection('yan_letters').doc(letterId).update({ data: { read: true } })
    }
    const received = await db.collection('yan_letters').doc(letterId).get()
    return { code: 0, message: 'ok', data: formatLetter(received.data) }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

async function collectGift(OPENID, gift) {
  const existR = await db.collection('yan_user_gifts')
    .where({ _openid: OPENID, giftId: gift.id })
    .limit(1)
    .get()
  if (existR.data && existR.data.length) {
    await db.collection('yan_user_gifts').doc(existR.data[0]._id).update({
      data: { count: _.inc(1), lastAt: db.serverDate() }
    })
  } else {
    await db.collection('yan_user_gifts').add({
      data: {
        _openid: OPENID,
        giftId: gift.id,
        name: gift.name,
        icon: gift.icon,
        rarity: gift.rarity,
        rarityLabel: gift.rarityLabel,
        type: gift.type,
        desc: gift.desc,
        count: 1,
        firstAt: db.serverDate(),
        lastAt: db.serverDate()
      }
    })
  }
}

// ========== 领取风物入藏馆 ==========
async function claimGift(OPENID, data) {
  const { letterId } = data
  if (!letterId) return { code: -1, message: '缺少 letterId' }
  try {
    const r = await db.collection('yan_letters').doc(letterId).get()
    if (!r.data) return { code: -1, message: '信件不存在' }
    if (r.data._openid !== OPENID) return { code: 403, message: '无权限' }
    if (!r.data.gift) return { code: -1, message: '信件尚无风物' }
    if (r.data.claimed) return { code: 0, message: '已领取', data: { alreadyClaimed: true } }

    await db.collection('yan_letters').doc(letterId).update({ data: { claimed: true } })

    const gift = r.data.gift
    await collectGift(OPENID, gift)

    return { code: 0, message: 'ok', data: { gift } }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// ========== 藏馆列表 ==========
async function getCollection(OPENID, data) {
  const { filter = 'all' } = data
  try {
    let where = { _openid: OPENID }
    if (filter !== 'all') where.type = filter

    const r = await db.collection('yan_user_gifts')
      .where(where)
      .orderBy('rarity', 'desc')
      .orderBy('firstAt', 'desc')
      .limit(200)
      .get()

    const collected = r.data || []
    const collectedIds = collected.map(g => g.giftId)
    const locked = common.GIFT_POOL.filter(g => !collectedIds.includes(g.id)).map(g => ({
      giftId: g.id,
      name: g.name,
      icon: g.icon,
      rarity: g.rarity,
      rarityLabel: common.RARITY_LABELS[g.rarity],
      type: g.type,
      desc: g.desc,
      count: 0,
      locked: true
    }))

    const stats = {
      collected: collected.length,
      total: common.GIFT_POOL.length,
      rare: collected.filter(g => g.rarity >= 3).length,
      completion: Math.round(collected.length / common.GIFT_POOL.length * 1000) / 10
    }

    return {
      code: 0, message: 'ok',
      data: {
        collected: collected.map(g => ({
          _id: g._id,
          giftId: g.giftId,
          name: g.name,
          icon: g.icon,
          rarity: g.rarity,
          rarityLabel: g.rarityLabel,
          type: g.type,
          desc: g.desc,
          count: g.count || 1,
          locked: false
        })),
        locked,
        stats
      }
    }
  } catch (e) {
    return { code: 0, message: 'ok', data: {
      collected: [],
      locked: common.GIFT_POOL.map(g => ({
        giftId: g.id, name: g.name, icon: g.icon, rarity: g.rarity,
        rarityLabel: common.RARITY_LABELS[g.rarity], type: g.type, locked: true
      })),
      stats: { collected: 0, total: common.GIFT_POOL.length, rare: 0, completion: 0 }
    } }
  }
}

function formatLetter(l) {
  return {
    _id: l._id,
    carrier: l.carrier,
    carrierName: l.carrierName,
    figureId: l.figureId,
    figureName: l.figureName,
    figureTitle: l.figureTitle,
    dynasty: l.dynasty,
    dynastyName: l.dynastyName,
    content: l.content,
    fromName: l.fromName,
    status: l.status,
    drifted: l.drifted || false,
    deliveryMode: l.deliveryMode || 'direct',
    sentAt: l.sentAt,
    arriveAt: l.arriveAt,
    reply: l.reply,
    gift: l.gift,
    read: l.read,
    claimed: l.claimed,
    pendingReview: l.pendingReview || false
  }
}

// ========== 保留 processArrived（不调用），供向后兼容或手动触发调试 ==========
async function processArrived(OPENID) {
  const now = Date.now()
  try {
    const r = await db.collection('yan_letters')
      .where(_.and([
        { _openid: OPENID },
        _.or([
          { status: 'traveling', arriveAt: _.lte(now) },
          { status: 'processing', processingAt: _.lt(now - PROCESSING_STALE_MS) }
        ])
      ]))
      .limit(20)
      .get()

    for (const letter of r.data) {
      try {
        const lock = await db.collection('yan_letters')
          .where({ _id: letter._id, _openid: OPENID, status: letter.status })
          .update({ data: { status: 'processing', processingAt: now } })
        if (!lock.stats || !lock.stats.updated) continue

        const figure = common.findFigure(letter.figureId)
        const carrier = common.CARRIERS[letter.carrier] || common.CARRIERS.qinghong
        const reply = await common.generateReply(figure, letter.content, letter.fromName)
        const gift = common.dropGift(carrier.power)

        await db.collection('yan_letters').doc(letter._id).update({
          data: {
            status: 'arrived',
            processingAt: _.remove(),
            reply: _.set({ content: reply.content, figureName: figure.name, source: reply.source }),
            gift: _.set(gift),
            arrivedAt: db.serverDate()
          }
        })

        common.tryUnlock(OPENID, 'first_letter')
        ;(async () => {
          try {
            const cnt = await db.collection('yan_letters').where({ _openid: OPENID, status: 'arrived' }).count()
            if ((cnt.total || 0) >= 5) await common.tryUnlock(OPENID, 'letter_5')
            if ((cnt.total || 0) >= 10) await common.tryUnlock(OPENID, 'letter_10')
          } catch (e) {}
        })()
      } catch (e) {
        console.warn('processArrived single fail:', e.message)
        try {
          await db.collection('yan_letters')
            .where({ _id: letter._id, _openid: OPENID, status: 'processing' })
            .update({ data: { status: 'traveling', processingAt: _.remove() } })
        } catch (rollbackErr) {}
      }
    }
  } catch (e) {
    console.warn('processArrived fail:', e.message)
  }
}
