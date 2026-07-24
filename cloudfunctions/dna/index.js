const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const QUESTIONS = [
  {
    _id: 'q1', question: '面对危局，你第一反应是？',
    options: [
      { k: 'A', text: '拔剑而起，怒而抗之', scores: {勇:3,谋:0,情:1,仕:1,隐:0}},
      { k: 'B', text: '深谋远虑，静待时机', scores: {勇:1,谋:3,情:0,仕:1,隐:0}},
      { k: 'C', text: '弃局而走，明哲保身', scores: {勇:0,谋:1,情:0,仕:0,隐:3}},
      { k: 'D', text: '含泪悲叹，感叹命运', scores: {勇:0,谋:0,情:3,仕:0,隐:1}}
    ]
  },
  {
    _id: 'q2', question: '若千金散去，你会？',
    options: [
      { k: 'A', text: '千金散尽还复来！', scores: {勇:2,谋:0,情:1,仕:0,隐:2}},
      { k: 'B', text: '广结朋友，以谋后用', scores: {勇:1,谋:2,情:0,仕:2,隐:0}},
      { k: 'C', text: '节俭度日，积累再起', scores: {勇:0,谋:2,情:0,仕:1,隐:1}},
      { k: 'D', text: '与妻儿粗茶淡饭', scores: {勇:0,谋:0,情:2,仕:0,隐:3}}
    ]
  },
  {
    _id: 'q3', question: '你认为人生最高的追求是？',
    options: [
      { k: 'A', text: '建功立业，名垂青史', scores: {勇:2,谋:2,情:0,仕:3,隐:0}},
      { k: 'B', text: '文章千古，著书立说', scores: {勇:0,谋:2,情:2,仕:1,隐:2}},
      { k: 'C', text: '自在逍遥，遨游天地', scores: {勇:2,谋:0,情:1,仕:0,隐:3}},
      { k: 'D', text: '家人安康，岁月静好', scores: {勇:0,谋:0,情:3,仕:0,隐:2}}
    ]
  },
  {
    _id: 'q4', question: '若你为君，面对忠言逆耳，你？',
    options: [
      { k: 'A', text: '怒而斥之，有损天威', scores: {勇:2,谋:0,情:1,仕:1,隐:0}},
      { k: 'B', text: '深思熟虑，察纳雅言', scores: {勇:1,谋:3,情:0,仕:3,隐:0}},
      { k: 'C', text: '表面接受，实则不改', scores: {勇:0,谋:2,情:0,仕:2,隐:0}},
      { k: 'D', text: '唉，君位实在无趣', scores: {勇:0,谋:1,情:1,仕:0,隐:2}}
    ]
  },
  {
    _id: 'q5', question: '知己将远行，你？',
    options: [
      { k: 'A', text: '执手相看泪眼', scores: {勇:0,谋:0,情:3,仕:0,隐:1}},
      { k: 'B', text: '大醉三日，唱彻阳关', scores: {勇:1,谋:0,情:2,仕:0,隐:2}},
      { k: 'C', text: '赠信物，以图后会', scores: {勇:0,谋:2,情:2,仕:1,隐:0}},
      { k: 'D', text: '君子之交淡如水', scores: {勇:0,谋:1,情:1,仕:0,隐:2}}
    ]
  }
]

const RESULTS = [
  { code: 'libai', title: '李白式浪漫', desc: '天生我材必有用，千金散尽还复来。你如诗仙般豪放不羁，爱美酒，爱山水，爱自由。', tips: '适合：诗歌、游历、交友。当心：过度理想化易受挫。'},
  { code: 'sushi', title: '苏轼式旷达', desc: '一蓑烟雨任平生。你乐观坚韧，才情横溢，即使身处逆境也能发现生活之美。', tips: '适合：文学、艺术、治理。当心：直言不讳易招妒。'},
  { code: 'xiangyu', title: '项羽式豪情', desc: '力拔山兮气盖世！你勇猛果决，重情重义，是天生的领袖，但有时也过于骄傲。', tips: '适合：冲锋陷阵、担当大任。当心：刚愎自用易失人心。'},
  { code: 'caocao', title: '曹操式枭雄', desc: '宁教我负天下人，休教天下人负我。你深谋远虑，胸有大志，能屈能伸。', tips: '适合：领导、谋略、创业。当心：多疑错失良机。'},
  { code: 'wuzetian', title: '武则天式权谋', desc: '功过留待后人评。你意志坚定，手段高明，能在复杂局面中掌控全局。', tips: '适合：高层管理、政治。当心：高处不胜寒。'},
  { code: 'mulan', title: '花木兰式孝义', desc: '谁说女子不如男！你孝顺坚毅，有勇有谋，为家人甘愿赴险。', tips: '适合：家庭担当、保家卫国。当心：过度逞强累坏自己。'}
]

const MEMORIALS = [
  {
    _id: 'm1',
    title: '请削藩封疏',
    submitter: '晁错',
    dynasty: '西汉',
    content: '诸侯连城数十，地方千里，缓则骄奢易为淫乱，急则阻其强而合从以逆京师。今削之亦反，不削之亦反。削之，其反亟，祸小；不削，反迟，祸大。\n\n伏望陛下审时度势，早决断，无贻后患。臣昧死上言。',
    background: '汉初诸侯坐大，已成尾大不掉之势。',
    options: [
      { k: '准', text: '准奏，即刻削藩', consequence: '引发七国之乱，地方震动', score: {稳:-2,威:3,名:1,民:-1} },
      { k: '缓', text: '缓行，先试探之', consequence: '暂获安宁，但诸侯日强', score: {稳:1,威:-1,名:0,民:1} },
      { k: '推恩', text: '令诸侯分封子弟（推恩令）', consequence: '诸侯自弱，渐归中央', score: {稳:3,威:2,名:2,民:1} },
      { k: '驳', text: '驳回，晁错危言耸听', consequence: '诸侯益强，他日必反', score: {稳:-1,威:-2,名:-1,民:0} }
    ]
  },
  {
    _id: 'm2',
    title: '谏太宗十思疏',
    submitter: '魏徵',
    dynasty: '唐',
    content: '臣闻求木之长者，必固其根本；欲流之远者，必浚其泉源；思国之安者，必积其德义。源不深而望流之远，根不固而求木之长，德不厚而思国之安，臣虽下愚，知其不可，而况于明哲乎？\n\n人君当神器之重，居域中之大，将崇极天之峻，永保无疆之休。不念居安思危，戒奢以俭，斯亦伐根以求木茂，塞源而欲流长也。',
    background: '贞观之治，太宗渐好奢华，魏徵上此疏以谏。',
    options: [
      { k: '赞', text: '深以为然，赐绢嘉奖', consequence: '君臣相得，贞观之风益盛', score: {稳:3,威:1,名:3,民:2} },
      { k: '纳', text: '纳其言但不赏', consequence: '言路渐开，人心稍平', score: {稳:2,威:0,名:1,民:1} },
      { k: '怒', text: '岂敢讥朕！欲杀之', consequence: '直臣缄口，盛世将衰', score: {稳:-2,威:2,名:-3,民:-1} },
      { k: '置', text: '置之不理，我行我素', consequence: '积弊渐生，隐患埋下', score: {稳:-1,威:0,名:-1,民:0} }
    ]
  },
  {
    _id: 'm3',
    title: '出师表',
    submitter: '诸葛亮',
    dynasty: '三国·蜀',
    content: '臣本布衣，躬耕于南阳，苟全性命于乱世，不求闻达于诸侯。先帝不以臣卑鄙，猥自枉屈，三顾臣于草庐之中，咨臣以当世之事，由是感激，遂许先帝以驱驰。后值倾覆，受任于败军之际，奉命于危难之间：尔来二十有一年矣。\n\n今南方已定，兵甲已足，当奖率三军，北定中原，庶竭驽钝，攘除奸凶，兴复汉室，还于旧都。此臣所以报先帝而忠陛下之职分也。',
    background: '蜀汉建兴五年，诸葛亮率师北伐，上此表于后主刘禅。',
    options: [
      { k: '准', text: '恩准，全力支持北伐', consequence: '六出祁山，鞠躬尽瘁', score: {稳:1,威:2,名:3,民:-1} },
      { k: '缓', text: '请先休养三年再议', consequence: '国力渐丰，但北伐良机或失', score: {稳:2,威:-1,名:0,民:2} },
      { k: '阻', text: '反对北伐，安境保民', consequence: '偏安一隅，蜀汉无大事', score: {稳:2,威:-2,名:-1,民:2} },
      { k: '疑', text: '丞相握重兵在外，令人忧', consequence: '君臣猜疑，国事日非', score: {稳:-3,威:-1,名:-2,民:-1} }
    ]
  }
]

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action, data = {} } = event
  try {
    switch (action) {
      case 'dna-getQuestions': return { code: 0, message: 'ok', data: QUESTIONS }
      case 'dna-submit': return await dnaSubmit(OPENID, data)
      case 'dna-result': return await dnaResult(OPENID, data)
      case 'memorial-list': return { code: 0, message: 'ok', data: MEMORIALS.map(m => ({_id: m._id, title: m.title, submitter: m.submitter, dynasty: m.dynasty, background: m.background})) }
      case 'memorial-get': return await memorialGet(OPENID, data)
      case 'memorial-decide': return await memorialDecide(OPENID, data)
      case 'memorial-history': return await memorialHistory(OPENID, data)
      default: return { code: -1, message: '未知 action: ' + action }
    }
  } catch (e) {
    console.error('dna/memorial err:', e)
    return { code: -1, message: e.message || '服务异常' }
  }
}

async function dnaSubmit(OPENID, data) {
  const answers = data.answers || []
  if (!answers.length) return { code: -1, message: '请回答问题' }
  const scores = {勇:0,谋:0,情:0,仕:0,隐:0}
  for (const a of answers) {
    const q = QUESTIONS.find(q => q._id === a.q)
    if (!q) continue
    const opt = q.options.find(o => o.k === a.a)
    if (!opt) continue
    for (const k of Object.keys(scores)) scores[k] += (opt.scores[k] || 0)
  }
  const maxKey = Object.entries(scores).sort((a,b) => b[1]-a[1])[0][0]
  const result = RESULTS[Math.floor(Math.random() * RESULTS.length)] || RESULTS[0]
  const doc = {
    result,
    scores,
    answers,
    createdAt: db.serverDate()
  }
  let _id
  try {
    const saved = await db.collection('dna_results').add({ data: doc })
    _id = saved._id
  } catch (e) { _id = 'mock_' + Date.now() }
  return { code: 0, message: 'ok', data: { ...doc, _id } }
}

async function dnaResult(OPENID, data) {
  const { _id, last = true } = data
  if (last) {
    const r = await db.collection('dna_results')
      .where({ _openid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()
    return { code: 0, message: 'ok', data: r.data[0] || null }
  }
  if (!_id) return { code: -1, message: '缺少 _id' }
  const r = await db.collection('dna_results').doc(_id).get()
  return { code: 0, message: 'ok', data: r.data || null }
}

async function memorialGet(OPENID, data) {
  const { _id } = data
  const m = MEMORIALS.find(x => x._id === _id)
  if (!m) return { code: -1, message: '奏折不存在' }
  return { code: 0, message: 'ok', data: m }
}

async function memorialDecide(OPENID, data) {
  const { memorialId, optionK } = data
  if (!memorialId || !optionK) return { code: -1, message: '参数不全' }
  const m = MEMORIALS.find(x => x._id === memorialId)
  if (!m) return { code: -1, message: '奏折不存在' }
  const opt = m.options.find(o => o.k === optionK)
  if (!opt) return { code: -1, message: '选项错误' }

  const doc = {
    memorialId,
    title: m.title,
    submitter: m.submitter,
    dynasty: m.dynasty,
    optionK,
    optionText: opt.text,
    consequence: opt.consequence,
    score: opt.score,
    createdAt: db.serverDate()
  }
  let _id = 'mock_' + Date.now()
  try {
    const r = await db.collection('memorial_answers').add({ data: doc })
    _id = r._id
  } catch (_) {}
  return { code: 0, message: 'ok', data: { ...doc, _id } }
}

async function memorialHistory(OPENID, data) {
  const { limit = 20 } = data
  const r = await db.collection('memorial_answers')
    .where({ _openid: OPENID })
    .orderBy('createdAt', 'desc')
    .limit(Math.min(limit, 50))
    .get()
  return { code: 0, message: 'ok', data: r.data }
}
