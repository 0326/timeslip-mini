const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const HISTORICAL_FIGURES = [
  { figureId: 'fig-kongzi', figureName: '孔子', dynasty: '春秋·鲁', title: '儒家创始人', bio: '孔丘，字仲尼。万世师表，有教无类，弟子三千，贤人七十二。修诗书礼乐，序周易，著春秋。', tags: ['教育', '思想', '礼乐'], color: '#8B7355' },
  { figureId: 'fig-simqian', figureName: '司马迁', dynasty: '西汉', title: '太史公', bio: '司马子长，继父任为太史令。遭李陵之祸，隐忍苟活，著《史记》百三十篇，史家之绝唱，无韵之离骚。', tags: ['史学', '文学'], color: '#654321' },
  { figureId: 'fig-libai', figureName: '李白', dynasty: '唐', title: '诗仙', bio: '字太白，号青莲居士。斗酒诗百篇，剑气纵横三万里。浪漫主义诗歌巅峰，与杜甫并称李杜。', tags: ['诗歌', '浪漫', '酒'], color: '#B22222' },
  { figureId: 'fig-baijuyi', figureName: '白居易', dynasty: '唐', title: '诗魔', bio: '字乐天，号香山居士。新乐府运动领袖，文章合为时而著，歌诗合为事而作。老妪能解。', tags: ['诗歌', '现实'], color: '#4682B4' },
  { figureId: 'fig-wujiang', figureName: '项羽', dynasty: '秦末·楚', title: '西楚霸王', bio: '名籍，字羽。力能扛鼎，才气过人。破釜沉舟，百二秦关终属楚；垓下被围，乌江自刎。', tags: ['军事', '悲情英雄'], color: '#8B0000' },
  { figureId: 'fig-caocao', figureName: '曹操', dynasty: '东汉末', title: '魏武帝', bio: '字孟德，小字阿瞒。挟天子以令诸侯，灭吕布，破袁绍，统一北方。政治家、军事家、诗人。', tags: ['政治', '军事', '文学'], color: '#2F4F4F' },
  { figureId: 'fig-sushi', figureName: '苏轼', dynasty: '北宋', title: '东坡居士', bio: '字子瞻，号东坡。诗词文书画皆冠绝一时。屡遭贬谪，旷达乐观，一蓑烟雨任平生。', tags: ['文学', '艺术', '美食'], color: '#2E8B57' },
  { figureId: 'fig-wuzetian', figureName: '武则天', dynasty: '唐', title: '则天大圣皇帝', bio: '中国历史上唯一的女皇帝。从太宗才人，到高宗皇后，再到君临天下。创殿试、开武举、重人才。', tags: ['政治', '女皇'], color: '#9932CC' },
  { figureId: 'fig-mulan', figureName: '花木兰', dynasty: '南北朝', title: '巾帼英雄', bio: '代父从军，女扮男装，征战十二载，屡立奇功。归来不愿尚书郎，愿驰千里足，送儿还故乡。', tags: ['孝义', '军事'], color: '#CD5C5C' },
  { figureId: 'fig-zhenghe', figureName: '郑和', dynasty: '明', title: '三保太监', bio: '原姓马，云南人。七下西洋，遍历三十余国，宝船六十余丈，示中国富强，通朝贡贸易。', tags: ['航海', '外交'], color: '#1E90FF' }
]

const BOOKS = [
  { _id: 'b1', title: '史记·项羽本纪', category: '史书', dynasty: '西汉', author: '司马迁', summary: '记载项羽一生的传奇：巨鹿之战破釜沉舟、鸿门宴错放刘邦、垓下之围四面楚歌、乌江自刎英雄末路。太史公以帝王之礼入纪，可见其推崇。', figures: ['fig-wujiang', 'fig-simqian', 'fig-caocao'], chapters: 8 },
  { _id: 'b2', title: '论语', category: '经典', dynasty: '春秋', author: '孔门弟子', summary: '孔子与弟子的言行录，共二十篇。仁义礼智信之宗，修身齐家治国平天下之本。"学而时习之，不亦说乎？"', figures: ['fig-kongzi'], chapters: 20 },
  { _id: 'b3', title: '李太白全集', category: '诗文', dynasty: '唐', author: '李白', summary: '收录诗仙毕生诗作：《将进酒》《蜀道难》《梦游天姥吟留别》《早发白帝城》……字字珠玑，篇篇绝唱。', figures: ['fig-libai', 'fig-sushi', 'fig-baijuyi'], chapters: 30 },
  { _id: 'b4', title: '资治通鉴·唐纪', category: '史书', dynasty: '北宋', author: '司马光', summary: '唐纪部分载贞观之治、开元盛世、安史之乱，尤重武则天临朝之事。鉴前世之兴衰，考当今之得失。', figures: ['fig-wuzetian', 'fig-baijuyi'], chapters: 15 },
  { _id: 'b5', title: '乐府诗集·木兰诗', category: '诗歌', dynasty: '南北朝', author: '佚名', summary: '唧唧复唧唧，木兰当户织。不闻机杼声，唯闻女叹息。——一首《木兰诗》，千古孝义。', figures: ['fig-mulan'], chapters: 1 },
  { _id: 'b6', title: '苏东坡文集', category: '诗文', dynasty: '北宋', author: '苏轼', summary: '收录东坡诗文词赋：前后《赤壁赋》、《念奴娇·大江东去》、《水调歌头·明月几时有》，及《东坡志林》之随笔。', figures: ['fig-sushi', 'fig-libai'], chapters: 18 }
]

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action, data = {} } = event
  try {
    switch (action) {
      case 'figure-list': return await figureList(OPENID, data)
      case 'figure-detail': return await figureDetail(OPENID, data)
      case 'figure-unlock': return await figureUnlock(OPENID, data)
      case 'book-list': return { code: 0, message: 'ok', data: BOOKS }
      case 'book-detail': return { code: 0, message: 'ok', data: BOOKS.find(b => b._id === data._id) || null }
      case 'book-favorites': return await bookFavorites(OPENID, data)
      case 'book-favoriteToggle': return await bookFavToggle(OPENID, data)
      default: return { code: -1, message: '未知 action: ' + action }
    }
  } catch (e) {
    console.error('shiji err:', e)
    return { code: -1, message: e.message }
  }
}

async function figureList(OPENID, data) {
  const { unlockedOnly = false } = data
  let unlocked = new Set()
  try {
    const r = await db.collection('user_figures').where({ _openid: OPENID }).get()
    r.data.forEach(x => unlocked.add(x.figureId))
  } catch (_) {}

  const list = HISTORICAL_FIGURES.map(f => ({
    ...f,
    unlocked: unlockedOnly ? unlocked.has(f.figureId) : (unlocked.has(f.figureId) || ['fig-libai','fig-sushi','fig-kongzi','fig-caocao'].includes(f.figureId))
  }))
  return { code: 0, message: 'ok', data: unlockedOnly ? list.filter(f => f.unlocked) : list }
}

async function figureDetail(OPENID, data) {
  const { figureId } = data
  const f = HISTORICAL_FIGURES.find(x => x.figureId === figureId)
  if (!f) return { code: -1, message: '人物不存在' }
  let unlocked = false
  try {
    const r = await db.collection('user_figures').where({ _openid: OPENID, figureId }).limit(1).get()
    unlocked = r.data.length > 0
  } catch (_) {}
  const relatedBooks = BOOKS.filter(b => (b.figures || []).includes(figureId))
  return { code: 0, message: 'ok', data: { ...f, unlocked: unlocked || ['fig-libai','fig-sushi','fig-kongzi'].includes(figureId), relatedBooks } }
}

async function figureUnlock(OPENID, data) {
  const { figureId, cost = 100 } = data
  if (!figureId) return { code: -1, message: '缺少 figureId' }
  try {
    const check = await db.collection('user_figures').where({ _openid: OPENID, figureId }).limit(1).get()
    if (check.data.length) return { code: 0, message: '已解锁', data: { already: true } }
    await db.collection('user_figures').add({
      data: { figureId, unlockedAt: db.serverDate(), cost }
    })
    return { code: 0, message: '解锁成功' }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

async function bookFavorites(OPENID, data) {
  try {
    const r = await db.collection('book_favorites').where({ _openid: OPENID }).get()
    const favIds = new Set(r.data.map(x => x.bookId))
    const list = BOOKS.map(b => ({ ...b, favorite: favIds.has(b._id) }))
    return { code: 0, message: 'ok', data: list.filter(b => b.favorite) }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

async function bookFavToggle(OPENID, data) {
  const { bookId } = data
  if (!bookId) return { code: -1, message: '缺少 bookId' }
  try {
    const r = await db.collection('book_favorites').where({ _openid: OPENID, bookId }).limit(1).get()
    if (r.data.length) {
      await db.collection('book_favorites').doc(r.data[0]._id).remove()
      return { code: 0, message: 'ok', data: { favorite: false } }
    }
    await db.collection('book_favorites').add({
      data: { bookId, createdAt: db.serverDate() }
    })
    return { code: 0, message: 'ok', data: { favorite: true } }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
