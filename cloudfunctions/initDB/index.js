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
  'dna_quizzes',
  'dna_questions',
  'dna_results',
  'dna_records',
  'letters',
  'memorials',
  'memorial_answers',
  'memorial_simulations',
  'achievements',
  'user_figures',
  'user_points',
  'book_favorites',
  'books',
  'book_chapters',
  'system_config'
]

// ============================================================
// 人物种子：12 位（与 lantai 前端 mock 对齐）
// figureId 统一 fig-xxx 格式，新增 initial 字段（拼音首字母）用于通讯录索引
// ============================================================
const FIGURE_SEED = [
  { figureId: 'fig-huangdi', figureName: '黄帝', dynasty: 'xianqin', dynastyName: '上古', initial: 'H', title: '人文初祖', bio: '中华民族始祖，统一华夏部落，播百谷草木，创医药历法。', tags: ['始祖', '上古'], color: '#4B0082', avatar: '' },
  { figureId: 'fig-simqian', figureName: '司马迁', dynasty: 'han', dynastyName: '西汉', initial: 'S', title: '太史公', bio: '字子长，夏阳人。西汉史学家、散文家。因替李陵败降之事辩解而受宫刑，发奋完成《史记》百三十篇，史家之绝唱，无韵之离骚。', tags: ['史学', '文学'], color: '#654321', avatar: '' },
  { figureId: 'fig-liubang', figureName: '刘邦', dynasty: 'han', dynastyName: '西汉', initial: 'L', title: '汉高祖', bio: '沛丰邑人，初为泗水亭长。秦末起兵，先入关中，约法三章。楚汉相争中虽屡战屡败，最终垓下一战定乾坤，建立汉朝。', tags: ['政治', '军事'], color: '#B22222', avatar: '' },
  { figureId: 'fig-hanwu', figureName: '刘彻', dynasty: 'han', dynastyName: '西汉', initial: 'L', title: '汉武帝', bio: '罢黜百家，独尊儒术；北击匈奴，凿空西域。雄才大略，开创西汉鼎盛之世。', tags: ['政治', '军事'], color: '#8B0000', avatar: '' },
  { figureId: 'fig-zhugeliang', figureName: '诸葛亮', dynasty: 'sanguo', dynastyName: '三国·蜀', initial: 'Z', title: '武乡侯', bio: '字孔明，琅琊阳都人。三顾茅庐始出山，鞠躬尽瘁，死而后已。著《出师表》《诫子书》，卧龙一出天下惊。', tags: ['政治', '军事'], color: '#2F4F4F', avatar: '' },
  { figureId: 'fig-libai', figureName: '李白', dynasty: 'tang', dynastyName: '盛唐', initial: 'L', title: '诗仙', bio: '字太白，号青莲居士。斗酒诗百篇，剑气纵横三万里。浪漫主义诗歌巅峰，与杜甫并称李杜。', tags: ['诗歌', '浪漫', '酒'], color: '#B22222', avatar: '' },
  { figureId: 'fig-wuzetian', figureName: '武则天', dynasty: 'tang', dynastyName: '唐·武周', initial: 'W', title: '则天大圣皇帝', bio: '中国历史上唯一的女皇帝。从太宗才人，到高宗皇后，再到君临天下。创殿试、开武举、重人才。', tags: ['政治', '女皇'], color: '#9932CC', avatar: '' },
  { figureId: 'fig-sushi', figureName: '苏轼', dynasty: 'song', dynastyName: '北宋', initial: 'S', title: '东坡居士', bio: '字子瞻，号东坡。诗词文书画皆冠绝一时。屡遭贬谪，旷达乐观，一蓑烟雨任平生。', tags: ['文学', '艺术', '美食'], color: '#2E8B57', avatar: '' },
  { figureId: 'fig-yuefei', figureName: '岳飞', dynasty: 'song', dynastyName: '南宋', initial: 'Y', title: '岳武穆', bio: '字鹏举，相州汤阴人。南宋抗金名将，精忠报国。治军严明，岳家军"冻死不拆屋，饿死不掳掠"。遭十二道金牌召回，含冤风波亭。', tags: ['军事', '忠义'], color: '#8B0000', avatar: '' },
  { figureId: 'fig-zhuyuanzhang', figureName: '朱元璋', dynasty: 'ming', dynastyName: '明', initial: 'Z', title: '明太祖', bio: '字国瑞，濠州钟离人。出身贫寒，曾为僧为丐。元末投郭子兴，后自立一军，灭陈友谅、张士诚，北伐驱逐元廷，建立大明。', tags: ['政治', '军事'], color: '#8B0000', avatar: '' },
  { figureId: 'fig-zhenghe', figureName: '郑和', dynasty: 'ming', dynastyName: '明', initial: 'Z', title: '三保太监', bio: '原姓马，云南人。七下西洋，遍历三十余国，宝船六十余丈，示中国富强，通朝贡贸易。', tags: ['航海', '外交'], color: '#1E90FF', avatar: '' },
  { figureId: 'fig-kangxi', figureName: '爱新觉罗·玄烨', dynasty: 'qing', dynastyName: '清', initial: 'A', title: '康熙大帝', bio: '清圣祖，年号康熙。八岁登基，十四岁亲政。平三藩、收台湾、征噶尔丹、尼布楚条约。在位六十一年，千古一帝。', tags: ['政治', '军事'], color: '#FFD700', avatar: '' },
  // 以下为 shiji 原始数据保留
  { figureId: 'fig-kongzi', figureName: '孔子', dynasty: 'xianqin', dynastyName: '春秋·鲁', initial: 'K', title: '儒家创始人', bio: '孔丘，字仲尼。万世师表，有教无类，弟子三千，贤人七十二。修诗书礼乐，序周易，著春秋。', tags: ['教育', '思想', '礼乐'], color: '#8B7355', avatar: '' },
  { figureId: 'fig-baijuyi', figureName: '白居易', dynasty: 'tang', dynastyName: '中唐', initial: 'B', title: '诗魔', bio: '字乐天，号香山居士。新乐府运动领袖，文章合为时而著，歌诗合为事而作。老妪能解。', tags: ['诗歌', '现实'], color: '#4682B4', avatar: '' },
  { figureId: 'fig-wujiang', figureName: '项羽', dynasty: 'sanguo', dynastyName: '秦末·楚', initial: 'X', title: '西楚霸王', bio: '名籍，字羽。力能扛鼎，才气过人。破釜沉舟，百二秦关终属楚；垓下被围，乌江自刎。', tags: ['军事', '悲情英雄'], color: '#8B0000', avatar: '' },
  { figureId: 'fig-caocao', figureName: '曹操', dynasty: 'sanguo', dynastyName: '东汉末', initial: 'C', title: '魏武帝', bio: '字孟德，小字阿瞒。挟天子以令诸侯，灭吕布，破袁绍，统一北方。政治家、军事家、诗人。', tags: ['政治', '军事', '文学'], color: '#2F4F4F', avatar: '' },
  { figureId: 'fig-mulan', figureName: '花木兰', dynasty: 'sanguo', dynastyName: '南北朝', initial: 'H', title: '巾帼英雄', bio: '代父从军，女扮男装，征战十二载，屡立奇功。归来不愿尚书郎，愿驰千里足，送儿还故乡。', tags: ['孝义', '军事'], color: '#CD5C5C', avatar: '' }
]

// ============================================================
// 典籍种子
// ============================================================
const BOOK_SEED = [
  { _id: 'shiji', bookId: 'shiji', title: '史记', author: '司马迁', dynasty: 'han', dynastyName: '西汉', chapters: 130, category: '史书', desc: '史家之绝唱，无韵之离骚', figures: ['fig-simqian', 'fig-wujiang', 'fig-caocao'] },
  { _id: 'hanshu', bookId: 'hanshu', title: '汉书', author: '班固', dynasty: 'han', dynastyName: '东汉', chapters: 100, category: '史书', desc: '第一部纪传体断代史', figures: ['fig-liubang', 'fig-hanwu'] },
  { _id: 'sanguozhi', bookId: 'sanguozhi', title: '三国志', author: '陈寿', dynasty: 'sanguo', dynastyName: '西晋', chapters: 65, category: '史书', desc: '三国时代的权威记载', figures: ['fig-zhugeliang', 'fig-caocao'] },
  { _id: 'zizhitongjian', bookId: 'zizhitongjian', title: '资治通鉴', author: '司马光', dynasty: 'song', dynastyName: '北宋', chapters: 294, category: '史书', desc: '鉴前世之兴衰，考当今之得失', figures: ['fig-wuzetian', 'fig-sushi'] },
  { _id: 'xintangshu', bookId: 'xintangshu', title: '新唐书', author: '欧阳修', dynasty: 'song', dynastyName: '北宋', chapters: 225, category: '史书', desc: '唐代历史的系统梳理', figures: ['fig-wuzetian', 'fig-libai', 'fig-baijuyi'] },
  { _id: 'mingshi', bookId: 'mingshi', title: '明史', author: '张廷玉等', dynasty: 'qing', dynastyName: '清', chapters: 332, category: '史书', desc: '明朝近三百年全史', figures: ['fig-zhuyuanzhang', 'fig-zhenghe'] }
]

// ============================================================
// 奏折种子（从 memorial 云函数迁出，保持原 3 条）
// ============================================================
const MEMORIAL_SEED = [
  {
    _id: 'm1',
    title: '请削藩封疏',
    submitter: '晁错',
    dynasty: 'han',
    dynastyName: '西汉',
    chapter: 'han',
    content: '诸侯连城数十，地方千里，缓则骄奢易为淫乱，急则阻其强而合从以逆京师。今削之亦反，不削之亦反。削之，其反亟，祸小；不削，反迟，祸大。\n\n伏望陛下审时度势，早决断，无贻后患。臣昧死上言。',
    background: '汉初诸侯坐大，已成尾大不掉之势。',
    options: [
      { k: '准', text: '准奏，即刻削藩', consequence: '引发七国之乱，地方震动', score: { 稳: -2, 威: 3, 名: 1, 民: -1 } },
      { k: '缓', text: '缓行，先试探之', consequence: '暂获安宁，但诸侯日强', score: { 稳: 1, 威: -1, 名: 0, 民: 1 } },
      { k: '推恩', text: '令诸侯分封子弟（推恩令）', consequence: '诸侯自弱，渐归中央', score: { 稳: 3, 威: 2, 名: 2, 民: 1 } },
      { k: '驳', text: '驳回，晁错危言耸听', consequence: '诸侯益强，他日必反', score: { 稳: -1, 威: -2, 名: -1, 民: 0 } }
    ]
  },
  {
    _id: 'm2',
    title: '谏太宗十思疏',
    submitter: '魏徵',
    dynasty: 'tang',
    dynastyName: '唐',
    chapter: 'tang',
    content: '臣闻求木之长者，必固其根本；欲流之远者，必浚其泉源；思国之安者，必积其德义。源不深而望流之远，根不固而求木之长，德不厚而思国之安，臣虽下愚，知其不可，而况于明哲乎？\n\n人君当神器之重，居域中之大，将崇极天之峻，永保无疆之休。不念居安思危，戒奢以俭，斯亦伐根以求木茂，塞源而欲流长也。',
    background: '贞观之治，太宗渐好奢华，魏徵上此疏以谏。',
    options: [
      { k: '赞', text: '深以为然，赐绢嘉奖', consequence: '君臣相得，贞观之风益盛', score: { 稳: 3, 威: 1, 名: 3, 民: 2 } },
      { k: '纳', text: '纳其言但不赏', consequence: '言路渐开，人心稍平', score: { 稳: 2, 威: 0, 名: 1, 民: 1 } },
      { k: '怒', text: '岂敢讥朕！欲杀之', consequence: '直臣缄口，盛世将衰', score: { 稳: -2, 威: 2, 名: -3, 民: -1 } },
      { k: '置', text: '置之不理，我行我素', consequence: '积弊渐生，隐患埋下', score: { 稳: -1, 威: 0, 名: -1, 民: 0 } }
    ]
  },
  {
    _id: 'm3',
    title: '出师表',
    submitter: '诸葛亮',
    dynasty: 'sanguo',
    dynastyName: '三国·蜀',
    chapter: 'sanguo',
    content: '臣本布衣，躬耕于南阳，苟全性命于乱世，不求闻达于诸侯。先帝不以臣卑鄙，猥自枉屈，三顾臣于草庐之中，咨臣以当世之事，由是感激，遂许先帝以驱驰。后值倾覆，受任于败军之际，奉命于危难之间：尔来二十有一年矣。\n\n今南方已定，兵甲已足，当奖率三军，北定中原，庶竭驽钝，攘除奸凶，兴复汉室，还于旧都。此臣所以报先帝而忠陛下之职分也。',
    background: '蜀汉建兴五年，诸葛亮率师北伐，上此表于后主刘禅。',
    options: [
      { k: '准', text: '恩准，全力支持北伐', consequence: '六出祁山，鞠躬尽瘁', score: { 稳: 1, 威: 2, 名: 3, 民: -1 } },
      { k: '缓', text: '请先休养三年再议', consequence: '国力渐丰，但北伐良机或失', score: { 稳: 2, 威: -1, 名: 0, 民: 2 } },
      { k: '阻', text: '反对北伐，安境保民', consequence: '偏安一隅，蜀汉无大事', score: { 稳: 2, 威: -2, 名: -1, 民: 2 } },
      { k: '疑', text: '丞相握重兵在外，令人忧', consequence: '君臣猜疑，国事日非', score: { 稳: -3, 威: -1, 名: -2, 民: -1 } }
    ]
  }
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
      case 'seedBooks': return await seedBooks()
      case 'seedMemorials': return await seedMemorials()
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
    books: await seedBooks(),
    memorials: await seedMemorials(),
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

async function seedBooks() {
  let ok = 0, fail = 0
  for (const b of BOOK_SEED) {
    try {
      const exists = await db.collection('books').where({ bookId: b.bookId }).count()
      if (exists.total > 0) {
        await db.collection('books').where({ bookId: b.bookId }).update({ data: b })
      } else {
        await db.collection('books').add({ data: b })
      }
      ok++
    } catch (e) { fail++ }
  }
  return { ok, fail }
}

async function seedMemorials() {
  let ok = 0, fail = 0
  for (const m of MEMORIAL_SEED) {
    try {
      const exists = await db.collection('memorials').doc(m._id).get()
      if (exists.data) {
        await db.collection('memorials').doc(m._id).set({ data: m })
      } else {
        await db.collection('memorials').add({ data: { _id: m._id, ...m } })
      }
      ok++
    } catch (e) {
      try {
        await db.collection('memorials').add({ data: { _id: m._id, ...m } })
        ok++
      } catch (_) { fail++ }
    }
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
    } catch (e) {
      try {
        await db.collection('achievements').add({ data: { _id: a._id, ...a } })
        ok++
      } catch (_) { fail++ }
    }
  }
  return { ok, fail }
}

async function resetDB(data) {
  const keepFiguresAchievements = data.keepSeed !== false
  const removeCols = keepFiguresAchievements
    ? COLLECTIONS.filter(c => !['historical_figures', 'achievements', 'books', 'memorials'].includes(c))
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
