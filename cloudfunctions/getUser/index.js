const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const ICON_BASE = 'cloud://cloud1-d8guq74iacc68352a.636c-cloud1-d8guq74iacc68352a-1464144866/mini-assets/achievements/icons'
const iconUrl = (key) => `${ICON_BASE}/${key}.jpg`

const ALL_ACHIEVEMENTS = [
  // ── 初入穿越 (6) ──
  { key: 'first_chat', name: '初遇古人', desc: '第一次与历史人物聊天', category: 'beginner', iconUrl: iconUrl('first_chat'),
    unlockCondition: '与任意历史人物发送第一条消息', reward: '+10 穿越点' },
  { key: 'first_letter', name: '飞鸽初试', desc: '第一次通过飞鸽传书', category: 'beginner', iconUrl: iconUrl('first_letter'),
    unlockCondition: '成功发送并收到第一封回信', reward: '+10 穿越点' },
  { key: 'first_like', name: '点赞之交', desc: '第一次点赞朋友圈动态', category: 'beginner', iconUrl: iconUrl('first_like'),
    unlockCondition: '在朋友圈点赞任意一条动态', reward: '+5 穿越点' },
  { key: 'dna_done', name: '身世之谜', desc: '完成历史人格DNA测试', category: 'beginner', iconUrl: iconUrl('dna_done'),
    unlockCondition: '答完全部DNA测试题并生成结果', reward: '+20 穿越点' },
  { key: 'first_visit', name: '初探兰台', desc: '第一次进入兰台史书', category: 'beginner', iconUrl: iconUrl('first_visit'),
    unlockCondition: '首次进入兰台史书阅读页', reward: '+10 穿越点' },
  { key: 'first_profile', name: '身份认证', desc: '完成个人资料设置', category: 'beginner', iconUrl: iconUrl('first_profile'),
    unlockCondition: '设置昵称和头像完成个人资料', reward: '+10 穿越点' },

  // ── 交流互动 (6) ──
  { key: 'chat_10', name: '话痨之友', desc: '累计发送10条聊天消息', category: 'communicate', iconUrl: iconUrl('chat_10'),
    unlockCondition: '聊天消息发送总数达到10条', reward: '+30 穿越点' },
  { key: 'chat_50', name: '忘年之交', desc: '累计发送50条聊天消息', category: 'communicate', iconUrl: iconUrl('chat_50'),
    unlockCondition: '聊天消息发送总数达到50条', reward: '+80 穿越点' },
  { key: 'letter_5', name: '鸿雁传情', desc: '累计收到5封回信', category: 'communicate', iconUrl: iconUrl('letter_5'),
    unlockCondition: '共收到5封历史人物的回信', reward: '+50 穿越点' },
  { key: 'comment_10', name: '说古道今', desc: '累计在朋友圈发布10条评论', category: 'communicate', iconUrl: iconUrl('comment_10'),
    unlockCondition: '朋友圈评论数达到10条', reward: '+30 穿越点' },
  { key: 'chat_100', name: '知音难觅', desc: '累计发送100条聊天消息', category: 'communicate', iconUrl: iconUrl('chat_100'),
    unlockCondition: '聊天消息发送总数达到100条', reward: '+150 穿越点' },
  { key: 'letter_10', name: '尺素往来', desc: '累计收到10封回信', category: 'communicate', iconUrl: iconUrl('letter_10'),
    unlockCondition: '共收到10封历史人物的回信', reward: '+100 穿越点' },

  // ── 历史探索 (6) ──
  { key: 'first_memorial', name: '初批奏折', desc: '第一次批阅奏折', category: 'explore', iconUrl: iconUrl('first_memorial'),
    unlockCondition: '完成第一份奏折决策并查看推演结果', reward: '+20 穿越点' },
  { key: 'memorial_5', name: '勤政之君', desc: '累计批阅5份奏折', category: 'explore', iconUrl: iconUrl('memorial_5'),
    unlockCondition: '共完成5份奏折的批阅', reward: '+80 穿越点' },
  { key: 'read_book', name: '博览群书', desc: '第一次开启史书阅读', category: 'explore', iconUrl: iconUrl('read_book'),
    unlockCondition: '进入兰台史书阅读页并阅读超过3分钟', reward: '+15 穿越点' },
  { key: 'memorial_20', name: '日理万机', desc: '累计批阅20份奏折', category: 'explore', iconUrl: iconUrl('memorial_20'),
    unlockCondition: '共完成20份奏折的批阅', reward: '+200 穿越点' },
  { key: 'read_5', name: '学富五车', desc: '累计阅读5本史书', category: 'explore', iconUrl: iconUrl('read_5'),
    unlockCondition: '在兰台阅读5本不同的史书', reward: '+100 穿越点' },
  { key: 'dna_share', name: '身世分享', desc: '分享DNA测试结果', category: 'explore', iconUrl: iconUrl('dna_share'),
    unlockCondition: '将历史人格DNA测试结果分享到朋友圈', reward: '+30 穿越点' },

  // ── 稀世传奇 (6) ──
  { key: 'all_dynasties', name: '千古一帝', desc: '与各朝代至少一位人物聊过天', category: 'legend', iconUrl: iconUrl('all_dynasties'),
    unlockCondition: '秦汉、三国、唐、宋、明、清各朝至少一人都有过聊天记录', reward: '+200 穿越点 + 专属古风称号' },
  { key: 'collector', name: '金石收藏家', desc: '解锁80%的成就', category: 'legend', iconUrl: iconUrl('collector'),
    unlockCondition: '成就解锁进度达到80%', reward: '+500 穿越点 + 金色个人主页边框' },
  { key: 'time_master', name: '时空主宰', desc: '累计穿越积分达到1000', category: 'legend', iconUrl: iconUrl('time_master'),
    unlockCondition: '总穿越点数累积达到1000点', reward: '+1000 穿越点 + 专属稀有头像框' },
  { key: 'all_figures', name: '交友满天下', desc: '与所有历史人物聊过天', category: 'legend', iconUrl: iconUrl('all_figures'),
    unlockCondition: '与全部历史人物至少有过一次聊天记录', reward: '+300 穿越点 + 限定称号' },
  { key: 'moment_popular', name: '名动天下', desc: '朋友圈动态获得50个赞', category: 'legend', iconUrl: iconUrl('moment_popular'),
    unlockCondition: '单条朋友圈动态累计获得50个赞', reward: '+200 穿越点 + 热门标识' },
  { key: 'memorial_master', name: '批阅狂人', desc: '累计批阅50份奏折', category: 'legend', iconUrl: iconUrl('memorial_master'),
    unlockCondition: '共完成50份奏折的批阅', reward: '+500 穿越点 + 帝师称号' }
]

const REWARDS = {
  first_chat: 10, first_letter: 10, first_like: 5, dna_done: 20, first_visit: 10, first_profile: 10,
  chat_10: 30, chat_50: 80, letter_5: 50, comment_10: 30, chat_100: 150, letter_10: 100,
  first_memorial: 20, memorial_5: 80, read_book: 15, memorial_20: 200, read_5: 100, dna_share: 30,
  all_dynasties: 200, collector: 500, time_master: 1000, all_figures: 300, moment_popular: 200, memorial_master: 500
}

function generateCrossNo() {
  const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return 'CY' + rand
}

// [安全] 统计型成就条件校验器：返回 null 表示通过，返回字符串表示拒绝原因
// 事件型成就（first_chat/first_letter/first_like/first_visit/first_profile/first_memorial/dna_done/dna_share/read_book）
// 由客户端在行为发生时触发，无需服务端统计校验
function checkAchievementCondition(key, stats, points) {
  const conditions = {
    chat_10: () => (stats.chatCount || 0) >= 10,
    chat_50: () => (stats.chatCount || 0) >= 50,
    chat_100: () => (stats.chatCount || 0) >= 100,
    letter_5: () => (stats.letterCount || 0) >= 5,
    letter_10: () => (stats.letterCount || 0) >= 10,
    comment_10: () => (stats.momentCommentCount || 0) >= 10,
    memorial_5: () => (stats.memorialCount || 0) >= 5,
    memorial_20: () => (stats.memorialCount || 0) >= 20,
    memorial_master: () => (stats.memorialCount || 0) >= 50,
    read_5: () => (stats.readBookCount || 0) >= 5,
    time_master: () => points >= 1000,
    collector: () => false, // 需跨集合统计已解锁成就数，仅允许服务端内部调用
    all_dynasties: () => false, // 需跨集合统计，仅允许服务端内部调用
    all_figures: () => false, // 需跨集合统计，仅允许服务端内部调用
    moment_popular: () => false // 需跨集合统计，仅允许服务端内部调用
  }
  const checker = conditions[key]
  if (!checker) return null // 事件型成就，无需校验
  if (!checker()) return '成就条件未满足'
  return null
}

async function secCheckText(text, openid) {
  if (!text) return { ok: true }
  try {
    const r = await cloud.openapi.security.msgSecCheck({
      openid, version: 2, scene: 1, content: String(text).slice(0, 2000)
    })
    if (r && r.result && r.result.suggest !== 'pass') {
      return { ok: false, reason: '昵称包含不当信息' }
    }
    return { ok: true }
  } catch (e) {
    console.warn('msgSecCheck warn', e)
    return { ok: false, reason: '内容审核服务异常，请稍后重试' }
  }
}

exports.main = async (event, context) => {
  try {
    const { OPENID, APPID } = cloud.getWXContext()
    const { action } = event

    if (action === 'warmup') {
      return { code: 0, message: 'ok', data: { warmed: true } }
    }

    if (action === 'login') {
      const nickName = (event.nickName || '').toString().trim()
      const avatarUrl = (event.avatarUrl || '').toString().trim()
      if (!nickName) return { code: -1, message: '请填写昵称', data: null }
      if (!avatarUrl) return { code: -1, message: '请选择头像', data: null }

      const nickCheck = await secCheckText(nickName, OPENID)
      if (!nickCheck.ok) return { code: -1, message: nickCheck.reason, data: null }

      const existing = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      if (existing.data && existing.data.length > 0) {
        const user = existing.data[0]
        const achievements = user.achievements || []
        let updateData = {
          nickName,
          avatarUrl,
          lastActiveAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
        // Unlock first_profile if not already unlocked
        if (!achievements.some(a => a.key === 'first_profile')) {
          achievements.push({ key: 'first_profile', unlockedAt: db.serverDate() })
          updateData.achievements = achievements
          updateData.points = _.inc(10)
        }
        await db.collection('users').doc(user._id).update({ data: updateData })
        user.nickName = nickName
        user.avatarUrl = avatarUrl
        user._openid = OPENID
        return { code: 0, message: 'ok', data: user, isNewUser: false }
      }

      const newUser = {
        _openid: OPENID,
        nickName,
        avatarUrl,
        role: 'user',
        crossNo: generateCrossNo(),
        points: 20,
        memberLevel: '布衣',
        dnaResult: null,
        achievements: [{ key: 'first_profile', unlockedAt: new Date() }],
        stats: {
          chatCount: 0,
          letterCount: 0,
          memorialCount: 0,
          momentLikeCount: 0,
          momentCommentCount: 0
        },
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
        lastActiveAt: db.serverDate()
      }

      const addRes = await db.collection('users').add({ data: newUser })
      newUser._id = addRes._id
      return { code: 0, message: 'ok', data: newUser, isNewUser: true }
    }

    if (action === 'get') {
      const res = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      if (!res.data || res.data.length === 0) {
        return { code: -1, message: '用户不存在', data: null }
      }
      const u = res.data[0]
      u._openid = OPENID
      return { code: 0, message: 'ok', data: u }
    }

    if (action === 'update') {
      const allowedFields = ['nickName', 'avatarUrl']
      const updateData = { updatedAt: db.serverDate() }
      allowedFields.forEach(f => {
        if (event[f] !== undefined) updateData[f] = event[f]
      })

      if (event.nickName !== undefined) {
        const nickCheck = await secCheckText(event.nickName, OPENID)
        if (!nickCheck.ok) return { code: -1, message: nickCheck.reason, data: null }
      }

      const res = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      if (!res.data || res.data.length === 0) {
        return { code: -1, message: '用户不存在', data: null }
      }
      await db.collection('users').doc(res.data[0]._id).update({ data: updateData })
      return { code: 0, message: 'ok', data: { updated: true } }
    }

    if (action === 'addPoints') {
      // [安全] 该接口已禁用客户端直调，加分逻辑由服务端事件触发
      return { code: -1, message: '该接口已禁用', data: null }
    }

    if (action === 'stats') {
      const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      const userStats = (userRes.data && userRes.data[0] && userRes.data[0].stats) || {}

      const countOf = async (coll) => {
        try {
          const r = await db.collection(coll).where({ _openid: OPENID }).count()
          return r.total || 0
        } catch (e) {
          return 0
        }
      }

      const [chatCount, letterCount, memorialCount] = await Promise.all([
        countOf('chat_sessions'),
        countOf('letters'),
        countOf('memorial_answers')
      ])

      return {
        code: 0,
        message: 'ok',
        data: {
          chatCount,
          letterCount,
          memorialCount,
          momentLikeCount: userStats.momentLikeCount || 0,
          momentCommentCount: userStats.momentCommentCount || 0
        }
      }
    }

    if (action === 'achievements') {
      const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      const user = (userRes.data && userRes.data[0]) || {}
      const userAchievements = user.achievements || []
      const points = user.points || 0

      const unlockMap = {}
      userAchievements.forEach(a => {
        if (a && a.key) {
          let ts = 0
          if (a.unlockedAt instanceof Date) ts = a.unlockedAt.getTime()
          else if (typeof a.unlockedAt === 'number') ts = a.unlockedAt
          else if (a.unlockedAt) ts = new Date(a.unlockedAt).getTime()
          unlockMap[a.key] = ts
        }
      })

      const list = ALL_ACHIEVEMENTS.map(a => {
        const unlockedAt = unlockMap[a.key]
        return {
          ...a,
          unlocked: !!unlockedAt,
          unlockedAt: unlockedAt || 0
        }
      })

      const unlockedCount = list.filter(a => a.unlocked).length
      const totalCount = ALL_ACHIEVEMENTS.length

      const categories = ['beginner', 'communicate', 'explore', 'legend']
      const categoryProgress = {}
      categories.forEach(cat => {
        const catItems = list.filter(a => a.category === cat)
        const catUnlocked = catItems.filter(a => a.unlocked).length
        categoryProgress[cat] = `${catUnlocked}/${catItems.length}`
      })

      return {
        code: 0, message: 'ok',
        data: { list, points, unlockedCount, totalCount, categoryProgress }
      }
    }

    if (action === 'unlockAchievement') {
      const { key } = event
      const ach = ALL_ACHIEVEMENTS.find(a => a.key === key)
      if (!ach) return { code: -1, message: '未知成就: ' + key, data: null }

      const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      if (!userRes.data || !userRes.data.length) {
        return { code: -1, message: '用户不存在', data: null }
      }
      const user = userRes.data[0]
      const achievements = user.achievements || []
      if (achievements.some(a => a.key === key)) {
        return { code: 0, message: 'ok', data: { unlocked: false, reward: 0 } }
      }

      // [安全] 统计型成就需服务端校验条件，事件型成就允许客户端触发
      const stats = user.stats || {}
      const points = user.points || 0
      const condErr = checkAchievementCondition(key, stats, points)
      if (condErr) return { code: -1, message: condErr, data: null }

      const reward = REWARDS[key] || 0
      achievements.push({ key, unlockedAt: db.serverDate() })
      await db.collection('users').doc(user._id).update({
        data: {
          achievements,
          points: _.inc(reward),
          updatedAt: db.serverDate()
        }
      })
      return { code: 0, message: 'ok', data: { unlocked: true, reward } }
    }

    if (action === 'export') {
      const fetchAll = async (coll) => {
        try {
          const r = await db.collection(coll).where({ _openid: OPENID }).limit(100).get()
          return r.data || []
        } catch (e) {
          return []
        }
      }

      const [
        userArr, chatMessages, chatSessions, pigeonLetters, yanLetters,
        yanUserGifts, readingProgress, userAchievementsRaw, memorialAnswers,
        moments, momentComments
      ] = await Promise.all([
        fetchAll('users'),
        fetchAll('chat_messages'),
        fetchAll('chat_sessions'),
        fetchAll('pigeon_letters'),
        fetchAll('yan_letters'),
        fetchAll('yan_user_gifts'),
        fetchAll('reading_progress'),
        fetchAll('user_achievements'),
        fetchAll('memorial_answers'),
        fetchAll('moments'),
        fetchAll('moment_comments')
      ])

      const exportData = {
        exportedAt: new Date().toISOString(),
        openid: OPENID,
        users: userArr,
        chat_messages: chatMessages,
        chat_sessions: chatSessions,
        pigeon_letters: pigeonLetters,
        yan_letters: yanLetters,
        yan_user_gifts: yanUserGifts,
        reading_progress: readingProgress,
        user_achievements: userAchievementsRaw,
        memorial_answers: memorialAnswers,
        moments: moments,
        moment_comments: momentComments
      }

      const timestamp = Date.now()
      const cloudPath = `exports/${OPENID}/${timestamp}_export.json`
      const fileContent = Buffer.from(JSON.stringify(exportData, null, 2))

      const uploadRes = await cloud.uploadFile({ cloudPath, fileContent })
      return { code: 0, message: 'ok', data: { fileID: uploadRes.fileID } }
    }

    if (action === 'reset') {
      const deleteAll = async (coll) => {
        try {
          await db.collection(coll).where({ _openid: OPENID }).remove()
        } catch (e) {
          console.warn('reset delete fail', coll, e.message)
        }
      }

      await Promise.all([
        deleteAll('chat_messages'),
        deleteAll('chat_sessions'),
        deleteAll('pigeon_letters'),
        deleteAll('yan_letters'),
        deleteAll('yan_user_gifts'),
        deleteAll('reading_progress'),
        deleteAll('memorial_answers')
      ])

      const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      if (userRes.data && userRes.data.length) {
        await db.collection('users').doc(userRes.data[0]._id).update({
          data: {
            stats: {
              chatCount: 0,
              letterCount: 0,
              memorialCount: 0,
              momentLikeCount: 0,
              momentCommentCount: 0
            },
            points: 10,
            achievements: [],
            updatedAt: db.serverDate()
          }
        })
      }

      return { code: 0, message: 'ok', data: { deleted: true } }
    }

    return { code: -1, message: '未知操作: ' + (action || 'none'), data: null }
  } catch (err) {
    console.error('getUser 云函数错误:', err)
    return { code: -1, message: '服务异常', data: null }
  }
}
