// cloudfunctions/yan-timer/index.js
// 定时任务：扫描到期信件，先生成回信与风物并标记为已返回，用户查看后再归档为已收信
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const common = require('./common')

const PROCESSING_STALE_MS = 2 * 60 * 1000

// 订阅消息模板ID（TODO：微信公众平台创建模板后替换此处）
const SUBSCRIBE_TEMPLATE_ID = process.env.YAN_SUBSCRIBE_TEMPLATE_ID || ''

exports.main = async () => {
  const now = Date.now()
  const startAt = Date.now()
  try {
    // 跨用户批量查询所有到期信件
    const r = await db.collection('yan_letters')
      .where(_.or([
        { status: 'traveling', arriveAt: _.lte(now) },
        { status: 'processing', processingAt: _.lt(now - PROCESSING_STALE_MS) }
      ]))
      .orderBy('sentAt', 'asc')
      .limit(50)
      .get()

    if (!r.data || !r.data.length) {
      return { code: 0, processed: 0, total: 0, duration: Date.now() - startAt }
    }

    // 分批并行，每批最多5个并发避免 DB 连接耗尽
    const batches = []
    for (let i = 0; i < r.data.length; i += 5) {
      batches.push(r.data.slice(i, i + 5))
    }

    let processed = 0
    let failed = 0
    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(letter => processOneLetter(letter, now))
      )
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value) {
          processed++
        } else if (r.status === 'rejected') {
          failed++
          console.warn('batch letter reject:', batch[idx]._id, r.reason && r.reason.message)
        }
      })
    }

    return {
      code: 0,
      processed,
      failed,
      total: r.data.length,
      duration: Date.now() - startAt
    }
  } catch (err) {
    console.error('yan-timer fatal error:', err)
    return { code: -1, processed: 0, error: err.message, duration: Date.now() - startAt }
  }
}

async function processOneLetter(letter, now) {
  try {
    // 1. 原子抢占：仅当状态仍是 traveling / processing 时才更新为 processing
    const lock = await db.collection('yan_letters')
      .where({
        _id: letter._id,
        _openid: letter._openid,
        status: letter.status
      })
      .update({ data: { status: 'processing', processingAt: now } })

    if (!lock.stats || !lock.stats.updated) {
      // 已被其他实例抢占
      return false
    }

    // 2. 加载人物信息
    await common.loadDbFigures()
    const figure = common.findFigure(letter.figureId)
    const carrier = common.CARRIERS[letter.carrier] || common.CARRIERS.qinghong

    // 3. 查询最近2轮与该人物的通信历史（仅已到达的）
    let history = []
    try {
      const historyRes = await db.collection('yan_letters')
        .where({
          _openid: letter._openid,
          figureId: letter.figureId,
          status: 'arrived'
        })
        .orderBy('sentAt', 'desc')
        .limit(2)
        .field({ content: true, reply: true })
        .get()
      history = (historyRes.data || []).reverse().map(h => ({
        content: h.content,
        reply: h.reply ? h.reply.content : ''
      }))
    } catch (err) {
      console.warn('query history fail:', err.message)
      history = []
    }

    // 4. 生成回信（AI or 模板，返回 {content, source}）
    const reply = await common.generateReply(figure, letter.content, letter.fromName, history)

    // 5. 掉落风物（基于角色专属 + 朝代文物 + 稀有度衰减）
    const gift = common.dropGift(carrier.power, letter.figureId, figure.dynasty)

    // 6. 更新信件为 arrived
    await db.collection('yan_letters').doc(letter._id).update({
      data: {
        status: 'returned',
        processingAt: _.remove(),
        reply: _.set({ content: reply.content, figureName: figure.name, source: reply.source }),
        gift: _.set(gift),
        arrivedAt: db.serverDate()
      }
    })

    // 7. 成就检查
    try {
      await common.tryUnlock(letter._openid, 'first_letter')
      const cnt = await db.collection('yan_letters')
        .where({ _openid: letter._openid, status: 'returned' })
        .count()
      const total = cnt.total || 0
      if (total >= 5) await common.tryUnlock(letter._openid, 'letter_5')
      if (total >= 10) await common.tryUnlock(letter._openid, 'letter_10')
    } catch (err) {
      console.warn('achievement check fail:', err.message)
    }

    // 8. 推送订阅消息
    try {
      await sendSubscribeNotification(letter, figure, gift)
    } catch (err) {
      console.warn('subscribe notification send fail:', err.message)
    }

    return true
  } catch (e) {
    console.warn('processOneLetter fail:', letter._id, e && e.message)
    // 回滚为 traveling，下次定时器重试
    try {
      await db.collection('yan_letters')
        .where({
          _id: letter._id,
          _openid: letter._openid,
          status: 'processing'
        })
        .update({ data: { status: 'traveling', processingAt: _.remove() } })
    } catch (rollbackErr) {
      console.warn('rollback fail:', rollbackErr.message)
    }
    return false
  }
}

// 推送订阅消息：信件到达+风物提示
async function sendSubscribeNotification(letter, figure, gift) {
  if (!letter.subscribed) return
  if (!SUBSCRIBE_TEMPLATE_ID) {
    // 未配置模板ID，跳过
    return
  }
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: letter._openid,
      templateId: SUBSCRIBE_TEMPLATE_ID,
      page: 'pages/yan/records',
      data: {
        thing1: { value: (figure.name || '古代贤人') + '的回信' },
        thing2: { value: (letter.carrierName || '信使') + '已送达' },
        thing3: { value: gift ? gift.name : '一封笺书' }
      }
    })
  } catch (e) {
    throw e
  }
}
