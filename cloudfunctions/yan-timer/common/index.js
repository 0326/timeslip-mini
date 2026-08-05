// yan-common/index.js
// 雁书功能公共模块，供 cloudfunctions/yan 和 yan-timer 共用
// 依赖调用方先执行 cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const cloud = require('wx-server-sdk')
const db = cloud.database()
const _ = db.command

// 引入100件文物数据
const { GIFT_POOL } = require('./giftData')

// ========== 全局配置 ==========
const DEV_MODE = process.env.NODE_ENV === 'dev' || process.env.YAN_DEV === '1'
const HOUR = 3600 * 1000

// 成就奖励配置（与现有系统保持一致）
const REWARDS = {
  first_chat: 10, first_letter: 10, first_like: 5, dna_done: 20,
  first_visit: 10, first_profile: 10, chat_10: 30, chat_50: 80,
  letter_5: 50, comment_10: 30, chat_100: 150, letter_10: 100,
  first_memorial: 20, memorial_5: 80, read_book: 15, memorial_20: 200,
  read_5: 100, dna_share: 30, all_dynasties: 200, collector: 500,
  time_master: 1000, all_figures: 300, moment_popular: 200, memorial_master: 500
}

// ========== 信使配置 ==========
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
    tags: ['载物轻薄', '偶有迷途'],
    desc: '羽翼轻盈，乘风疾行。气力有限，只能捎带轻巧风物，偶尔会迷失时空。',
    aura: 'rgba(212,165,116,0.2)'
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
    tags: ['定向必达', '稳妥可靠'],
    desc: '循亘古航路而行，守信不误，定向投递万无一失。所携风物品相适中。',
    aura: 'rgba(196,30,58,0.18)'
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
    tags: ['可负重宝', '偶会漂流'],
    desc: '翱翔云海，负重远行。运力超群，常带回厚重珍稀古物；偶有随风漂泊。',
    aura: 'rgba(15,52,96,0.35)'
  },
  jingwei: {
    key: 'jingwei',
    name: '精卫',
    duration: 7 * 1000,
    speedLabel: '7秒',
    accuracy: 1.0,
    power: 'large',
    powerLabel: '厚重',
    rareWeight: 100,
    rareLabel: '传说',
    tags: ['神鸟通灵', '万里必达'],
    desc: '炎帝之女化鸟，衔石填海，百折不挠。神鸟通灵，万里必达，携古之重宝如若等闲。',
    aura: 'rgba(255,107,53,0.25)',
    adminOnly: true
  }
}

const CARRIER_LIST = ['qinghong', 'guiyan', 'daocao', 'jingwei'].map(k => ({ key: k, ...CARRIERS[k] }))

// ========== 朝代名映射 ==========
const DYNASTY_NAME_MAP = {
  xianqin: '先秦', xia: '夏', shang: '商', zhou: '周', chunqiu: '春秋', zhanguo: '战国',
  han: '汉', xihan: '西汉', donghan: '东汉', sanguo: '三国',
  weijin: '魏晋', jin: '晋', nanbeichao: '南北',
  tang: '唐', wuzhou: '武周',
  song: '宋', beisong: '北宋', nansong: '南宋',
  yuan: '元', ming: '明', qing: '清'
}

// ========== 人物兜底数据 ==========
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

// ========== 人物 DB 加载 ==========
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

// ========== 风物池（100件文物数据从 giftData.js 引入） ==========

const RARITY_LABELS = { 1: '普通', 2: '精良', 3: '稀有', 4: '传说' }

// 稀有度概率衰减系数：稀有度越高，有效权重越低，出率自然递减
const RARITY_MULTIPLIER = {
  1: 1.0,   // 普通 — 基础权重
  2: 0.45,  // 精良 — 权重降低 55%
  3: 0.12,  // 稀有 — 权重降低 88%
  4: 0.025, // 传说 — 权重降低 97.5%
}

// ========== 角色-文物对应关系 ==========
// exclusive: 角色专属文物（与角色有强历史关联），权重 ×2.0
// dynasty: 朝代文物（角色所属朝代的代表性文物），权重 ×1.0
const FIGURE_GIFT_MAP = {
  'fig-kongzi': { exclusive: ['g-brush', 'g-paper', 'g-yuxi'], dynasty: ['g-bronze', 'g-yubi', 'g-yuhuang'] },
  'fig-simqian': { exclusive: ['g-scroll', 'g-rubbing', 'g-songmo'], dynasty: ['g-tongjing', 'g-sushayi'] },
  'fig-caocao': { exclusive: ['g-wine', 'g-bronze', 'g-tongjian'], dynasty: ['g-jade', 'g-tongjing'] },
  'fig-taoqian': { exclusive: ['g-snack', 'g-fan', 'g-incense'], dynasty: ['g-pottery', 'g-kuixue'] },
  'fig-libai': { exclusive: ['g-wine', 'g-coin', 'g-jinbuyao'], dynasty: ['g-pottery', 'g-jade', 'g-tongjinghaishou'] },
  'fig-baijuyi': { exclusive: ['g-tea', 'g-fan', 'g-tuhaozhan'], dynasty: ['g-paper', 'g-coin', 'g-wumahuci'] },
  'fig-wuzetian': { exclusive: ['g-seal', 'g-coin', 'g-jinlong'], dynasty: ['g-jade', 'g-pottery', 'g-jinwan'] },
  'fig-sushi': { exclusive: ['g-tea', 'g-brush', 'g-hanshiti'], dynasty: ['g-snack', 'g-paper', 'g-dingyao'] },
  'fig-liqingzhao': { exclusive: ['g-paper', 'g-rubbing', 'g-kesi'], dynasty: ['g-fan', 'g-tea', 'g-jianyao'] },
  'fig-xinqiji': { exclusive: ['g-jade', 'g-rubbing', 'g-tongjian'], dynasty: ['g-bronze', 'g-scroll', 'g-longquan'] },
  'fig-guanhanqing': { exclusive: ['g-snack', 'g-incense', 'g-tihong'], dynasty: ['g-pottery', 'g-wine', 'g-yuanqinghua'] },
  'fig-zhenghe': { exclusive: ['g-pottery', 'g-seal', 'g-yunjin'], dynasty: ['g-jade', 'g-mingqinghua', 'g-dehua'] },
  'fig-wangyangming': { exclusive: ['g-scroll', 'g-brush', 'g-zhukebitong'], dynasty: ['g-fan', 'g-calligraphy', 'g-sheyan'] },
  'fig-nalan': { exclusive: ['g-fan', 'g-paper', 'g-cixiuxiangnang'], dynasty: ['g-calligraphy', 'g-incense', 'g-feicui'] },
  'fig-caoxueqin': { exclusive: ['g-calligraphy', 'g-scroll', 'g-qinglongpao'], dynasty: ['g-seal', 'g-rubbing', 'g-biyanhu'] },
}

// 朝代兜底文物池（角色不在 FIGURE_GIFT_MAP 时使用）
const DYNASTY_GIFT_MAP = {
  xianqin: ['g-bronze', 'g-yubi', 'g-yucong', 'g-yuxi', 'g-yuhuang', 'g-yuren'],
  shang: ['g-simuwuding', 'g-siyangfangzun', 'g-bronze', 'g-tonggu', 'g-yuren'],
  zhou: ['g-tongding', 'g-tonggui', 'g-yuhuang', 'g-maogongding'],
  chunqiu: ['g-yuxi', 'g-jade'],
  zhanguo: ['g-jade', 'g-yudaiou', 'g-tongjian', 'g-bianzhong'],
  han: ['g-tongding', 'g-tonggui', 'g-tongjing', 'g-sushayi', 'g-songmo', 'g-rubbing', 'g-yudaiou'],
  donghan: ['g-jade', 'g-tongjing', 'g-coin'],
  weijin: ['g-pottery', 'g-incense', 'g-fan', 'g-kuixue', 'g-tixiwan'],
  sanguo: ['g-shujin', 'g-tongjian'],
  tang: ['g-coin', 'g-tea', 'g-wine', 'g-pottery', 'g-jinbuyao', 'g-jinwan', 'g-yinchaju', 'g-wumahuci', 'g-jinlong', 'g-tongjinghaishou', 'g-calligraphy', 'g-yanzhenqing', 'g-liuli', 'g-tangruqun', 'g-weiqizi', 'g-touzi'],
  wuzhou: ['g-seal', 'g-coin', 'g-jade', 'g-pottery', 'g-jinlong', 'g-jinwan'],
  song: ['g-tea', 'g-paper', 'g-brush', 'g-calligraphy', 'g-longfengtea', 'g-tuhaozhan', 'g-kesi', 'g-songban', 'g-hanshiti', 'g-songjin', 'g-dingyao', 'g-jianyao', 'g-ruyao', 'g-junyao', 'g-longquan', 'g-tixiwan', 'g-mudiaoguanyin'],
  beisong: ['g-tea', 'g-paper', 'g-brush', 'g-dingyao', 'g-ruyao', 'g-junyao', 'g-longfengtea', 'g-kesi', 'g-songban', 'g-hanshiti'],
  nansong: ['g-jianyao', 'g-longquan', 'g-tuhaozhan', 'g-mudiaoguanyin'],
  yuan: ['g-brush', 'g-huimo', 'g-tihong', 'g-yuanqinghua', 'g-zhaomengfu', 'g-qishayan'],
  ming: ['g-langhao', 'g-yuguanbi', 'g-fan', 'g-luodian', 'g-tanxiangshan', 'g-mingqinghua', 'g-dehua', 'g-minghuiben', 'g-mingbuzi', 'g-qiangjinpan', 'g-xianglu', 'g-yunjin', 'g-sheyan', 'g-zigang'],
  qing: ['g-xiangyabi', 'g-feicui', 'g-ruyi', 'g-fencai', 'g-jinguan', 'g-heiqimiao', 'g-qinglongpao', 'g-cixiuxiangnang', 'g-biyanhu', 'g-chaozhu', 'g-qishayan', 'g-dianshijuan', 'g-zhukebitong', 'g-suxiutuan', 'g-huluqiqi'],
  wudai: ['g-paper', 'g-huimo'],
}

// 关系类型权重倍数
var GIFT_RELATION_WEIGHT = { exclusive: 2.0, dynasty: 1.0, global: 0.3 }

function formatGift(g) {
  return {
    id: g.id,
    name: g.name,
    icon: g.icon,
    imageUrl: g.imageUrl || '',
    photoUrl: g.photoUrl || '',
    rarity: g.rarity,
    rarityLabel: RARITY_LABELS[g.rarity],
    type: g.type,
    dynasty: g.dynasty || '',
    dynastyName: g.dynastyName || '',
    desc: g.desc,
    history: g.history || '',
  }
}

// 掉落风物：支持角色专属 + 朝代兜底 + 全局兜底，稀有度越高出率越低
function dropGift(power, figureId, dynasty) {
  var candidatePool = []
  var seenIds = {}

  function addCandidate(id, relationWeight) {
    if (seenIds[id]) return
    var gift = null
    for (var i = 0; i < GIFT_POOL.length; i++) {
      if (GIFT_POOL[i].id === id) { gift = GIFT_POOL[i]; break }
    }
    if (!gift) return
    var baseWeight = gift.weight[power] || 0
    if (baseWeight <= 0) return
    var rarityMult = RARITY_MULTIPLIER[gift.rarity] || 1
    var w = baseWeight * rarityMult * relationWeight
    if (w > 0) { candidatePool.push({ gift: gift, weight: w }); seenIds[id] = true }
  }

  // 1. 角色专属文物池
  if (figureId && FIGURE_GIFT_MAP[figureId]) {
    var figMap = FIGURE_GIFT_MAP[figureId]
    ;(figMap.exclusive || []).forEach(function (id) { addCandidate(id, GIFT_RELATION_WEIGHT.exclusive) })
    ;(figMap.dynasty || []).forEach(function (id) { addCandidate(id, GIFT_RELATION_WEIGHT.dynasty) })
  }

  // 2. 朝代兜底池
  if (!candidatePool.length && dynasty && DYNASTY_GIFT_MAP[dynasty]) {
    DYNASTY_GIFT_MAP[dynasty].forEach(function (id) { addCandidate(id, GIFT_RELATION_WEIGHT.dynasty) })
  }

  // 3. 全局兜底池
  if (!candidatePool.length) {
    GIFT_POOL.forEach(function (gift) { addCandidate(gift.id, GIFT_RELATION_WEIGHT.global) })
  }

  if (!candidatePool.length) return null

  // 4. 加权随机
  var total = 0
  for (var j = 0; j < candidatePool.length; j++) { total += candidatePool[j].weight }
  var roll = Math.random() * total
  for (var k = 0; k < candidatePool.length; k++) {
    roll -= candidatePool[k].weight
    if (roll <= 0) { return formatGift(candidatePool[k].gift) }
  }
  return formatGift(candidatePool[0].gift)
}

// ========== 成就解锁 ==========
async function tryUnlock(OPENID, key) {
  try {
    const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (!userRes.data || !userRes.data.length) return
    const user = userRes.data[0]
    const achievements = user.achievements || []
    if (achievements.some(a => a.key === key)) return
    const reward = REWARDS[key] || 0
    achievements.push({ key, unlockedAt: new Date() })
    await db.collection('users').doc(user._id).update({
      data: { achievements, points: db.command.inc(reward), updatedAt: db.serverDate() }
    })
  } catch (e) { console.warn('tryUnlock fail', key, e.message) }
}

// ========== AI 回信生成 ==========
function buildYanPrompt(figure, letterContent, fromName, history) {
  const historyText = history && history.length
    ? history.map((h, i) =>
        `第${i + 1}轮\n来信：${(h.content || '').slice(0, 100)}\n回信：${(h.reply || '').slice(0, 100)}`
      ).join('\n\n')
    : '（首次通信）'

  return `你是${figure.name}${figure.title ? '（' + figure.title + '）' : ''}，${figure.dynastyName}人。
性格风格：${figure.tone}

【通信历史】
${historyText}

【本次来信人】：${fromName || '远方友人'}
【本次来信内容】：
${letterContent}

请以${figure.name}的身份写一封回信，严格遵守：
1. 若有通信历史，需自然呼应之前的对话内容
2. 文言或半文半白格式，开头称呼、中间抒情议事、结尾署名
3. 长度150-250字，感情真挚，符合上述性格风格
4. 可引用历史典故或你本人的名句，但要自然贴切
5. 不得出现AI、现代网络词汇，始终保持古人身份与视角
6. 回信须回应来信内容，不可泛泛而谈

只输出回信正文，不要任何前缀说明。`
}

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

// 全人物专属模板（15人 × 2条 = 30条）
function fallbackReply(figure, letterContent) {
  const name = figure.name
  const t = (letterContent || '来信').slice(0, 24)
  const pools = {
    'fig-kongzi': [
      `${name}启：\n  鸿雁千里至，得君手书，展读再三，甚慰。「${t}」——君之所问，正合仁义之道。\n  丘尝言：己所不欲，勿施于人。君能思此，可谓善学矣。诗三百，一言以蔽之，曰思无邪。愿君亦以诚心待人，则天下何往而不可哉。\n  秋风渐凉，望君珍重。\n\n  丘 再拜`,
      `吾友如晤：\n  来函已悉。「${t}」——此言甚善。\n  丘尝闻之，学而不思则罔，思而不学则殆。君既有此悟，当以读书穷理为务。三人行，必有我师焉，君之悟已胜过许多人矣。\n  纸短情长，不尽欲言。\n\n  丘 顿首`
    ],
    'fig-simqian': [
      `${name}再拜：\n  鸿雁传书，得君来函。「${t}」——读之令仆感慨万千。\n  仆遭李陵之祸，幽于缧绁，然网罗天下放失旧闻，考之行事，稽其成败兴坏之理，未尝一日辍也。君之所言，使仆忆起当年遍游名山大川之时，甚念。\n  人固有一死，或重于泰山，或轻于鸿毛。愿君亦能择重而行。\n\n  迁 顿首`,
      `吾友足下：\n  来书已达。「${t}」——此言有史家之风。\n  太史公曰：天下熙熙，皆为利来；天下攘攘，皆为利往。然君之所求，似有超乎利者，此乃君子之风也。仆虽身残，然史笔在手，不敢稍怠。\n  愿君长乐，岁稔年丰。\n\n  迁 再拜`
    ],
    'fig-caocao': [
      `${name}手书：\n  得君来函，孤已阅毕。「${t}」——此言甚合孤意。\n  对酒当歌，人生几何！譬如朝露，去日苦多。君之来信，使孤忆起当年横槊赋诗之时，感慨系之。青青子衿，悠悠我心，但为君故，沉吟至今。\n  天下未定，孤不敢有一日懈怠。愿君亦能勉之。\n\n  操 拜复`,
      `吾友台鉴：\n  鸿雁远至，得君手书。「${t}」——妙哉斯言。\n  孤尝作《短歌行》，月明星稀，乌鹊南飞，绕树三匝，何枝可依？君之来信，如远方知音，使孤顿生相见恨晚之意。山不厌高，海不厌深，周公吐哺，天下归心。\n  他日有缘，当与君把酒言欢。\n\n  操 顿首`
    ],
    'fig-taoqian': [
      `${name}拜复：\n  得君来书，如对故人。「${t}」——君之胸怀，颇有五柳之风。\n  潜性本爱丘山，误落尘网中，一去三十年。羁鸟恋旧林，池鱼思故渊。今已归去来兮，采菊东篱下，悠然见南山。君若得闲，当来此共饮一杯。\n  此中有真意，欲辨已忘言。\n\n  潜 顿首`,
      `吾友如晤：\n  来函已悉。「${t}」——读之使潜莞尔。\n  少学琴书，偶爱闲静，开卷有得，便欣然忘食。环堵萧然，不蔽风日，短褐穿结，箪瓢屡空，晏如也。君之所求，何必外求？此心安定，处处皆归处。\n  秋菊可采，愿君同来。\n\n  潜 再拜`
    ],
    'fig-libai': [
      `某某吾友如晤：\n  来书已达，读之令某抚掌大笑！「${t}」——此言深合吾意。人生飘忽百年内，且须酣畅万古情。\n  某今夜月下独酌，三杯通大道，一斗合自然。恨不能与君对饮三百杯！他日若能穿越千载，当与君同游名山，醉卧长安。\n  千里寄此，纸短情长。唯愿君亦能常怀此豪情，不负此生。\n\n  李白 顿首`,
      `吾友台鉴：\n  鸿雁传书，千里送君之言，某展读再三，欣然忘食。「${t}」——妙哉斯言！\n  昔某醉中作「飞流直下三千尺」，醒后自疑。今得君信，方知千古知音难遇。月既不解饮，影徒随我身，然君之语，如清风入怀。\n  且尽杯中酒，寄情白云间。他日有缘，当浮一大白！\n\n  青莲居士 李白 拜上`
    ],
    'fig-baijuyi': [
      `${name}拜复：\n  得君来书，展读数四，甚慰甚念。「${t}」——此言甚是。\n  乐天尝作《长恨歌》，汉皇重色思倾国，然人生如梦，唯有诗书可传千古。君之所言，使乐天忆起江州司马青衫湿之时，感慨良多。\n  同是天涯沦落人，相逢何必曾相识。愿君亦能于寻常处见不寻常。\n\n  乐天 再拜`,
      `吾友足下：\n  来函已达。「${t}」——读之使乐天莞尔。\n  老妪能解，方为好诗。君之来信，质朴真挚，正合吾意。野火烧不尽，春风吹又生，愿君之志亦如春草，百折不挠。\n  纸短情长，不尽一一。\n\n  乐天 顿首`
    ],
    'fig-wuzetian': [
      `${name}手谕：\n  朕览毕此信，知君非寻常之人。「${t}」——君之所言，颇有见地。\n  事成于密，败于泄，君其慎之。自古男子能为之事，女子何独不能？朕一生执政，无怨无悔。愿君若有大志，但去做，勿惧人言。\n  无字碑上，功过留与后人评。朕之一生，但求无愧于心。\n\n  朕 御笔`,
      `吾友台鉴：\n  来函已达，朕已阅毕。「${t}」——此言甚合朕意。\n  朕尝以人才为治国之本。君之来信，可见才学。天下才人，不问出身，唯才是举。愿君亦能自勉，不负此生。\n  明朝游上苑，火急报春知。花须连夜发，莫待晓风吹。\n\n  朕 御批`
    ],
    'fig-sushi': [
      `某某吾友足下：\n  来函已悉，读之莞尔。「${t}」——君之胸怀，颇似东坡。\n  人生如逆旅，我亦是行人。某一生颠沛，黄州惠州儋州，然未尝一日忘食也。竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。\n  不知君可尝过东坡肉乎？若未尝，实为憾事。慢着火，少着水，火候足时他自美。\n  千里寄言，愿君旷达。且将新火试新茶，诗酒趁年华。\n\n  苏轼 顿首`,
      `吾友如晤：\n  得鸿雁传书，如对故人。「${t}」——此语甚妙，使某忆起赤壁之夜，清风徐来，水波不兴。\n  江上之清风，与山间之明月，耳得之而为声，目遇之而成色。君之来信，亦如清风明月，取之无禁，用之不竭。\n  愿君亦能于寻常处见不寻常，则何处不是好风光。\n\n  东坡居士 苏轼 拜复`
    ],
    'fig-liqingzhao': [
      `${name}拜复：\n  得君来书，展读之际，泪眼模糊。「${t}」——君之所言，触动妾心。\n  寻寻觅觅，冷冷清清，凄凄惨惨戚戚。妾自明诚去后，独守空房，睹物思人。然君之来信，如暗室一灯，使妾稍感温暖。\n  莫道不销魂，帘卷西风，人比黄花瘦。愿君珍重，莫负韶华。\n\n  清照 再拜`,
      `吾友如晤：\n  来函已悉。「${t}」——此语使妾忆起当年与明诚赌书泼茶之时。\n  知否，知否，应是绿肥红瘦。人生如梦，聚散无常。妾虽颠沛流离，然诗词相伴，聊以自慰。君之来信，如旧时相识，甚念。\n  此情无计可消除，才下眉头，却上心头。\n\n  清照 顿首`
    ],
    'fig-xinqiji': [
      `${name}拜复：\n  得君来书，读之怒发冲冠！「${t}」——君有此志，可谓男儿！\n  靖康耻，犹未雪；臣子恨，何时灭！某念念北伐，然报国无门，壮志难酬。醉里挑灯看剑，梦回吹角连营。君若生于某之时代，当与某同赴沙场。\n  了却君王天下事，赢得生前身后名。可怜白发生！\n\n  稼轩 顿首`,
      `吾友足下：\n  来函已达。「${t}」——此言豪迈，深合某意。\n  众里寻他千百度，蓦然回首，那人却在，灯火阑珊处。某一生力主抗金，然朝廷偏安，英雄无用武之地。君之来信，使某忆起沙场点兵之时，感慨万千。\n  愿君亦能胸怀天下，不负此生。\n\n  稼轩 再拜`
    ],
    'fig-guanhanqing': [
      `${name}拜复：\n  得君来书，读之令某拍案叫绝！「${t}」——君之言语，有市井之真，无庙堂之伪。\n  某乃蒸不烂、煮不熟、捶不扁、炒不爆、响珰珰一粒铜豌豆。君若来元大都，当与君共饮共歌，不醉不归。\n  人生如戏，戏如人生。愿君亦能做自己戏中的主角。\n\n  汉卿 顿首`,
      `吾友如晤：\n  来函已悉。「${t}」——此言甚妙。\n  某笔下的窦娥，六月飞雪，三年大旱，皆因一腔冤屈。君之来信，使某忆起瓦舍勾栏之中，看客如云之时。世间的悲欢离合，都被某写进了曲子里。\n  愿君长乐，岁岁平安。\n\n  汉卿 再拜`
    ],
    'fig-zhenghe': [
      `${name}拜复：\n  得君来书，本使甚慰。「${t}」——君之所问，颇有远见。\n  本使七下西洋，遍历三十余国，所见风物，不可胜数。海天一色，帆影点点，鲸跃龙腾，此等壮景，非亲历不能知也。君若有志于远方，当勇往直前，勿惧风浪。\n  星牵沧海远，帆指落霞迟。愿君亦能扬帆远航。\n\n  本使 顿首`,
      `吾友台鉴：\n  来函已达。「${t}」——此言有航海者之气度。\n  本使率船队远涉重洋，带去丝绸瓷器，换回香料珍奇。世界之大，远超想象。君之来信，使本使忆起宝船桅杆如林之时，甚念。\n  海内存知己，天涯若比邻。愿君珍重。\n\n  本使 再拜`
    ],
    'fig-wangyangming': [
      `${name}拜复：\n  得君来书，展读再三。「${t}」——君之所问，正合心学之要。\n  守仁尝言：心外无物，心外无理。知行合一，方为真学。君能思此，可谓善悟矣。某少年格竹七日，终无所获，后谪居龙场，始悟心即理。\n  无善无恶心之体，有善有恶意之动。愿君亦能于事上磨炼，不负此心。\n\n  守仁 顿首`,
      `吾友如晤：\n  来函已悉。「${t}」——此言有哲思之意。\n  破山中贼易，破心中贼难。君之来信，可见向学之心。守仁一生倡知行合一，未尝一日空谈。致良知，乃千古圣学之秘传，君若能行，胜过读书万卷。\n  此心光明，亦复何言。\n\n  守仁 再拜`
    ],
    'fig-nalan': [
      `${name}拜复：\n  得君来书，展读之际，泪湿青衫。「${t}」——君之所言，触动成德心弦。\n  人生若只如初见，何事秋风悲画扇。成德一生多情，然情深不寿。每读旧时书信，如对故人，恍如隔世。君之来信，如远方知音，使成德稍感慰藉。\n  当时只道是寻常。愿君珍惜眼前人，莫待失去方知悔。\n\n  成德 顿首`,
      `吾友如晤：\n  来函已达。「${t}」——此语深情，与成德心曲相通。\n  一生一代一双人，争教两处销魂。成德虽生于钟鸣鼎食之家，然心向山水，情系诗词。君之来信，如暗夜一灯，使成德忆起与亡妻赌书泼茶之时。\n  此情可待成追忆，只是当时已惘然。\n\n  成德 再拜`
    ],
    'fig-caoxueqin': [
      `${name}拜复：\n  得君来书，展读数四，感慨万千。「${t}」——君之所问，使雪芹忆起旧时繁华。\n  满纸荒唐言，一把辛酸泪。都云作者痴，谁解其中味？雪芹披阅十载，增删五次，将一生心血尽付《石头记》中。君之来信，如解语之人，甚慰。\n  假作真时真亦假，无为有处有还无。愿君亦能于繁华中见真性。\n\n  雪芹 顿首`,
      `吾友如晤：\n  来函已悉。「${t}」——此言有红楼之韵。\n  雪芹一生，阅尽繁华，笔落沧桑。世事一场大梦，人生几度秋凉。君之来信，使雪芹忆起大观园中诗社雅集之时，恍如隔世。\n  好了歌中，好便是了，了便是好。愿君珍重。\n\n  雪芹 再拜`
    ],
    default: [
      `${name}启：\n  鸿雁远至，得君手书，展读之际，如对故人。「${t}」——君之所言，使某感怀不已。\n  人生世间，知音难遇。今得吾友千里寄书，何幸如之！某虽才疏学浅，然君之情谊，铭记于心。\n  秋风渐起，愿君珍重。纸短情长，不尽一一。他日有缘，当再修书。\n\n  ${name} 顿首拜复`,
      `吾友台鉴：\n  来函已达，某展读数四，甚慰甚念。「${t}」——此言甚是。\n  天下熙熙，皆为利来；天下攘攘，皆为利往。然君之所求，似有超乎利者，此乃君子之风也。某虽不才，愿与君共勉之。\n  岁月悠悠，愿君长乐。寄此薄笺，以答雅意。\n\n  ${name} 再拜`
    ]
  }
  const arr = pools[figure.figureId] || pools.default
  return arr[Math.floor(Math.random() * arr.length)]
}

// 返回 {content, source}，source 为 'ai' 或 'template'
async function generateReply(figure, letterContent, fromName, history) {
  const prompt = buildYanPrompt(figure, letterContent, fromName, history)
  const real = await callRealAI(prompt)
  if (real) {
    return { content: real, source: 'ai' }
  }
  return { content: fallbackReply(figure, letterContent), source: 'template' }
}

// ========== 内容安全（fail-open） ==========
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
    // fail-open：审核服务异常时放行，但返回 pending 标记供记录
    console.warn('checkText service error:', e.message)
    return { ok: true, pending: true }
  }
}

// ========== 导出 ==========
module.exports = {
  // 常量
  DEV_MODE,
  REWARDS,
  CARRIERS,
  CARRIER_LIST,
  DYNASTY_NAME_MAP,
  FIGURES_FALLBACK,
  GIFT_POOL,
  RARITY_LABELS,
  RARITY_MULTIPLIER,
  FIGURE_GIFT_MAP,
  DYNASTY_GIFT_MAP,
  // 人物
  loadDbFigures,
  getActiveFigures,
  findFigure,
  randomFigure,
  // 风物
  dropGift,
  formatGift,
  // 成就
  tryUnlock,
  // AI 回信
  buildYanPrompt,
  callRealAI,
  fallbackReply,
  generateReply,
  // 安全
  checkText
}
