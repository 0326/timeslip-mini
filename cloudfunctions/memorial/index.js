const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const REWARDS = {
  first_chat: 10, first_letter: 10, first_like: 5,
  dna_done: 20, first_visit: 10, first_profile: 10,
  chat_10: 30, chat_50: 80, letter_5: 50, comment_10: 30,
  chat_100: 150, letter_10: 100,
  first_memorial: 20,
  memorial_5: 80,
  memorial_20: 200,
  memorial_century: 500,
  memorial_daily_clear: 100,
  memorial_zhupi_100: 80,
  memorial_secret_all: 120,
  memorial_retain_10: 100,
  memorial_wisdom_90: 300,
  wisdom_75: 150,
  type_all: 200,
  read_book: 15, read_5: 100, dna_share: 30,
  all_dynasties: 200, collector: 500, time_master: 1000,
  all_figures: 300, moment_popular: 200, memorial_master: 500
}

// 成就元信息（用于前端解锁弹窗展示 name / desc）
const ACHIEVEMENT_INFO = {
  first_memorial:  { name: '初批奏折', desc: '第一次批阅奏折' },
  memorial_5:      { name: '勤政之君', desc: '累计批阅5份奏折' },
  memorial_20:     { name: '日理万机', desc: '累计批阅20份奏折' },
  memorial_master: { name: '批阅狂人', desc: '累计批阅50份奏折' },
  memorial_century:      { name: '百年批览',   desc: '累计批阅100份奏折' },
  memorial_daily_clear:  { name: '今日事今日毕', desc: '首次清完当日奏折队列' },
  memorial_zhupi_100:    { name: '朱批不倦',   desc: '累计朱批总字数达100字' },
  memorial_secret_all:   { name: '洞察机密',   desc: '批阅完所有密折' },
  memorial_retain_10:    { name: '深沉莫测',   desc: '累计留中10份奏折' },
  memorial_wisdom_90:    { name: '圣明之君',   desc: '圣明指数达到90以上' },
  wisdom_75:             { name: '贤明之主',   desc: '圣明指数达到75以上' },
  type_all:              { name: '兼容并包',   desc: '批阅过五种类型的奏折' }
}

async function tryUnlock(OPENID, key) {
  try {
    const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (!userRes.data || !userRes.data.length) return { ok: false, reason: 'no_user', key: key }
    const user = userRes.data[0]
    const achievements = user.achievements || []
    if (achievements.some(function(a) { return a.key === key })) {
      return { ok: false, reason: 'already_unlocked', key: key }
    }
    const reward = REWARDS[key] || 0
    achievements.push({ key: key, unlockedAt: new Date() })
    await db.collection('users').doc(user._id).update({
      data: {
        achievements: achievements,
        points: _.inc(reward),
        updatedAt: db.serverDate()
      }
    })
    return { ok: true, reward: reward, key: key }
  } catch (e) {
    console.warn('tryUnlock fail', key, e.message)
    return { ok: false, error: e.message, key: key }
  }
}

async function secCheckText(text, openid) {
  if (!text) return { ok: true }
  try {
    const r = await cloud.openapi.security.msgSecCheck({
      openid: openid,
      version: 2,
      scene: 1,
      content: String(text).slice(0, 2000)
    })
    if (r && r.result && r.result.suggest !== 'pass') {
      return { ok: false, reason: '朱批内容包含不当信息，请修改后重试' }
    }
    return { ok: true }
  } catch (e) {
    console.warn('secCheckText warn:', e.message)
    return { ok: true }
  }
}

function getTodayStr() {
  var d = new Date()
  var y = d.getFullYear()
  var m = d.getMonth() + 1
  var day = d.getDate()
  return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day)
}

function weightedPickMemorials(allMemorials, categoriesCfg, count, excludeIds, allowQipaProb) {
  var bucket = {}
  for (var i = 0; i < allMemorials.length; i++) {
    var m = allMemorials[i]
    if (excludeIds && excludeIds.indexOf(m._id) >= 0) continue
    if (!bucket[m.type]) bucket[m.type] = []
    bucket[m.type].push(m)
  }
  var targets = {}
  for (var j = 0; j < categoriesCfg.length; j++) {
    var c = categoriesCfg[j]
    if (c.ratio > 0) targets[c.type] = c.ratio
  }
  var picks = []
  var usedIds = {}
  var typeKeys = Object.keys(targets)
  for (var k = 0; k < typeKeys.length; k++) {
    var tk = typeKeys[k]
    var need = targets[tk]
    var pool = bucket[tk] || []
    var shuffled = pool.slice().sort(function() { return Math.random() - 0.5 })
    for (var p = 0; p < need && p < shuffled.length; p++) {
      if (!usedIds[shuffled[p]._id]) {
        picks.push(shuffled[p])
        usedIds[shuffled[p]._id] = true
      }
    }
  }
  if (allowQipaProb && Math.random() < allowQipaProb && bucket['奇葩折'] && bucket['奇葩折'].length && picks.length < count) {
    var qp = bucket['奇葩折'].sort(function() { return Math.random() - 0.5 })[0]
    if (!usedIds[qp._id]) {
      picks.push(qp)
      usedIds[qp._id] = true
    }
  }
  var remainList = allMemorials.filter(function(m) {
    return !usedIds[m._id] && excludeIds.indexOf(m._id) < 0
  })
  remainList.sort(function() { return Math.random() - 0.5 })
  for (var ri = 0; ri < remainList.length && picks.length < count; ri++) {
    picks.push(remainList[ri])
  }
  picks.sort(function(a, b) { return (a.order || 0) - (b.order || 0) })
  return picks.slice(0, count)
}

async function getUserStats(OPENID) {
  var stats = { total: 0, retain: 0, zhupi_len: 0, secret: 0, daily_clear_days: 0, wisdom: 50, first_time: true }
  try {
    const uRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (uRes.data && uRes.data.length) {
      var ms = uRes.data[0].memorial_stats || {}
      stats.total = ms.total_done || 0
      stats.retain = ms.retain_count || 0
      stats.zhupi_len = ms.zhupi_total_len || 0
      stats.secret = ms.secret_done || 0
      stats.daily_clear_days = ms.daily_clear_days || 0
      stats.wisdom = typeof uRes.data[0].wisdom_index === 'number' ? uRes.data[0].wisdom_index : 50
      stats.first_time = false
    }
  } catch (e) {
    console.warn('getUserStats warn:', e.message)
  }
  return stats
}

async function updateUserStats(OPENID, delta) {
  try {
    const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (!userRes.data || !userRes.data.length) return { ok: false }
    const user = userRes.data[0]
    var incData = {}
    if (delta.total_done) incData['memorial_stats.total_done'] = _.inc(delta.total_done)
    if (delta.retain_count) incData['memorial_stats.retain_count'] = _.inc(delta.retain_count)
    if (delta.zhupi_total_len) incData['memorial_stats.zhupi_total_len'] = _.inc(delta.zhupi_total_len)
    if (delta.secret_done) incData['memorial_stats.secret_done'] = _.inc(delta.secret_done)
    if (delta.daily_clear_days) incData['memorial_stats.daily_clear_days'] = _.inc(delta.daily_clear_days)
    var oldWisdom = typeof user.wisdom_index === 'number' ? user.wisdom_index : 50
    var newWisdom = oldWisdom + (delta.wisdom_delta || 0)
    if (newWisdom > 100) newWisdom = 100
    if (newWisdom < 0) newWisdom = 0
    incData.wisdom_index = newWisdom
    incData.updatedAt = db.serverDate()
    await db.collection('users').doc(user._id).update({ data: incData })
    return { ok: true, new_wisdom: newWisdom }
  } catch (e) {
    console.warn('updateUserStats err:', e.message)
    return { ok: false, error: e.message }
  }
}

async function actionDaily(OPENID, body) {
  var today = getTodayStr()
  var dailyCol = db.collection('memorial_daily')
  var userStats = await getUserStats(OPENID)
  var initialWisdom = userStats.wisdom
  var cfg = null
  try {
    var cRes = await db.collection('memorial_config').where({ _id: 'main_config' }).limit(1).get()
    if (cRes.data && cRes.data.length) cfg = cRes.data[0]
  } catch (_) {}
  if (!cfg) {
    cfg = {
      daily_count: 10, max_queue: 30, initial_wisdom: 50,
      categories: [
        { type: '奏事折', ratio: 6 }, { type: '密折', ratio: 2 },
        { type: '请安折', ratio: 1 }, { type: '谢恩折', ratio: 1 },
        { type: '奇葩折', ratio: 0 }
      ]
    }
  }
  var todayDoc = null
  try {
    var tRes = await dailyCol.where({ _openid: OPENID, date: today }).limit(1).get()
    if (tRes.data && tRes.data.length) todayDoc = tRes.data[0]
  } catch (e) { console.warn('daily load warn:', e.message) }

  var doneIds = []
  try {
    var aRes = await db.collection('memorial_answers').where({ _openid: OPENID }).field({ memorial_id: true }).limit(1000).get()
    if (aRes.data) doneIds = aRes.data.map(function(x) { return x.memorial_id }).filter(Boolean)
  } catch (_) {}

  if (!todayDoc) {
    var allMem = []
    try {
      var mRes = await db.collection('memorials').limit(500).get()
      allMem = mRes.data || []
    } catch (e) {
      return { code: 1, message: 'memorials load fail: ' + e.message }
    }
    var picks = weightedPickMemorials(allMem, cfg.categories, cfg.daily_count, doneIds, 0.18)
    var queue = picks.map(function(m) {
      return {
        memorial_id: m._id, order: m.order || 0, type: m.type,
        title: m.title, official_name: (m.official && m.official.name) || '',
        official_title: (m.official && m.official.title) || '',
        created_at: new Date()
      }
    })
    var toSave = {
      _openid: OPENID, date: today, queue: queue, completed_ids: [],
      wisdom_index: initialWisdom, carryover_count: 0,
      created_at: db.serverDate(), updated_at: db.serverDate()
    }
    try {
      var addRes = await dailyCol.add({ data: toSave })
      toSave._id = addRes._id
    } catch (e) {
      return { code: 1, message: 'daily create fail: ' + e.message }
    }
    todayDoc = toSave
  } else {
    var needCarry = false
    if (todayDoc.queue && todayDoc.queue.length < cfg.daily_count) needCarry = true
    if (needCarry) {
      var allMem2 = []
      try {
        var m2 = await db.collection('memorials').limit(500).get()
        allMem2 = m2.data || []
      } catch (_) {}
      var existQ = todayDoc.queue || []
      var existIds = existQ.map(function(x) { return x.memorial_id }).concat(doneIds)
      var remainCount = cfg.daily_count - existQ.length + 2
      var newOnes = weightedPickMemorials(allMem2, cfg.categories, remainCount, existIds, 0.18)
      var newQueueItems = newOnes.map(function(m) {
        return {
          memorial_id: m._id, order: m.order || 0, type: m.type,
          title: m.title, official_name: (m.official && m.official.name) || '',
          official_title: (m.official && m.official.title) || '',
          created_at: new Date(), carried: true
        }
      })
      var mergedQ = existQ.concat(newQueueItems)
      try {
        await dailyCol.doc(todayDoc._id).update({
          data: { queue: mergedQ, carryover_count: _.inc(newQueueItems.length), updated_at: db.serverDate() }
        })
        todayDoc.queue = mergedQ
        todayDoc.carryover_count = (todayDoc.carryover_count || 0) + newQueueItems.length
      } catch (e) { console.warn('daily carry err:', e.message) }
    }
  }

  var completed = todayDoc.completed_ids || []
  var queueWithState = (todayDoc.queue || []).map(function(q) {
    return {
      memorial_id: q.memorial_id, order: q.order, type: q.type, title: q.title,
      official_name: q.official_name, official_title: q.official_title,
      carried: !!q.carried, done: completed.indexOf(q.memorial_id) >= 0
    }
  })

  return {
    code: 0,
    data: {
      date: today,
      queue: queueWithState,
      completed_count: completed.length,
      total_count: queueWithState.length,
      wisdom_index: initialWisdom,
      daily_count: cfg.daily_count,
      first_time: userStats.first_time,
      carryover_count: todayDoc.carryover_count || 0,
      daily_clear: queueWithState.length > 0 && completed.length >= queueWithState.length
    }
  }
}

async function actionDetail(OPENID, body) {
  var memorialId = body.memorial_id || body.memorialId
  if (!memorialId) return { code: 1, message: '缺少memorial_id' }
  var mem = null
  try {
    var mRes = await db.collection('memorials').doc(memorialId).get()
    mem = mRes.data
  } catch (e) {
    return { code: 1, message: '奏折不存在或已被删除: ' + e.message }
  }
  if (!mem) return { code: 1, message: '奏折不存在' }
  var myAnswer = null
  try {
    var aRes = await db.collection('memorial_answers')
      .where({ _openid: OPENID, memorial_id: memorialId })
      .orderBy('created_at', 'desc').limit(1).get()
    if (aRes.data && aRes.data.length) myAnswer = aRes.data[0]
  } catch (_) {}
  return {
    code: 0,
    data: {
      _id: mem._id, order: mem.order, type: mem.type, title: mem.title, content: mem.content,
      background: mem.background || '', official: mem.official || null,
      options: mem.options || [], preset_vermilion: mem.preset_vermilion || '',
      historical_fact: mem.historical_fact || '', fun_fact: mem.fun_fact || '',
      trivia: mem.trivia || '', trivia_topic: mem.trivia_topic || '',
      answered: !!myAnswer,
      my_answer: myAnswer ? {
        decision: myAnswer.decision, decision_label: myAnswer.decision_label,
        zhupi: myAnswer.zhupi, retained: !!myAnswer.retained,
        wisdom_delta: myAnswer.wisdom_delta, consequence: myAnswer.consequence,
        follow_up: myAnswer.follow_up, created_at: myAnswer.created_at
      } : null
    }
  }
}

function unlockResultsSummary(arr) {
  var out = []
  for (var i = 0; i < arr.length; i++) {
    var r = arr[i]
    if (r && r.ok && typeof r.reward === 'number') {
      var info = ACHIEVEMENT_INFO[r.key] || { name: '成就解锁', desc: '' }
      out.push({
        achievement_id: r.key,
        name: info.name,
        desc: info.desc,
        reward: r.reward
      })
    }
  }
  return out
}

async function actionDecide(OPENID, body) {
  var memorialId = body.memorial_id || body.memorialId
  var decision = body.decision
  var customZhupi = body.custom_zhupi || body.customZhupi || ''
  var presetQuick = !!body.preset_quick || !!body.presetQuick
  if (!memorialId || !decision) return { code: 1, message: '缺少参数memorial_id或decision' }
  if (customZhupi && customZhupi.length > 500) return { code: 1, message: '朱批过长' }
  var sec = await secCheckText(customZhupi, OPENID)
  if (!sec.ok) return { code: 2, message: sec.reason }
  var mem = null
  try {
    mem = (await db.collection('memorials').doc(memorialId).get()).data
  } catch (e) {
    return { code: 1, message: '奏折不存在: ' + e.message }
  }
  if (!mem) return { code: 1, message: '奏折不存在' }
  try {
    var already = await db.collection('memorial_answers')
      .where({ _openid: OPENID, memorial_id: memorialId }).count()
    if (already && already.total > 0) return { code: 3, message: '此折已批阅' }
  } catch (_) {}

  var type = mem.type
  var finalZhupi = ''
  var consequence = ''
  var wisdomDelta = 0
  var decisionLabel = ''
  var retained = false
  var optionChosen = null

  // 压缩单次圣明指数的增减，保持"方向感"但数值收敛：
  // 原始wisdom_delta（可能是+4/+3/+2/+1/0/-1/-2/-3等）映射到 [-2, +2] 整数区间，避免一日猛涨几十点
  function compressWisdom(raw) {
    if (raw >= 3) return 2
    if (raw >= 1) return 1
    if (raw === 0) return 0
    if (raw <= -3) return -2
    if (raw <= -1) return -1
    return 0
  }
  if (decision === 'retain') {
    if (type !== '密折') return { code: 1, message: '非密折不可留中' }
    retained = true
    finalZhupi = customZhupi || '留中不发'
    decisionLabel = '留中'
    consequence = '此折留中，不发内阁，不抄录副。外界无第三人知。'
    var ust = await getUserStats(OPENID)
    var temp = ust.retain + 1
    // 留中惩罚从-3缩到-1（每3次）
    wisdomDelta = temp > 0 && temp % 3 === 0 ? -1 : 0
  } else if (type === '请安折' || type === '谢恩折') {
    finalZhupi = presetQuick ? (mem.preset_vermilion || '知道了') : (customZhupi || (mem.preset_vermilion || '知道了'))
    decisionLabel = '朱批'
    consequence = '朱批发出，圣颜甚慰'
    // 请安折从+2缩到+1（日常流程，仅给1点正向），谢恩折从+1缩到0（基本礼仪不加分）
    wisdomDelta = type === '请安折' ? 1 : 0
  } else {
    var opts = mem.options || []
    for (var oi = 0; oi < opts.length; oi++) {
      if (opts[oi].id === decision) { optionChosen = opts[oi]; break }
    }
    if (!optionChosen) return { code: 1, message: 'decision参数错误' }
    decisionLabel = optionChosen.label
    finalZhupi = customZhupi || optionChosen.vermilion || ''
    consequence = optionChosen.consequence || ''
    wisdomDelta = compressWisdom(optionChosen.wisdom_delta || 0)
  }

  var followUp = (optionChosen && optionChosen.follow_up) || ''
  var zhupiLen = finalZhupi.length
  var ansId = null
  try {
    var addAns = await db.collection('memorial_answers').add({
      data: {
        _openid: OPENID, memorial_id: memorialId, memorial_title: mem.title,
        memorial_type: mem.type,
        official_name: (mem.official && mem.official.name) || '',
        official_title: (mem.official && mem.official.title) || '',
        decision: decision, decision_label: decisionLabel, zhupi: finalZhupi, retained: retained,
        wisdom_delta: wisdomDelta, consequence: consequence, follow_up: followUp,
        option_id: (optionChosen && optionChosen.id) || '', created_at: db.serverDate()
      }
    })
    ansId = addAns._id
  } catch (e) {
    return { code: 1, message: 'answers write fail: ' + e.message }
  }

  var today = getTodayStr()
  var dailyCol = db.collection('memorial_daily')
  try {
    var todayRes = await dailyCol.where({ _openid: OPENID, date: today }).limit(1).get()
    if (todayRes.data && todayRes.data.length) {
      var d = todayRes.data[0]
      var comp = d.completed_ids || []
      if (comp.indexOf(memorialId) < 0) comp.push(memorialId)
      await dailyCol.doc(d._id).update({
        data: { completed_ids: comp, updated_at: db.serverDate() }
      })
    }
  } catch (e) { console.warn('daily update warn:', e.message) }

  // 每日增量上限（当天圣明指数最多涨7点、最多降7点），保证至少7天连续满批才能到"圣明之君"
  var oldUserWisdom = 50
  try {
    const uu = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (uu.data && uu.data.length) oldUserWisdom = typeof uu.data[0].wisdom_index === 'number' ? uu.data[0].wisdom_index : 50
  } catch (_) {}
  try {
    const dt = await dailyCol.where({ _openid: OPENID, date: today }).limit(1).get()
    if (dt.data && dt.data.length && typeof dt.data[0].wisdom_index === 'number') {
      var initToday = dt.data[0].wisdom_index
      var tentative = oldUserWisdom + wisdomDelta
      var maxAllow = initToday + 7
      var minAllow = initToday - 7
      if (tentative > maxAllow) tentative = maxAllow
      if (tentative < minAllow) tentative = minAllow
      if (tentative > 100) tentative = 100
      if (tentative < 0) tentative = 0
      wisdomDelta = tentative - oldUserWisdom
    }
  } catch (_e) { console.warn('daily wisdom cap warn:', _e.message) }

  var delta = {
    total_done: 1, retain_count: retained ? 1 : 0, zhupi_total_len: zhupiLen,
    secret_done: type === '密折' ? 1 : 0, wisdom_delta: wisdomDelta
  }
  var uStatsAfter = await updateUserStats(OPENID, delta)
  var newTotal = (await getUserStats(OPENID)).total
  var unlocks = []
  if (newTotal >= 1) unlocks.push(tryUnlock(OPENID, 'first_memorial'))
  if (newTotal >= 5) unlocks.push(tryUnlock(OPENID, 'memorial_5'))
  if (newTotal >= 20) unlocks.push(tryUnlock(OPENID, 'memorial_20'))
  if (newTotal >= 100) unlocks.push(tryUnlock(OPENID, 'memorial_century'))
  if (zhupiLen >= 100) unlocks.push(tryUnlock(OPENID, 'memorial_zhupi_100'))
  if (retained) {
    var retC = (await getUserStats(OPENID)).retain
    if (retC >= 10) unlocks.push(tryUnlock(OPENID, 'memorial_retain_10'))
  }
  try {
    var sm = await db.collection('memorials').where({ type: '密折' }).count()
    var sa = await db.collection('memorial_answers').where({ _openid: OPENID, memorial_type: '密折' }).count()
    if (sm && sa && sm.total > 0 && sa.total >= sm.total) {
      unlocks.push(tryUnlock(OPENID, 'memorial_secret_all'))
    }
  } catch (_) {}
  try {
    var nu = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (nu.data && nu.data.length) {
      var wi = nu.data[0].wisdom_index
      if (wi >= 75) unlocks.push(tryUnlock(OPENID, 'wisdom_75'))
      if (wi >= 90) unlocks.push(tryUnlock(OPENID, 'memorial_wisdom_90'))
    }
  } catch (_) {}
  // type_all：五种类型都批阅过
  try {
    var ALL_TYPES = ['奏事折', '密折', '请安折', '谢恩折', '奇葩折']
    var hasAll = true
    for (var ti = 0; ti < ALL_TYPES.length; ti++) {
      try {
        var tc = await db.collection('memorial_answers').where({ _openid: OPENID, memorial_type: ALL_TYPES[ti] }).count()
        if (!tc || tc.total < 1) { hasAll = false; break }
      } catch (_t) { hasAll = false; break }
    }
    if (hasAll) unlocks.push(tryUnlock(OPENID, 'type_all'))
  } catch (_) {}
  try {
    var dt = await dailyCol.where({ _openid: OPENID, date: today }).limit(1).get()
    if (dt.data && dt.data.length) {
      var queue = dt.data[0].queue || []
      var compIds = queue.map(function(q) { return q.memorial_id })
      var miss = false
      for (var ci = 0; ci < compIds.length; ci++) {
        var ansC = await db.collection('memorial_answers').where({ _openid: OPENID, memorial_id: compIds[ci] }).count()
        if (ansC && ansC.total < 1) { miss = true; break }
      }
      if (queue.length > 0 && !miss) {
        unlocks.push(tryUnlock(OPENID, 'memorial_daily_clear'))
        try {
          var uu = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
          if (uu.data && uu.data.length) {
            var alreadyDay = (uu.data[0].memorial_stats && uu.data[0].memorial_stats.daily_clear_days) || 0
            if (alreadyDay === 0) {
              await updateUserStats(OPENID, { daily_clear_days: 1 })
            }
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  return {
    code: 0,
    data: {
      answer_id: ansId, memorial_id: memorialId, decision: decision,
      decision_label: decisionLabel, zhupi: finalZhupi, retained: retained,
      wisdom_delta: wisdomDelta, new_wisdom: uStatsAfter.new_wisdom,
      consequence: consequence, follow_up: followUp,
      historical_fact: mem.historical_fact || '', fun_fact: mem.fun_fact || '',
      trivia: mem.trivia || '', trivia_topic: mem.trivia_topic || '',
      unlocks: unlockResultsSummary(unlocks)
    }
  }
}

async function actionArchive(OPENID, body) {
  var page = body.page || 1
  var pageSize = body.page_size || body.pageSize || 10
  var filterType = body.filter_type || body.filterType || 'all'
  var col = db.collection('memorial_answers')
  var query = null
  if (filterType === 'all') {
    query = col.where({ _openid: OPENID })
  } else {
    query = col.where({ _openid: OPENID, memorial_type: filterType })
  }
  var skip = (page - 1) * pageSize
  var items = []
  var total = 0
  try {
    var cnt = await query.count()
    total = (cnt && cnt.total) || 0
  } catch (_) {}
  try {
    var list = await query.orderBy('created_at', 'desc').skip(skip).limit(pageSize).get()
    items = list.data || []
  } catch (e) {
    return { code: 1, message: 'archive query err: ' + e.message }
  }
  var stats = { total: 0, byType: {} }
  try {
    var sRes = await db.collection('memorial_answers').where({ _openid: OPENID }).limit(1000).get()
    var allA = sRes.data || []
    stats.total = allA.length
    for (var si = 0; si < allA.length; si++) {
      var t = allA[si].memorial_type || '其他'
      if (!stats.byType[t]) stats.byType[t] = 0
      stats.byType[t]++
    }
  } catch (_) {}
  return {
    code: 0,
    data: {
      items: items.map(function(a) {
        var t = a.created_at ? new Date(a.created_at) : null
        var label = ''
        if (t) {
          var y = t.getFullYear()
          var m = t.getMonth() + 1
          var d = t.getDate()
          label = y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d)
        }
        return {
          _id: a._id, memorial_id: a.memorial_id, memorial_title: a.memorial_title,
          memorial_type: a.memorial_type,
          official_name: a.official_name || '',
          official_title: a.official_title || '',
          decision_label: a.decision_label, zhupi: a.zhupi, retained: !!a.retained,
          wisdom_delta: a.wisdom_delta,
          decided_at_label: label,
          created_at: a.created_at
        }
      }),
      pagination: { page: page, page_size: pageSize, total: total },
      stats: stats
    }
  }
}

function wisdomLevel(w) {
  if (w >= 90) return '圣明之君'
  if (w >= 75) return '贤明之主'
  if (w >= 55) return '中庸之君'
  if (w >= 30) return '平庸之主'
  return '昏聩之君'
}

async function actionWisdom(OPENID) {
  var userStats = await getUserStats(OPENID)
  return {
    code: 0,
    data: {
      wisdom_index: userStats.wisdom, total_done: userStats.total, retain_count: userStats.retain,
      zhupi_total_len: userStats.zhupi_len, secret_done: userStats.secret,
      daily_clear_days: userStats.daily_clear_days, level: wisdomLevel(userStats.wisdom)
    }
  }
}

exports.main = async function(event, context) {
  const wx = cloud.getWXContext()
  const OPENID = wx.OPENID
  const action = event.action || event.query || 'daily'
  const body = event.body || event.data || event
  switch (action) {
    case 'daily': return actionDaily(OPENID, body)
    case 'detail': return actionDetail(OPENID, body)
    case 'decide': return actionDecide(OPENID, body)
    case 'archive': return actionArchive(OPENID, body)
    case 'wisdom': return actionWisdom(OPENID)
    default:
      return { code: 1, message: '未知action: ' + action }
  }
}
