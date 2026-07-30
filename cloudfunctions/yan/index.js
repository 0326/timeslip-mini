const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function tryUnlock(OPENID, key) {
  try {
    const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (!userRes.data || !userRes.data.length) return
    const user = userRes.data[0]
    const achievements = user.achievements || []
    if (achievements.some(a => a.key === key)) return
    const REWARDS = { first_chat: 10, first_letter: 10, first_like: 5, dna_done: 20, chat_10: 30, chat_50: 80, letter_5: 50, comment_10: 30, first_memorial: 20, memorial_5: 80, read_book: 15, all_dynasties: 200, collector: 500, time_master: 1000 }
    const reward = REWARDS[key] || 0
    achievements.push({ key, unlockedAt: new Date() })
    await db.collection('users').doc(user._id).update({
      data: { achievements, points: db.command.inc(reward), updatedAt: db.serverDate() }
    })
  } catch (e) { console.warn('tryUnlock fail', key, e.message) }
}

// ====== 信使配置 ======
// 往返时长（毫秒）。开发模式自动缩短为秒级便于测试
const DEV_MODE = process.env.NODE_ENV === 'dev' || process.env.YAN_DEV === '1'
const HOUR = 3600 * 1000

const CARRIERS = {
  qinghong: {
    key: 'qinghong',
    name: '轻鸿',
    duration: DEV_MODE ? 5 * 1000 : 4 * HOUR,
    accuracy: 0.8,
    power: 'small',
    powerLabel: '轻薄',
    rareWeight: 25,
    rareLabel: '普通',
    tags: ['一日往返', '载物轻薄', '偶有迷途'],
    desc: '羽翼轻盈，乘风疾行。气力有限，只能捎带轻巧风物，偶尔会迷失时空。'
  },
  guiyan: {
    key: 'guiyan',
    name: '归雁',
    duration: DEV_MODE ? 10 * 1000 : 12 * HOUR,
    accuracy: 1.0,
    power: 'medium',
    powerLabel: '中等',
    rareWeight: 55,
    rareLabel: '精良',
    tags: ['两日往返', '定向必达', '稳妥可靠'],
    desc: '循亘古航路而行，守信不误，定向投递万无一失。所携风物品相适中。'
  },
  daocao: {
    key: 'daocao',
    name: '大雕',
    duration: DEV_MODE ? 15 * 1000 : 24 * HOUR,
    accuracy: 0.9,
    power: 'large',
    powerLabel: '厚重',
    rareWeight: 90,
    rareLabel: '稀有',
    tags: ['三日往返', '可负重宝', '偶会漂流'],
    desc: '翱翔云海，负重远行。运力超群，常带回厚重珍稀古物；偶有随风漂泊。'
  }
}

const CARRIER_LIST = ['qinghong', 'guiyan', 'daocao'].map(k => ({ key: k, ...CARRIERS[k] }))

// ====== 朝代与人物 ======
// 朝代显示名映射（云端维护，前端不存简化值）
const DYNASTY_NAME_MAP = {
  xianqin: '先秦', xia: '夏', shang: '商', zhou: '周', chunqiu: '春秋', zhanguo: '战国',
  han: '汉', xihan: '西汉', donghan: '东汉', sanguo: '三国',
  weijin: '魏晋', jin: '晋', nanbeichao: '南北',
  tang: '唐', wuzhou: '武周',
  song: '宋', beisong: '北宋', nansong: '南宋',
  yuan: '元', ming: '明', qing: '清'
}

// 硬编码兜底数据（DB 不可用时使用；同时提供 tone 字段供 AI 回信使用）
const FIGURES_FALLBACK = [
  { figureId: 'fig-kongzi', name: '孔子', title: '至圣先师', dynasty: 'xianqin', dynastyName: '春秋', tone: '温厚谆谆，自称"丘"或"吾"。常引《诗》《书》，语短意长。' },
  { figureId: 'fig-simqian', name: '司马迁', title: '太史公', dynasty: 'han', dynastyName: '西汉', tone: '严谨深沉，引史实作评，自称"仆"，好作"太史公曰"。' },
  { figureId: 'fig-caocao', name: '曹操', title: '魏武帝', dynasty: 'han', dynastyName: '东汉末', tone: '深沉果决，权谋在胸，自称"孤"或"吾"。好引《短歌行》。' },
  { figureId: 'fig-taoqian', name: '陶渊明', title: '五柳先生', dynasty: 'weijin', dynastyName: '东晋', tone: '淡泊超然，自称"潜"或"吾"。爱菊好酒，语出自然。' },
  { figureId: 'fig-libai', name: '李白', title: '诗仙', dynasty: 'tang', dynastyName: '盛唐', tone: '豪放飘逸，好饮好酒，自称"某"或"吾"。开口成诗，必带酒、月、剑、山水。' },
  { figureId: 'fig-baijuyi', name: '白居易', title: '诗魔', dynasty: 'tang', dynastyName: '中唐', tone: '平易浅切，关心民生，自称"乐天"。老妪能解，多用白描。' },
  { figureId: 'fig-wuzetian', name: '武则天', title: '则天大圣皇帝', dynasty: 'tang', dynastyName: '武周', tone: '雍容威严，自称"朕"。爱论朝政与人才，不废女儿柔情。' },
  { figureId: 'fig-sushi', name: '苏轼', title: '东坡居士', dynasty: 'song', dynastyName: '北宋', tone: '旷达幽默，善谈美食与养生，自称"某"或"吾"。亦庄亦谐。' },
  { figureId: 'fig-liqingzhao', name: '李清照', title: '易安居士', dynasty: 'song', dynastyName: '两宋之交', tone: '清丽婉约，自称"妾"或"清照"。善以寻常语写深沉情。' },
  { figureId: 'fig-xinqiji', name: '辛弃疾', title: '词中之龙', dynasty: 'song', dynastyName: '南宋', tone: '豪迈悲壮，自称"某"或"稼轩"。念念北伐，笔带金戈。' },
  { figureId: 'fig-guanhanqing', name: '关汉卿', title: '已斋叟', dynasty: 'yuan', dynastyName: '元', tone: '豪放不羁，自称"汉卿"。通晓市井，笔下多悲欢。' },
  { figureId: 'fig-zhenghe', name: '郑和', title: '三保太监', dynasty: 'ming', dynastyName: '明', tone: '沉稳开阔，见多识广，自称"本使"。善言远洋风物。' },
  { figureId: 'fig-wangyangming', name: '王阳明', title: '文成公', dynasty: 'ming', dynastyName: '明', tone: '睿智通达，自称"守仁"。倡知行合一，语多哲思。' },
  { figureId: 'fig-nalan', name: '纳兰性德', title: '容若', dynasty: 'qing', dynastyName: '清', tone: '深情绵邈，自称"成德"。词风清哀，语出肺腑。' },
  { figureId: 'fig-caoxueqin', name: '曹雪芹', title: '芹溪', dynasty: 'qing', dynastyName: '清', tone: '博雅多情，自称"雪芹"。阅尽繁华，笔落沧桑。' }
]

// 模块级缓存：从数据库 figures 集合加载的人物列表
let _dbFigures = null
let _dbFiguresTime = 0
const DB_CACHE_TTL = 5 * 60 * 1000

async function loadDbFigures() {
  const now = Date.now()
  if (_dbFigures && (now - _dbFiguresTime) < DB_CACHE_TTL) return _dbFigures
  try {
    const r = await db.collection('figures')
      .field({ id: true, figureId: true, name: true, title: true, figureTitle: true, dynasty: true, avatar_url: true, mini_avatar_url: true, avatar: true })
      .limit(200)
      .get()
    _dbFigures = (r.data || []).map(f => {
      const figureId = f.figureId || (f.id ? 'fig-' + f.id : '')
      const fb = FIGURES_FALLBACK.find(hf => hf.figureId === figureId)
      return {
        figureId,
        name: f.name || (fb ? fb.name : ''),
        title: f.title || f.figureTitle || (fb ? fb.title : ''),
        dynasty: f.dynasty || (fb ? fb.dynasty : ''),
        dynastyName: DYNASTY_NAME_MAP[f.dynasty] || (fb ? fb.dynastyName : '') || f.dynasty || '',
        avatar: f.mini_avatar_url || f.avatar_url || f.avatar || '',
        tone: fb ? fb.tone : '温文尔雅，自称"某"'
      }
    }).filter(f => f.figureId && f.name)
    _dbFiguresTime = now
    return _dbFigures
  } catch (e) {
    console.warn('loadDbFigures error:', e.message)
    return null
  }
}

function getActiveFigures() {
  return _dbFigures && _dbFigures.length ? _dbFigures : FIGURES_FALLBACK
}

function findFigure(id) {
  const figures = getActiveFigures()
  return figures.find(f => f.figureId === id) || { name: '古代贤人', title: '', dynasty: '', dynastyName: '', tone: '温文尔雅，自称"某"' }
}

function randomFigure(exclude, dynasty) {
  let pool = getActiveFigures()
  if (dynasty && dynasty !== 'random' && dynasty !== 'all') {
    pool = pool.filter(f => f.dynasty === dynasty)
  }
  if (exclude) {
    pool = pool.filter(f => f.figureId !== exclude)
  }
  if (!pool.length) pool = getActiveFigures()
  return pool[Math.floor(Math.random() * pool.length)]
}

// ====== 风物池 ======
// rarity: 1普通 2精良 3稀有 4传说
// power: small / medium / large 对应信使载力
const GIFT_POOL = [
  // 小型（轻鸿）
  { id: 'g-brush', name: '湖笔', icon: '🖌️', rarity: 1, type: '笔墨纸砚', desc: '宣笔之冠，锋颖尖齐', weight: { small: 30, medium: 15, large: 5 } },
  { id: 'g-paper', name: '澄心笺', icon: '📄', rarity: 1, type: '笔墨纸砚', desc: '南唐澄心堂纸，光洁如玉', weight: { small: 28, medium: 12, large: 4 } },
  { id: 'g-incense', name: '鹅梨帐香', icon: '🕯️', rarity: 2, type: '茶酒食', desc: '江南合香，清幽入梦', weight: { small: 15, medium: 20, large: 8 } },
  { id: 'g-coin', name: '开元通宝', icon: '🪙', rarity: 1, type: '玉器青铜', desc: '唐初铸币，字迹遒劲', weight: { small: 25, medium: 10, large: 3 } },
  { id: 'g-snack', name: '水晶点心', icon: '🍡', rarity: 1, type: '茶酒食', desc: '宋时茶肆点心，玲珑剔透', weight: { small: 22, medium: 8, large: 2 } },
  // 中型（归雁）
  { id: 'g-tea', name: '顾渚紫笋', icon: '🍵', rarity: 2, type: '茶酒食', desc: '唐代贡茶，紫笋飘香', weight: { small: 8, medium: 25, large: 12 } },
  { id: 'g-fan', name: '折扇', icon: '🪭', rarity: 2, type: '笔墨纸砚', desc: '苏工折扇，一面书画', weight: { small: 5, medium: 22, large: 10 } },
  { id: 'g-jade', name: '螭纹玉佩', icon: '🔮', rarity: 3, type: '玉器青铜', desc: '和田白玉，螭龙穿云', weight: { small: 2, medium: 12, large: 20 } },
  { id: 'g-pottery', name: '越窑青瓷', icon: '🏺', rarity: 2, type: '玉器青铜', desc: '秘色瓷盏，千峰翠色', weight: { small: 3, medium: 18, large: 15 } },
  { id: 'g-calligraphy', name: '兰亭序拓', icon: '📜', rarity: 3, type: '古籍字画', desc: '神龙本拓片，天下第一行书', weight: { small: 1, medium: 10, large: 18 } },
  // 大型（大雕）
  { id: 'g-wine', name: '剑南烧春', icon: '🍶', rarity: 3, type: '茶酒食', desc: '唐时名酒，剑南春前身', weight: { small: 0, medium: 8, large: 22 } },
  { id: 'g-bronze', name: '商周青铜爵', icon: '⚱️', rarity: 4, type: '玉器青铜', desc: '三足酒器，饕餮纹饰', weight: { small: 0, medium: 2, large: 15 } },
  { id: 'g-scroll', name: '古籍残卷', icon: '📕', rarity: 3, type: '古籍字画', desc: '敦煌遗书残页，墨迹犹新', weight: { small: 0, medium: 5, large: 20 } },
  { id: 'g-rubbing', name: '名家碑拓', icon: '🪨', rarity: 3, type: '古籍字画', desc: '汉碑原拓，金石气足', weight: { small: 0, medium: 6, large: 18 } },
  { id: 'g-seal', name: '传国玉玺(仿)', icon: '⚜️', rarity: 4, type: '玉器青铜', desc: '仿制传国玺，螭纽方寸', weight: { small: 0, medium: 1, large: 8 } }
]

const RARITY_LABELS = { 1: '普通', 2: '精良', 3: '稀有', 4: '传说' }

function dropGift(power) {
  const pool = GIFT_POOL.filter(g => (g.weight[power] || 0) > 0)
  const total = pool.reduce((s, g) => s + g.weight[power], 0)
  let roll = Math.random() * total
  for (const g of pool) {
    roll -= g.weight[power]
    if (roll <= 0) {
      return { id: g.id, name: g.name, icon: g.icon, rarity: g.rarity, rarityLabel: RARITY_LABELS[g.rarity], type: g.type, desc: g.desc }
    }
  }
  const g = pool[0]
  return { id: g.id, name: g.name, icon: g.icon, rarity: g.rarity, rarityLabel: RARITY_LABELS[g.rarity], type: g.type, desc: g.desc }
}

// ====== AI 回信生成 ======
function buildYanPrompt(figure, letterContent, fromName) {
  return `你是${figure.name}${figure.title ? '（' + figure.title + '）' : ''}，${figure.dynastyName}人。
性格风格：${figure.tone}
你刚刚收到一封由鸿雁千里送来的信笺。

【来信人】：${fromName || '远方友人'}
【来信内容】：
${letterContent}

请以${figure.name}的身份写一封回信，严格遵守：
1. 文言或半文半白格式，开头称呼、中间抒情议事、结尾署名；
2. 长度150-250字，感情真挚，符合上述性格风格；
3. 可引用历史典故或你本人的名句，但要自然贴切；
4. 不得出现AI、现代网络词汇，始终保持古人身份与视角；
5. 回信须回应来信内容，不可泛泛而谈。

只输出回信正文，不要任何前缀说明。`
}

// 尝试调用真实大模型（若配置了 API）
// 注意：低版本 Node 运行时无全局 fetch，需判空兜底；AI 调用限时 8s，超时回退模板
async function callRealAI(prompt) {
  const apiKey = process.env.AI_API_KEY || process.env.DOUBAO_API_KEY
  const apiUrl = process.env.AI_API_URL || process.env.DOUBAO_API_URL
  if (!apiKey || !apiUrl) return null
  if (typeof fetch !== 'function') {
    console.warn('callRealAI: runtime without fetch, use fallback')
    return null
  }
  try {
    const req = fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'doubao-pro-32k',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.85,
        max_tokens: 600
      })
    })
    const res = await Promise.race([
      req,
      new Promise((_, reject) => setTimeout(() => reject(new Error('ai request timeout')), 8000))
    ])
    if (!res.ok) return null
    const json = await res.json()
    const text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content
    return text ? text.trim() : null
  } catch (e) {
    console.warn('callRealAI fail:', e.message)
    return null
  }
}

// 高质量模板兜底（未配置 AI Key 时使用）
function fallbackReply(figure, letterContent) {
  const name = figure.name
  const t = (letterContent || '来信').slice(0, 24)
  const pools = {
    'fig-libai': [
      `某某吾友如晤：\n  来书已达，读之令某抚掌大笑！「${t}」——此言深合吾意。人生飘忽百年内，且须酣畅万古情。\n  某今夜月下独酌，三杯通大道，一斗合自然。恨不能与君对饮三百杯！他日若能穿越千载，当与君同游名山，醉卧长安。\n  千里寄此，纸短情长。唯愿君亦能常怀此豪情，不负此生。\n\n  李白 顿首`,
      `吾友台鉴：\n  鸿雁传书，千里送君之言，某展读再三，欣然忘食。「${t}」——妙哉斯言！\n  昔某醉中作「飞流直下三千尺」，醒后自疑。今得君信，方知千古知音难遇。月既不解饮，影徒随我身，然君之语，如清风入怀。\n  且尽杯中酒，寄情白云间。他日有缘，当浮一大白！\n\n  青莲居士 李白 拜上`
    ],
    'fig-sushi': [
      `某某吾友足下：\n  来函已悉，读之莞尔。「${t}」——君之胸怀，颇似东坡。\n  人生如逆旅，我亦是行人。某一生颠沛，黄州惠州儋州，然未尝一日忘食也。竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。\n  不知君可尝过东坡肉乎？若未尝，实为憾事。慢着火，少着水，火候足时他自美。\n  千里寄言，愿君旷达。且将新火试新茶，诗酒趁年华。\n\n  苏轼 顿首`,
      `吾友如晤：\n  得鸿雁传书，如对故人。「${t}」——此语甚妙，使某忆起赤壁之夜，清风徐来，水波不兴。\n  江上之清风，与山间之明月，耳得之而为声，目遇之而成色。君之来信，亦如清风明月，取之无禁，用之不竭。\n  愿君亦能于寻常处见不寻常，则何处不是好风光。\n\n  东坡居士 苏轼 拜复`
    ],
    default: [
      `${name}启：\n  鸿雁远至，得君手书，展读之际，如对故人。「${t}」——君之所言，使某感怀不已。\n  人生世间，知音难遇。今得吾友千里寄书，何幸如之！某虽才疏学浅，然君之情谊，铭记于心。\n  秋风渐起，愿君珍重。纸短情长，不尽一一。他日有缘，当再修书。\n\n  ${name} 顿首拜复`,
      `吾友台鉴：\n  来函已达，某展读数四，甚慰甚念。「${t}」——此言甚是。\n  天下熙熙，皆为利来；天下攘攘，皆为利往。然君之所求，似有超乎利者，此乃君子之风也。某虽不才，愿与君共勉之。\n  岁月悠悠，愿君长乐。寄此薄笺，以答雅意。\n\n  ${name} 再拜`
    ]
  }
  const arr = pools[figure.figureId] || pools.default
  return arr[Math.floor(Math.random() * arr.length)]
}

async function generateReply(figure, letterContent, fromName) {
  const prompt = buildYanPrompt(figure, letterContent, fromName)
  const real = await callRealAI(prompt)
  return real || fallbackReply(figure, letterContent)
}

// ====== 内容安全 ======
async function checkText(text, openid) {
  if (!text) return { ok: true }
  try {
    const r = await cloud.openapi.security.msgSecCheck({
      openid, version: 2, scene: 1, content: String(text).slice(0, 2000)
    })
    if (r && r.result && r.result.suggest !== 'pass') {
      return { ok: false, reason: '内容包含不当信息' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: true }
  }
}

// ====== 主入口 ======
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
      case 'carriers': return { code: 0, message: 'ok', data: CARRIER_LIST }
      case 'read': return await markRead(OPENID, data)
      case 'detail': return await getDetail(OPENID, data)
      case 'claim': return await claimGift(OPENID, data)
      default: return { code: -1, message: '未知 yan action: ' + action }
    }
  } catch (err) {
    console.error('yan err:', err)
    return { code: -1, message: err.message || '雁书服务异常' }
  }
}

function normalizeEventData(event) {
  const { action, data, ...rest } = event || {}
  return data && typeof data === 'object' ? { ...rest, ...data } : rest
}

// ====== 人物列表接口（从数据库 figures 集合查询） ======
async function getFigures() {
  const figures = await loadDbFigures()
  const list = figures || FIGURES_FALLBACK
  // 朝代列表以数据库实际数据为准，去重排序
  const dynastySet = new Map()
  list.forEach(f => {
    if (f.dynasty && !dynastySet.has(f.dynasty)) {
      dynastySet.set(f.dynasty, { key: f.dynasty, name: DYNASTY_NAME_MAP[f.dynasty] || f.dynastyName || f.dynasty })
    }
  })
  const dynasties = [{ key: 'random', name: '随机漂流' }, ...Array.from(dynastySet.values())]
  // 返回人物列表（不含 tone 字段，tone 仅服务端 AI 回信用）
  const safeFigures = list.map(f => ({
    figureId: f.figureId,
    name: f.name,
    title: f.title,
    dynasty: f.dynasty,
    dynastyName: f.dynastyName,
    avatar: f.avatar
  }))
  return { code: 0, message: 'ok', data: { dynasties, figures: safeFigures } }
}

// ====== 发送雁书 ======
async function sendLetter(OPENID, data) {
  const { carrier: carrierKey, dynasty, figureId } = data
  const content = String(data.content || '').trim()
  const fromName = String(data.fromName || '').trim().slice(0, 20) || '远方友人'
  if (!content) return { code: -1, message: '请书写信笺内容' }
  if (content.length > 500) return { code: -1, message: '信笺内容不超过500字' }

  const carrier = CARRIERS[carrierKey]
  if (!carrier) return { code: -1, message: '未知信使' }

  const sec = await checkText(content, OPENID)
  if (!sec.ok) return { code: 403, message: sec.reason }

  // 确保数据库人物已加载（用于随机/查找目标人物）
  await loadDbFigures()

  // 投递目标判定：
  // 1. 朝代或人物为 random → 随机漂流（无视准确率）
  // 2. 指定人物 + 信使准确率未命中 → 跑偏为随机漂流
  const isDrift = dynasty === 'random' || !figureId || figureId === 'random'
  let targetFigureId = figureId
  let drifted = false
  if (isDrift) {
    targetFigureId = randomFigure(null, dynasty).figureId
  } else if (carrier.accuracy < 1.0 && Math.random() > carrier.accuracy) {
    drifted = true
    targetFigureId = randomFigure(figureId).figureId
  }

  const figure = findFigure(targetFigureId)
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
    sentAt: now,
    arriveAt: now + carrier.duration,
    reply: null,
    gift: null,
    read: false,
    claimed: false,
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

// ====== 获取记录列表（旅行中 + 已收信） ======
async function getList(OPENID, data) {
  const { tab = 'all' } = data
  try {
    // 先处理已到期的 traveling 信件：实时生成回信
    await processArrived(OPENID)

    let where = { _openid: OPENID }
    if (tab === 'traveling') where.status = 'traveling'
    if (tab === 'arrived') where.status = 'arrived'

    const r = await db.collection('yan_letters')
      .where(where)
      .orderBy('sentAt', 'desc')
      .limit(100)
      .get()

    const letters = (r.data || []).map(l => formatLetter(l))
    // 统计未读
    const unread = letters.filter(l => l.status === 'arrived' && !l.read).length

    return { code: 0, message: 'ok', data: { letters, unread } }
  } catch (e) {
    return { code: 0, message: 'ok', data: { letters: [], unread: 0 } }
  }
}

// 处理已到期的 traveling 信件，实时生成回信与风物
// 并发安全：先用原子更新把 status 从 traveling 改为 processing 抢占处理权，
// 避免 list / detail 并发调用时重复生成回信；失败时回滚为 traveling
const PROCESSING_STALE_MS = 2 * 60 * 1000

async function processArrived(OPENID) {
  const now = Date.now()
  try {
    // 到期的 traveling + 超时未完成的 processing（上次崩溃残留）
    const r = await db.collection('yan_letters')
      .where({
        _openid: OPENID,
        ..._.or([
          { status: 'traveling', arriveAt: _.lte(now) },
          { status: 'processing', processingAt: _.lt(now - PROCESSING_STALE_MS) }
        ])
      })
      .limit(20)
      .get()

    for (const letter of r.data) {
      // 原子抢占：仅当状态仍是 traveling/processing 时才更新，避免并发重复处理
      try {
        const lock = await db.collection('yan_letters')
          .where({ _id: letter._id, _openid: OPENID, status: letter.status })
          .update({ data: { status: 'processing', processingAt: now } })
        if (!lock.stats || !lock.stats.updated) continue

        const figure = findFigure(letter.figureId)
        const carrier = CARRIERS[letter.carrier] || CARRIERS.qinghong
        const reply = await generateReply(figure, letter.content, letter.fromName)
        const gift = dropGift(carrier.power)

        await db.collection('yan_letters').doc(letter._id).update({
          data: {
            status: 'arrived',
            processingAt: _.remove(),
            reply: { content: reply, figureName: figure.name },
            gift,
            arrivedAt: db.serverDate()
          }
        })

        tryUnlock(OPENID, 'first_letter')
        ;(async () => {
          try {
            const cnt = await db.collection('yan_letters').where({ _openid: OPENID, status: 'arrived' }).count()
            if ((cnt.total || 0) >= 5) await tryUnlock(OPENID, 'letter_5')
          } catch (e) {}
        })()
      } catch (e) {
        console.warn('processArrived single fail:', e.message)
        // 回滚为 traveling，下次进入列表时重试
        try {
          await db.collection('yan_letters')
            .where({ _id: letter._id, _openid: OPENID, status: 'processing' })
            .update({ data: { status: 'traveling', processingAt: _.remove() } })
        } catch (rollbackErr) {
          console.warn('processArrived rollback fail:', rollbackErr.message)
        }
      }
    }
  } catch (e) {
    console.warn('processArrived fail:', e.message)
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
    sentAt: l.sentAt,
    arriveAt: l.arriveAt,
    reply: l.reply,
    gift: l.gift,
    read: l.read,
    claimed: l.claimed
  }
}

// ====== 信件详情 ======
async function getDetail(OPENID, data) {
  const { letterId } = data
  if (!letterId) return { code: -1, message: '缺少 letterId' }
  try {
    // 确保回信已生成
    await processArrived(OPENID)
    const r = await db.collection('yan_letters').doc(letterId).get()
    if (!r.data) return { code: -1, message: '信件不存在' }
    if (r.data._openid !== OPENID) return { code: 403, message: '无权限' }
    return { code: 0, message: 'ok', data: formatLetter(r.data) }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// ====== 标记已读 ======
async function markRead(OPENID, data) {
  const { letterId } = data
  if (!letterId) return { code: -1, message: '缺少 letterId' }
  try {
    const r = await db.collection('yan_letters').doc(letterId).get()
    if (!r.data) return { code: -1, message: '信件不存在' }
    if (r.data._openid !== OPENID) return { code: 403, message: '无权限' }
    await db.collection('yan_letters').doc(letterId).update({ data: { read: true } })
    return { code: 0, message: 'ok' }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// ====== 领取风物入藏馆 ======
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

    // 写入用户藏馆
    const gift = r.data.gift
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

    return { code: 0, message: 'ok', data: { gift } }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// ====== 藏馆列表 ======
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
    // 未解锁的风物
    const locked = GIFT_POOL.filter(g => !collectedIds.includes(g.id)).map(g => ({
      giftId: g.id,
      name: g.name,
      icon: g.icon,
      rarity: g.rarity,
      rarityLabel: RARITY_LABELS[g.rarity],
      type: g.type,
      desc: g.desc,
      count: 0,
      locked: true
    }))

    const stats = {
      collected: collected.length,
      total: GIFT_POOL.length,
      rare: collected.filter(g => g.rarity >= 3).length,
      completion: Math.round(collected.length / GIFT_POOL.length * 1000) / 10
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
    return { code: 0, message: 'ok', data: { collected: [], locked: GIFT_POOL.map(g => ({ giftId: g.id, name: g.name, icon: g.icon, rarity: g.rarity, rarityLabel: RARITY_LABELS[g.rarity], type: g.type, locked: true })), stats: { collected: 0, total: GIFT_POOL.length, rare: 0, completion: 0 } } }
  }
}
