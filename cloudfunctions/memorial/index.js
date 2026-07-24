const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const MEMORIAL_SEED = [
  {
    _id: 'm1',
    chapter: '大汉篇',
    dynasty: 'han',
    title: '请削藩封疏',
    submitter: '晁错',
    background: '汉初诸侯连城数十，尾大不掉。文帝宽仁，诸侯坐大。景帝即位，晁错上《削藩策》。',
    content: '诸侯连城数十，地方千里，缓则骄奢易为淫乱，急则阻其强而合从以逆京师。今削之亦反，不削之亦反。削之，其反亟，祸小；不削，反迟，祸大。\n\n伏望陛下审时度势，早决断，无贻后患。臣昧死上言。',
    options: [
      { key: 'A', text: '准奏，即刻削藩', hint: '先发制人，雷厉风行', consequence: '吴楚七国以"清君侧诛晁错"为名举兵西进，朝野震动；然叛军势大，梁都睢阳被围三月。', score: {稳: -2,威: 3,名: 1,民: -1} },
      { key: 'B', text: '缓行，先试探之', hint: '徐徐图之，避免激变', consequence: '诸侯察觉中央之意，秘密串联，数年之后实力更甚，他日必反。', score: {稳: 1,威: -1,名: 0,民: 1} },
      { key: 'C', text: '令诸侯分封子弟（推恩令）', hint: '分化瓦解，不战而屈', consequence: '诸侯之国越分越小，齐分为七，赵分为六，梁分为五，淮南分为三，中央渐强。', score: {稳: 3,威: 2,名: 2,民: 1} },
      { key: 'D', text: '驳回，晁错危言耸听', hint: '维持现状，无为而治', consequence: '吴王刘濞私铸钱币、煮海水为盐，招天下亡命，日益坐大。', score: {稳: -1,威: -2,名: -1,民: 0} }
    ],
    historicalOutcome: '真实历史：景帝纳晁错削藩策，削吴会稽、豫章二郡，吴王刘濞遂联合楚赵等七国反，史称"七国之乱"。周亚夫率三十六将军击之，三月而定。后武帝行推恩令，诸侯之患终解。',
    order: 1,
    prerequisites: []
  },
  {
    _id: 'm2',
    chapter: '贞观篇',
    dynasty: 'tang',
    title: '谏太宗十思疏',
    submitter: '魏徵',
    background: '贞观之治中期，海内升平，太宗渐好奢靡，大修宫殿，亲征高丽。魏徵以此疏极谏。',
    content: '臣闻求木之长者，必固其根本；欲流之远者，必浚其泉源；思国之安者，必积其德义。源不深而望流之远，根不固而求木之长，德不厚而思国之安，臣虽下愚，知其不可，而况于明哲乎？\n\n人君当神器之重，居域中之大，将崇极天之峻，永保无疆之休。不念居安思危，戒奢以俭，斯亦伐根以求木茂，塞源而欲流长也。',
    options: [
      { key: 'A', text: '深以为然，赐绢五百匹嘉奖', hint: '虚心纳谏，赏直臣', consequence: '魏徵益敢言，房玄龄杜如晦等贤相毕集，天下大治，贞观之风，至今歌咏。', score: {稳: 3,威: 1,名: 3,民: 2} },
      { key: 'B', text: '纳其言但不赏', hint: '用其言，不示恩', consequence: '谏臣知上能用言，仍愿尽节；然言路渐开，人心稍平。', score: {稳: 2,威: 0,名: 1,民: 1} },
      { key: 'C', text: '震怒：田舍翁！欲杀之', hint: '斥退直臣，立威', consequence: '长孙皇后劝谏，帝虽纳，然魏徵等直臣缄口。此后谏者日稀，隐患已埋。', score: {稳: -2,威: 2,名: -3,民: -1} },
      { key: 'D', text: '置之不理，我行我素', hint: '按既定方针办', consequence: '征辽东徭役日重，百姓疲弊，蜀中獠反，日后几成祸乱。', score: {稳: -1,威: 0,名: -1,民: 0} }
    ],
    historicalOutcome: '真实历史：太宗览之，赐绢五百匹，尝曰"以铜为镜可以正衣冠，以古为镜可以知兴替，以人为镜可以明得失。"魏徵殁，帝叹曰："朕亡一镜矣！"',
    order: 2,
    prerequisites: []
  },
  {
    _id: 'm3',
    chapter: '三国篇',
    dynasty: 'sanguo',
    title: '出师表',
    submitter: '诸葛亮',
    background: '蜀汉建兴五年，诸葛亮南征已毕，南方已定，兵甲已足，欲率诸军北驻汉中，临发，上此表。',
    content: '臣本布衣，躬耕于南阳，苟全性命于乱世，不求闻达于诸侯。先帝不以臣卑鄙，猥自枉屈，三顾臣于草庐之中，咨臣以当世之事，由是感激，遂许先帝以驱驰。后值倾覆，受任于败军之际，奉命于危难之间：尔来二十有一年矣。\n\n今南方已定，兵甲已足，当奖率三军，北定中原，庶竭驽钝，攘除奸凶，兴复汉室，还于旧都。此臣所以报先帝而忠陛下之职分也。',
    options: [
      { key: 'A', text: '恩准，举国之力北伐', hint: '六出祁山，以攻代守', consequence: '诸葛武侯六出祁山，斩张郃、败司马懿，然粮尽而还；终星落五丈原，鞠躬尽瘁死而后已。', score: {稳: 1,威: 2,名: 3,民: -1} },
      { key: 'B', text: '请先休养三年再议', hint: '务农殖谷，闭境养民', consequence: '国力渐丰，然魏得关中，屯田日久，日后北伐更难。然蜀人得安。', score: {稳: 2,威: -1,名: 0,民: 2} },
      { key: 'C', text: '不准北伐，保境安民', hint: '偏安一隅', consequence: '蜀汉闭关自守，以一州之地抗九州之魏，人才日衰，谯周等主降派渐成。', score: {稳: 2,威: -2,名: -1,民: 2} },
      { key: 'D', text: '丞相握重兵在外，黄皓当制之', hint: '分权制衡', consequence: '君臣猜疑，诸葛瞻、姜维不睦，黄皓用事，国政日非，汉中不守。', score: {稳: -3,威: -1,名: -2,民: -1} }
    ],
    historicalOutcome: '真实历史：后主准奏。孔明五伐中原未果，建兴十二年秋八月，卒于五丈原，年五十四。姜维继志北伐，终不克。炎兴元年，邓艾偷渡阴平，刘禅出降，蜀汉亡。',
    order: 3,
    prerequisites: []
  },
  {
    _id: 'm4',
    chapter: '大汉篇',
    dynasty: 'han',
    title: '韩信请封齐王奏',
    submitter: '韩信',
    background: '汉四年，韩信平齐，拥兵三十万于齐，而楚方急围汉王于荥阳。韩信使人言汉王曰："齐伪诈多变，反覆之国也，南边楚，不为假王以镇之，其势不定。原为假王便。"',
    content: '齐地反复，非假王不可镇抚。信虽不才，愿以王之威镇齐，绝楚之右臂，断项王之粮道。此事急，伏望陛下察之。',
    options: [
      { key: 'A', text: '大怒，斥来使：吾困于此，旦暮望若来佐我，乃欲自立为王！', hint: '怒而斥之', consequence: '张良、陈平蹑汉王足，附耳语："汉方不利，宁能禁信之王乎？"王悟，因复骂曰："大丈夫定诸侯，即为真王耳，何以假为！"', score: {稳: -1,威: 2,名: -1,民: 0} },
      { key: 'B', text: '即立韩信为真齐王，征其兵击楚', hint: '顺其势，用其力', consequence: '信得王，大喜，遂遣灌婴击彭城，龙且二十万楚军没于潍水，项王大恐，使武涉说信反，信不听。', score: {稳: 2,威: 1,名: 2,民: 1} },
      { key: 'C', text: '只封假王，再观其变', hint: '缓兵之计', consequence: '信虽受命，心中怏怏；蒯通说之曰"勇略震主者身危，而功盖天下者不赏"，信心动，然犹豫不忍倍汉。', score: {稳: -1,威: 1,名: 0,民: -1} },
      { key: 'D', text: '不许，召其入荥阳议事', hint: '夺其军权', consequence: '信使亡楚，三分天下鼎足而王之；楚汉久相持未决，天下苦之。', score: {稳: -3,威: -2,名: -2,民: -2} }
    ],
    historicalOutcome: '真实历史：汉王初怒，张良蹑足而悟，立韩信为齐王，征其兵会垓下。项羽死，高祖袭夺齐王军，徙信为楚王，再贬淮阴侯，后吕后与萧何诛信于长乐钟室，夷三族。',
    order: 4,
    prerequisites: []
  }
]

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action, data = {} } = event

  try {
    switch (action) {
      case 'list': return await listMemorials(data)
      case 'detail': return await getDetail(data)
      case 'decide': return await decide(OPENID, data)
      case 'simulate': return await simulate(OPENID, data)
      case 'history': return await history(OPENID, data)
      case 'progress': return await progress(OPENID, data)
      default: return { code: -1, message: '未知 memorial action: ' + action }
    }
  } catch (e) {
    console.error('memorial err:', e)
    return { code: -1, message: e.message || '奏折服务异常' }
  }
}

async function listMemorials(data) {
  const { chapter = '', dynasty = '', unlockedOnly = false, limit = 20 } = data
  let rows = MEMORIAL_SEED
  if (chapter) rows = rows.filter(r => r.chapter === chapter)
  if (dynasty) rows = rows.filter(r => r.dynasty === dynasty)
  rows = rows.sort((a, b) => a.order - b.order).slice(0, Math.min(limit, 50))
  return {
    code: 0, message: 'ok',
    data: rows.map(r => ({
      _id: r._id, title: r.title, submitter: r.submitter,
      dynasty: r.dynasty, chapter: r.chapter,
      background: r.background, order: r.order,
      prerequisites: r.prerequisites
    }))
  }
}

async function getDetail(data) {
  const { _id } = data
  if (!_id) return { code: -1, message: '缺少 _id' }
  const m = MEMORIAL_SEED.find(x => x._id === _id)
  if (!m) return { code: -1, message: '奏折不存在' }
  return { code: 0, message: 'ok', data: m }
}

async function decide(OPENID, data) {
  const { memorialId, optionKey } = data
  if (!memorialId || !optionKey) return { code: -1, message: '参数不全' }
  const m = MEMORIAL_SEED.find(x => x._id === memorialId)
  if (!m) return { code: -1, message: '奏折不存在' }
  const opt = m.options.find(o => o.key === optionKey)
  if (!opt) return { code: -1, message: '选项错误' }

  const doc = {
    memorialId,
    memorialTitle: m.title,
    submitter: m.submitter,
    dynasty: m.dynasty,
    optionKey,
    optionText: opt.text,
    hint: opt.hint,
    consequence: opt.consequence,
    score: opt.score,
    createdAt: db.serverDate()
  }
  let _id
  try {
    const saved = await db.collection('memorial_answers').add({ data: doc })
    _id = saved._id
  } catch (e) {
    _id = 'm_ans_' + Date.now()
  }

  try {
    const exists = await db.collection('user_memorial_progress')
      .where({ _openid: OPENID, memorialId }).count()
    if (exists.total === 0) {
      await db.collection('user_memorial_progress').add({
        data: { memorialId, completedAt: db.serverDate(), score: opt.score }
      })
    }
  } catch (_) {}

  return {
    code: 0, message: 'ok',
    data: {
      _id,
      ...doc,
      historicalOutcome: m.historicalOutcome,
      zhupi: buildZhupi(m, opt)
    }
  }
}

function buildZhupi(m, opt) {
  const k = opt.key
  const praise = ['知道了，朕准奏。', '所言极是，依议施行。', '朕深思熟虑，嘉卿此策。', '留中不发……再思。']
  const idx = { A: 0, B: 1, C: 2, D: 3 }[k] || 0
  return `朱批：${praise[idx]}\n\n——《${m.chapter ? m.chapter : '奏折'}·${m.title}》`
}

async function simulate(OPENID, data) {
  const { memorialId, decision, scenario = '三个月后' } = data
  if (!memorialId || !decision) return { code: -1, message: '参数不全' }
  const m = MEMORIAL_SEED.find(x => x._id === memorialId)
  if (!m) return { code: -1, message: '奏折不存在' }

  const mock = buildSimulate(m, decision, scenario)
  try {
    await db.collection('memorial_simulations').add({
      data: { memorialId, decision, scenario, result: mock, createdAt: db.serverDate() }
    })
  } catch (_) {}
  return { code: 0, message: 'ok', data: mock }
}

function buildSimulate(m, decision, scenario) {
  const base = {
    scenario,
    months: [
      { month: '第一个月', summary: '诏令下，朝野震动。' + (decision.A ? '有司速办，诸侯怨望。' : '公卿议论纷纷。') },
      { month: '第三个月', summary: '时局演进。' + (['B','C'].includes(decision) ? '制度已立，初显成效。' : '矛盾激化，暗流涌动。') },
      { month: '第十二个月', summary: '年末复盘。' + (decision === 'C' ? '国家大治，户口岁增，太史公书而赞之。' : '功过参半，待后世评说。') }
    ],
    newMemorial: {
      _id: 'sim_' + m._id + '_' + Date.now(),
      title: '后续：' + m.title,
      submitter: '朝中议郎',
      content: '伏惟陛下前断英明，臣等不胜惶恐。今有所陈，愿陛下垂听……'
    }
  }
  return base
}

async function history(OPENID, data) {
  const { limit = 20 } = data
  try {
    const r = await db.collection('memorial_answers')
      .where({ _openid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(Math.min(limit, 50))
      .get()
    return { code: 0, message: 'ok', data: r.data }
  } catch (e) {
    return { code: 0, message: 'ok(fallback)', data: [] }
  }
}

async function progress(OPENID, data) {
  try {
    const r = await db.collection('user_memorial_progress').where({ _openid: OPENID }).get()
    const completedIds = r.data.map(p => p.memorialId)
    const total = MEMORIAL_SEED.length
    return {
      code: 0, message: 'ok',
      data: {
        completed: completedIds.length,
        total,
        completedIds,
        chapters: [...new Set(MEMORIAL_SEED.map(m => m.chapter))]
      }
    }
  } catch (e) {
    return { code: 0, message: 'ok(fallback)', data: { completed: 0, total: MEMORIAL_SEED.length, completedIds: [] } }
  }
}
