const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const ALL_ACHIEVEMENTS = [
  { key: 'first_chat', icon: '💬', name: '初遇古人', desc: '第一次与历史人物聊天', category: 'beginner',
    unlockCondition: '与任意历史人物发送第一条消息', reward: '+10 穿越点' },
  { key: 'first_letter', icon: '🕊️', name: '飞鸽初试', desc: '第一次通过飞鸽传书', category: 'beginner',
    unlockCondition: '成功发送并收到第一封回信', reward: '+10 穿越点' },
  { key: 'first_like', icon: '👍', name: '点赞之交', desc: '第一次点赞朋友圈动态', category: 'beginner',
    unlockCondition: '在朋友圈点赞任意一条动态', reward: '+5 穿越点' },
  { key: 'dna_done', icon: '🧬', name: '身世之谜', desc: '完成历史人格DNA测试', category: 'beginner',
    unlockCondition: '答完全部DNA测试题并生成结果', reward: '+20 穿越点' },

  { key: 'chat_10', icon: '📚', name: '话痨之友', desc: '累计发送10条聊天消息', category: 'communicate',
    unlockCondition: '聊天消息发送总数达到10条', reward: '+30 穿越点' },
  { key: 'chat_50', icon: '🎭', name: '忘年之交', desc: '累计发送50条聊天消息', category: 'communicate',
    unlockCondition: '聊天消息发送总数达到50条', reward: '+80 穿越点' },
  { key: 'letter_5', icon: '✉️', name: '鸿雁传情', desc: '累计收到5封回信', category: 'communicate',
    unlockCondition: '共收到5封历史人物的回信', reward: '+50 穿越点' },
  { key: 'comment_10', icon: '✍️', name: '说古道今', desc: '累计在朋友圈发布10条评论', category: 'communicate',
    unlockCondition: '朋友圈评论数达到10条', reward: '+30 穿越点' },

  { key: 'first_memorial', icon: '📋', name: '初批奏折', desc: '第一次批阅奏折', category: 'explore',
    unlockCondition: '完成第一份奏折决策并查看推演结果', reward: '+20 穿越点' },
  { key: 'memorial_5', icon: '👑', name: '勤政之君', desc: '累计批阅5份奏折', category: 'explore',
    unlockCondition: '共完成5份奏折的批阅', reward: '+80 穿越点' },
  { key: 'figure_10', icon: '🧑‍🎨', name: '博物君子', desc: '解锁10位历史人物图鉴', category: 'explore',
    unlockCondition: '人物图鉴中已解锁人物达10位', reward: '+60 穿越点' },
  { key: 'read_book', icon: '📖', name: '博览群书', desc: '第一次开启史书阅读', category: 'explore',
    unlockCondition: '进入兰台史书阅读页并阅读超过3分钟', reward: '+15 穿越点' },

  { key: 'all_dynasties', icon: '🏯', name: '千古一帝', desc: '与各朝代至少一位人物聊过天', category: 'legend',
    unlockCondition: '秦汉、三国、唐、宋、明、清各朝至少一人都有过聊天记录', reward: '+200 穿越点 + 专属古风称号' },
  { key: 'collector', icon: '🏅', name: '金石收藏家', desc: '解锁80%的成就', category: 'legend',
    unlockCondition: '成就解锁进度达到80%', reward: '+500 穿越点 + 金色个人主页边框' },
  { key: 'time_master', icon: '⏳', name: '时空主宰', desc: '累计穿越积分达到1000', category: 'legend',
    unlockCondition: '总穿越点数累积达到1000点', reward: '+1000 穿越点 + 专属稀有头像框' }
]

const REWARDS = {
  first_chat: 10, first_letter: 10, first_like: 5, dna_done: 20,
  chat_10: 30, chat_50: 80, letter_5: 50, comment_10: 30,
  first_memorial: 20, memorial_5: 80, figure_10: 60, read_book: 15,
  all_dynasties: 200, collector: 500, time_master: 1000
}

function generateCrossNo() {
  const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return 'CY' + rand
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

      const existing = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      if (existing.data && existing.data.length > 0) {
        const user = existing.data[0]
        await db.collection('users').doc(user._id).update({
          data: {
            nickName,
            avatarUrl,
            lastActiveAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        })
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
        points: 10,
        memberLevel: '布衣',
        dnaResult: null,
        achievements: [],
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

      const res = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      if (!res.data || res.data.length === 0) {
        return { code: -1, message: '用户不存在', data: null }
      }
      await db.collection('users').doc(res.data[0]._id).update({ data: updateData })
      return { code: 0, message: 'ok', data: { updated: true } }
    }

    if (action === 'addPoints') {
      const points = Math.max(0, Number(event.points) || 0)
      const reason = event.reason || ''
      if (points <= 0) return { code: 0, message: 'ok', data: null }

      const res = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      if (!res.data || res.data.length === 0) return { code: -1, message: '用户不存在', data: null }

      await db.collection('users').doc(res.data[0]._id).update({
        data: {
          points: _.inc(points),
          updatedAt: db.serverDate(),
          [`stats.${reason}`]: _.inc(1)
        }
      })
      return { code: 0, message: 'ok', data: { added: points } }
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
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
