const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTIONS = [
  'users',
  'historical_figures',
  'chat_messages',
  'chat_sessions',
  'moments',
  'moment_comments',
  'moment_likes',
  'dna_results',
  'letters',
  'memorial_answers',
  'achievements',
  'user_figures',
  'user_points',
  'book_favorites',
  'books',
  'system_config'
]

const FIGURE_SEED = [
  { figureId: 'fig-kongzi', figureName: '孔子', dynasty: '春秋·鲁', title: '儒家创始人', bio: '孔丘，字仲尼。万世师表，有教无类，弟子三千，贤人七十二。', tags: ['教育','思想'], color: '#8B7355', avatar: '' },
  { figureId: 'fig-simqian', figureName: '司马迁', dynasty: '西汉', title: '太史公', bio: '司马子长，著《史记》百三十篇。', tags: ['史学'], color: '#654321', avatar: '' },
  { figureId: 'fig-libai', figureName: '李白', dynasty: '唐', title: '诗仙', bio: '斗酒诗百篇。', tags: ['诗歌','酒'], color: '#B22222', avatar: '' },
  { figureId: 'fig-sushi', figureName: '苏轼', dynasty: '北宋', title: '东坡居士', bio: '一蓑烟雨任平生。', tags: ['文学','美食'], color: '#2E8B57', avatar: '' },
  { figureId: 'fig-caocao', figureName: '曹操', dynasty: '东汉末', title: '魏武帝', bio: '挟天子以令诸侯。', tags: ['政治','军事'], color: '#2F4F4F', avatar: '' },
  { figureId: 'fig-wuzetian', figureName: '武则天', dynasty: '唐', title: '则天大圣皇帝', bio: '唯一的女皇。', tags: ['政治'], color: '#9932CC', avatar: '' },
  { figureId: 'fig-wujiang', figureName: '项羽', dynasty: '秦末·楚', title: '西楚霸王', bio: '力拔山兮气盖世。', tags: ['军事'], color: '#8B0000', avatar: '' },
  { figureId: 'fig-mulan', figureName: '花木兰', dynasty: '南北朝', title: '巾帼英雄', bio: '代父从军。', tags: ['孝义'], color: '#CD5C5C', avatar: '' },
  { figureId: 'fig-baijuyi', figureName: '白居易', dynasty: '唐', title: '诗魔', bio: '文章合为时而著。', tags: ['诗歌'], color: '#4682B4', avatar: '' },
  { figureId: 'fig-zhenghe', figureName: '郑和', dynasty: '明', title: '三保太监', bio: '七下西洋。', tags: ['航海'], color: '#1E90FF', avatar: '' }
]

const ACHIEVEMENT_SEED = [
  { _id: 'ach_first_chat', name: '初入异世', desc: '与任意古人进行首次对话', icon: '🎋', rarity: 'common', points: 10, condition: { type: 'chatCount', value: 1 } },
  { _id: 'ach_chat_10', name: '言无不尽', desc: '累计聊天 10 次', icon: '🗣️', rarity: 'rare', points: 30, condition: { type: 'chatCount', value: 10 } },
  { _id: 'ach_chat_50', name: '知己', desc: '累计聊天 50 次', icon: '💖', rarity: 'epic', points: 100, condition: { type: 'chatCount', value: 50 } },
  { _id: 'ach_first_moment', name: '初入朋友圈', desc: '发布第一条动态', icon: '📝', rarity: 'common', points: 10 },
  { _id: 'ach_first_letter', name: '飞鸽传书', desc: '寄出第一封书信', icon: '🕊️', rarity: 'common', points: 15 },
  { _id: 'ach_dna_done', name: '我是谁', desc: '完成古代人格测试', icon: '🧬', rarity: 'common', points: 20 },
  { _id: 'ach_emperor_1', name: '初批奏折', desc: '批阅 1 份奏折', icon: '📜', rarity: 'common', points: 15 },
  { _id: 'ach_emperor_10', name: '明君之道', desc: '批阅 10 份奏折', icon: '👑', rarity: 'epic', points: 120 },
  { _id: 'ach_unlock_5', name: '广结好友', desc: '解锁 5 位古人', icon: '🧑‍🤝‍🧑', rarity: 'rare', points: 60 },
  { _id: 'ach_unlock_all', name: '天下谁人不识君', desc: '解锁全部古人', icon: '🏆', rarity: 'legendary', points: 500 },
  { _id: 'ach_read_10', name: '博览群书', desc: '阅读 10 部典籍', icon: '📚', rarity: 'rare', points: 50 }
]

exports.main = async (event, context) => {
  const { action = 'init', data = {} } = event
  try {
    switch (action) {
      case 'init': return await initAll(data)
      case 'resetDB': return await resetDB(data)
      case 'checkStatus': return await checkStatus()
      case 'seedFigures': return await seedFigures()
      case 'seedAchievements': return await seedAchievements()
      default: return { code: -1, message: '未知 action: ' + action }
    }
  } catch (e) {
    console.error('initDB err', e)
    return { code: -1, message: e.message }
  }
}

async function initAll(data) {
  const { drop = false, seed = true } = data
  const created = []
  const failed = []

  for (const c of COLLECTIONS) {
    try {
      if (drop) {
        try {
          const list = await db.collection(c).limit(1).get()
          if (list.data.length) {
            await db.collection(c).where({ _openid: /./ }).remove()
          }
        } catch (_) {}
      }
      await db.createCollection(c)
      created.push(c)
    } catch (e) {
      if (e.errMsg && e.errMsg.includes('already exists')) {
        created.push(c + '(exists)')
      } else {
        failed.push({ collection: c, error: e.message })
      }
    }
  }

  const seedResult = seed ? {
    figures: await seedFigures(),
    achievements: await seedAchievements()
  } : null

  return {
    code: 0,
    message: '初始化完成',
    data: { created, failed, seed: seedResult }
  }
}

async function checkStatus() {
  const result = {}
  for (const c of COLLECTIONS) {
    try {
      const r = await db.collection(c).count()
      result[c] = { ok: true, count: r.total }
    } catch (e) {
      result[c] = { ok: false, error: e.message }
    }
  }
  return { code: 0, message: 'ok', data: result }
}

async function seedFigures() {
  let ok = 0, fail = 0
  for (const f of FIGURE_SEED) {
    try {
      const exists = await db.collection('historical_figures').where({ figureId: f.figureId }).count()
      if (exists.total > 0) {
        await db.collection('historical_figures').where({ figureId: f.figureId }).update({ data: f })
      } else {
        await db.collection('historical_figures').add({ data: f })
      }
      ok++
    } catch (e) { fail++ }
  }
  return { ok, fail }
}

async function seedAchievements() {
  let ok = 0, fail = 0
  for (const a of ACHIEVEMENT_SEED) {
    try {
      const exists = await db.collection('achievements').doc(a._id).get()
      if (exists.data) {
        await db.collection('achievements').doc(a._id).set({ data: a })
      } else {
        await db.collection('achievements').add({ data: { _id: a._id, ...a } })
      }
      ok++
    } catch (e) { fail++ }
  }
  return { ok, fail }
}

async function resetDB(data) {
  const keepFiguresAchievements = data.keepSeed !== false
  const removeCols = keepFiguresAchievements
    ? COLLECTIONS.filter(c => !['historical_figures','achievements','books'].includes(c))
    : COLLECTIONS
  const result = {}
  for (const c of removeCols) {
    try {
      await db.collection(c).where({ _openid: /./ }).remove()
      result[c] = { ok: true }
    } catch (e) {
      result[c] = { ok: false, error: e.message }
    }
  }
  return { code: 0, message: 'ok', data: result }
}
