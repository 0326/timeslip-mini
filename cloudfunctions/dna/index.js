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
    const REWARDS = { first_chat: 10, first_letter: 10, first_like: 5, dna_done: 20, chat_10: 30, chat_50: 80, letter_5: 50, comment_10: 30, first_memorial: 20, memorial_5: 80, figure_10: 60, read_book: 15, all_dynasties: 200, collector: 500, time_master: 1000 }
    const reward = REWARDS[key] || 0
    achievements.push({ key, unlockedAt: new Date() })
    await db.collection('users').doc(user._id).update({
      data: { achievements, points: db.command.inc(reward), updatedAt: db.serverDate() }
    })
  } catch (e) { console.warn('tryUnlock fail', key, e.message) }
}

// 封面图云文件 ID（已上传到云存储）
const COVER_FILE_IDS = {
  emperor: 'cloud://cloud1-d0gunpzup215cfd87.636c-cloud1-d0gunpzup215cfd87-1457646459/dna-covers/emperor.jpg',
  poet: 'cloud://cloud1-d0gunpzup215cfd87.636c-cloud1-d0gunpzup215cfd87-1457646459/dna-covers/poet.jpg',
  general: 'cloud://cloud1-d0gunpzup215cfd87.636c-cloud1-d0gunpzup215cfd87-1457646459/dna-covers/general.jpg'
}

// ============================================================
// 种子数据：3 个测试（emperor / poet / general）
// 首次调用 quiz-list 时幂等 upsert 到数据库
// ============================================================

const SEED_QUIZZES = [
  {
    id: 'emperor',
    title: '测测你更像哪位皇帝？',
    subtitle: '龙椅之上，谁与你同频',
    desc: '8 道题测出你的帝王人格，是雄才大略还是守成之主？',
    cover: COVER_FILE_IDS.emperor,
    icon: '',
    themeColor: '#B71C1C',
    questionsCount: 8,
    dimOrder: [
      { value: 'L', name: '谋略', model: '帝王之智' },
      { value: 'P', name: '魄力', model: '帝王之断' },
      { value: 'W', name: '文采', model: '帝王之文' },
      { value: 'R', name: '隐忍', model: '帝王之忍' },
      { value: 'D', name: '果断', model: '帝王之决' },
      { value: 'T', name: '包容', model: '帝王之度' }
    ],
    category: 'emperor',
    order: 1
  },
  {
    id: 'poet',
    title: '测测你更像哪位诗人？',
    subtitle: '诗酒风流，谁执你笔',
    desc: '6 道题测出你的诗魂归属，是豪放旷达还是婉约深情？',
    cover: COVER_FILE_IDS.poet,
    icon: '',
    themeColor: '#1E90FF',
    questionsCount: 6,
    dimOrder: [
      { value: 'T', name: '才情', model: '诗心' },
      { value: 'H', name: '豪放', model: '诗骨' },
      { value: 'W', name: '婉约', model: '诗韵' },
      { value: 'K', name: '旷达', model: '诗怀' },
      { value: 'R', name: '浪漫', model: '诗魂' }
    ],
    category: 'poet',
    order: 2
  },
  {
    id: 'general',
    title: '测测你更像哪位武将？',
    subtitle: '金戈铁马，谁与你同袍',
    desc: '8 道题测出你的武将人格，是运筹帷幄还是冲锋陷阵？',
    cover: COVER_FILE_IDS.general,
    icon: '',
    themeColor: '#2F4F4F',
    questionsCount: 8,
    dimOrder: [
      { value: 'Y', name: '勇', model: '武勇' },
      { value: 'M', name: '谋', model: '武谋' },
      { value: 'Z', name: '忠', model: '武忠' },
      { value: 'I', name: '义', model: '武义' },
      { value: 'L', name: '烈', model: '武烈' },
      { value: 'S', name: '稳', model: '武稳' }
    ],
    category: 'general',
    order: 3
  }
]

const SEED_QUESTIONS = {
  emperor: [
    { order: 1, text: '面对朝堂上激烈的党争，你会：', dim: 'L',
      options: [
        { label: 'A', text: '离间两派，使其互相牵制', dimValue: 3 },
        { label: 'B', text: '直接下令处置为首者', dimValue: 1 },
        { label: 'C', text: '广纳谏言，徐图良策', dimValue: 2 },
        { label: 'D', text: '佯装不知，暗中观察', dimValue: 2 }
      ]},
    { order: 2, text: '边疆告急，敌军压境，你的第一反应是：', dim: 'D',
      options: [
        { label: 'A', text: '即刻御驾亲征，振军心', dimValue: 3 },
        { label: 'B', text: '召集老臣，议定良策', dimValue: 1 },
        { label: 'C', text: '遣使议和，先稳局势', dimValue: 2 },
        { label: 'D', text: '坚壁清野，以待其变', dimValue: 2 }
      ]},
    { order: 3, text: '功高震主的老臣，你如何处置：', dim: 'R',
      options: [
        { label: 'A', text: '杯酒释兵权，给其富贵', dimValue: 3 },
        { label: 'B', text: '罗织罪名，斩草除根', dimValue: 1 },
        { label: 'C', text: '委以虚职，留京监视', dimValue: 2 },
        { label: 'D', text: '继续重用，以诚相待', dimValue: 1 }
      ]},
    { order: 4, text: '面对谏臣的犯颜直谏，你：', dim: 'T',
      options: [
        { label: 'A', text: '虚心纳谏，赏赐之', dimValue: 3 },
        { label: 'B', text: '表面接受，内心不悦', dimValue: 2 },
        { label: 'C', text: '怒斥其无礼', dimValue: 1 },
        { label: 'D', text: '比干剖心，杀一儆百', dimValue: 1 }
      ]},
    { order: 5, text: '国库空虚，你倾向：', dim: 'P',
      options: [
        { label: 'A', text: '改革税制，开源节流', dimValue: 3 },
        { label: 'B', text: '加派商税，充盈内帑', dimValue: 2 },
        { label: 'C', text: '削减皇室用度，与民休息', dimValue: 2 },
        { label: 'D', text: '发兵掠夺邻国', dimValue: 1 }
      ]},
    { order: 6, text: '夜深独处，你最常做的事是：', dim: 'W',
      options: [
        { label: 'A', text: '秉烛批阅奏章', dimValue: 2 },
        { label: 'B', text: '挥毫赋诗，抒发胸臆', dimValue: 3 },
        { label: 'C', text: '与近侍对弈', dimValue: 1 },
        { label: 'D', text: '翻阅兵书地志', dimValue: 2 }
      ]},
    { order: 7, text: '即位之初，根基未稳，你会：', dim: 'R',
      options: [
        { label: 'A', text: '韬光养晦，徐徐图之', dimValue: 3 },
        { label: 'B', text: '大刀阔斧，立威除弊', dimValue: 1 },
        { label: 'C', text: '拉拢老臣，稳固班底', dimValue: 2 },
        { label: 'D', text: '广施恩惠，收买人心', dimValue: 2 }
      ]},
    { order: 8, text: '后世史官如何评价你，你最在意：', dim: 'W',
      options: [
        { label: 'A', text: '文治武功，千古一帝', dimValue: 2 },
        { label: 'B', text: '诗书风流，文采斐然', dimValue: 3 },
        { label: 'C', text: '开疆拓土，威震四方', dimValue: 2 },
        { label: 'D', text: '仁政爱民，海晏河清', dimValue: 2 }
      ]}
  ],
  poet: [
    { order: 1, text: '月下独酌，你最想：', dim: 'R',
      options: [
        { label: 'A', text: '举杯邀明月，对影成三人', dimValue: 3 },
        { label: 'B', text: '提笔写下一首感怀诗', dimValue: 2 },
        { label: 'C', text: '思念远方故人', dimValue: 1 },
        { label: 'D', text: '醉卧花间，不知东方既白', dimValue: 2 }
      ]},
    { order: 2, text: '面对壮丽山河，你的第一反应是：', dim: 'H',
      options: [
        { label: 'A', text: '飞流直下三千尺！', dimValue: 3 },
        { label: 'B', text: '江山如画，一时多少豪杰', dimValue: 2 },
        { label: 'C', text: '此情可待成追忆', dimValue: 1 },
        { label: 'D', text: '欲穷千里目，更上一层楼', dimValue: 2 }
      ]},
    { order: 3, text: '友人远行，你赠言：', dim: 'K',
      options: [
        { label: 'A', text: '海内存知己，天涯若比邻', dimValue: 3 },
        { label: 'B', text: '劝君更尽一杯酒，西出阳关无故人', dimValue: 2 },
        { label: 'C', text: '执手相看泪眼，竟无语凝噎', dimValue: 1 },
        { label: 'D', text: '莫愁前路无知己，天下谁人不识君', dimValue: 2 }
      ]},
    { order: 4, text: '春日花朝，你最想：', dim: 'W',
      options: [
        { label: 'A', text: '寻春须是先春早，看花莫待花老', dimValue: 1 },
        { label: 'B', text: '踏花归去马蹄香', dimValue: 2 },
        { label: 'C', text: '人面不知何处去，桃花依旧笑春风', dimValue: 3 },
        { label: 'D', text: '春风得意马蹄疾，一日看尽长安花', dimValue: 2 }
      ]},
    { order: 5, text: '人生失意时，你的态度是：', dim: 'K',
      options: [
        { label: 'A', text: '一蓑烟雨任平生', dimValue: 3 },
        { label: 'B', text: '天生我材必有用', dimValue: 2 },
        { label: 'C', text: '问君能有几多愁', dimValue: 1 },
        { label: 'D', text: '安能摧眉折腰事权贵', dimValue: 2 }
      ]},
    { order: 6, text: '你最钟爱的题材是：', dim: 'T',
      options: [
        { label: 'A', text: '边塞烽火，金戈铁马', dimValue: 2 },
        { label: 'B', text: '田园牧歌，山水寄情', dimValue: 2 },
        { label: 'C', text: '咏史怀古，借古讽今', dimValue: 2 },
        { label: 'D', text: '酒与月，仙与梦', dimValue: 3 }
      ]}
  ],
  general: [
    { order: 1, text: '两军对垒，你倾向：', dim: 'M',
      options: [
        { label: 'A', text: '先察地形，设伏以待', dimValue: 3 },
        { label: 'B', text: '正面强攻，一鼓作气', dimValue: 1 },
        { label: 'C', text: '断其粮道，不战而屈', dimValue: 2 },
        { label: 'D', text: '挑帐单挑，决一死战', dimValue: 1 }
      ]},
    { order: 2, text: '主将遇伏，危在旦夕，你：', dim: 'Y',
      options: [
        { label: 'A', text: '率亲兵冲入重围，舍命相救', dimValue: 3 },
        { label: 'B', text: '组织援军，稳扎稳打', dimValue: 2 },
        { label: 'C', text: '绕道敌后，围魏救赵', dimValue: 2 },
        { label: 'D', text: '据守大营，待其突围', dimValue: 1 }
      ]},
    { order: 3, text: '朝廷疑你拥兵自重，召你回京，你：', dim: 'Z',
      options: [
        { label: 'A', text: '即刻交出兵权，单骑回京', dimValue: 3 },
        { label: 'B', text: '上表自陈，留待后议', dimValue: 2 },
        { label: 'C', text: '按兵不动，观望局势', dimValue: 1 },
        { label: 'D', text: '愤而起兵，清君侧', dimValue: 1 }
      ]},
    { order: 4, text: '战友陷于敌手，你：', dim: 'I',
      options: [
        { label: 'A', text: '千里走单骑，誓死相救', dimValue: 3 },
        { label: 'B', text: '倾全军之力，强攻救之', dimValue: 2 },
        { label: 'C', text: '遣使重金赎回', dimValue: 1 },
        { label: 'D', text: '忍痛放弃，先图大业', dimValue: 1 }
      ]},
    { order: 5, text: '兵败被围，弹尽粮绝，你：', dim: 'L',
      options: [
        { label: 'A', text: '宁死不降，拔剑自刎', dimValue: 3 },
        { label: 'B', text: '率残部突围，死中求生', dimValue: 2 },
        { label: 'C', text: '诈降以待时机', dimValue: 1 },
        { label: 'D', text: '为保全城百姓，开城投降', dimValue: 1 }
      ]},
    { order: 6, text: '连战连捷，朝廷封赏，你：', dim: 'S',
      options: [
        { label: 'A', text: '辞封让赏，请求归田', dimValue: 3 },
        { label: 'B', text: '受封但坚辞加九锡', dimValue: 2 },
        { label: 'C', text: '欣然受封，乘胜追击', dimValue: 1 },
        { label: 'D', text: '请朝廷厚抚将士，自取其半', dimValue: 2 }
      ]},
    { order: 7, text: '治军之道，你最重：', dim: 'M',
      options: [
        { label: 'A', text: '严明军纪，赏罚必信', dimValue: 2 },
        { label: 'B', text: '运筹帷幄，谋定后动', dimValue: 3 },
        { label: 'C', text: '身先士卒，与士卒同甘苦', dimValue: 2 },
        { label: 'D', text: '练精兵，速战速决', dimValue: 1 }
      ]},
    { order: 8, text: '功成身退，你选择：', dim: 'Z',
      options: [
        { label: 'A', text: '急流勇退，归隐田园', dimValue: 3 },
        { label: 'B', text: '镇守边关，保境安民', dimValue: 2 },
        { label: 'C', text: '入朝为相，辅佐明君', dimValue: 2 },
        { label: 'D', text: '拥兵自重，以待天时', dimValue: 1 }
      ]}
  ]
}

const SEED_RESULTS = {
  emperor: [
    {
      tag: 'LiShiMin', figureId: 'lishimin', figureName: '李世民', figureTitle: '唐太宗', dynasty: 'tang', dynastyName: '唐',
      pattern: 'HHM-HMM-HMH',
      title: '李世民式贞观之治', intro: '你雄才大略，从善如流，是开创盛世的明君。',
      desc: '你如唐太宗李世民，文治武功皆备。面对朝堂党争（第1题），你选择离间两派使其互相牵制，正是李世民驾驭群臣的手腕；面对功高震主的老臣（第3题），你倾向杯酒释兵权给予富贵，这正是李世民厚待功臣的胸襟。你既有运筹帷幄的谋略，也有虚心纳谏的气度。在你治下，万国来朝，四海升平。',
      bio: '李世民，唐高祖李渊次子。少年从军，雁门关救驾。玄武门之变后登基，年号贞观。在位期间，任用魏徵、房玄龄、杜如晦，开创贞观之治，被尊为"天可汗"。',
      quote: '以铜为镜，可以正衣冠；以古为镜，可以知兴替；以人为镜，可以明得失。',
      reasons: ['你在第1题选择离间两派，正是李世民驾驭朝堂的手腕', '你在第4题选择虚心纳谏，与李世民重用魏徵如出一辙', '你在第7题选择韬光养晦，映射玄武门之变前的隐忍'],
      radar: { 谋略: 92, 魄力: 95, 文采: 85, 隐忍: 70, 果断: 90, 包容: 88 },
      themeColor: '#C9A24D', bgStart: '#C9A24D', bgEnd: '#8B5A2B'
    },
    {
      tag: 'LiuBang', figureId: 'liubang', figureName: '刘邦', figureTitle: '汉高祖', dynasty: 'han', dynastyName: '西汉',
      pattern: 'MHH-LMH-MHH',
      title: '刘邦式知人善任', intro: '你看似平凡，却能让英雄为你所用。',
      desc: '你如汉高祖刘邦，出身微末却终成大业。面对边疆告急（第2题），你倾向召集老臣议定良策，这正是刘邦善用张良、萧何之智的体现；面对功高震主的老臣（第3题），你选择继续重用以诚相待，映射刘邦登基后封赏功臣的厚道。你的本事不在自己有多强，而在能用比自己强的人。',
      bio: '刘邦，沛丰邑中阳里人，初为泗水亭长。秦末起兵，先入关中，约法三章。楚汉相争中虽屡战屡败，最终垓下一战定乾坤，建立汉朝。',
      quote: '夫运筹策帷帐之中，决胜于千里之外，吾不如子房；镇国家，抚百姓，吾不如萧何；连百万之军，战必胜，攻必取，吾不如韩信。',
      reasons: ['你在第2题选择召集老臣议策，正是刘邦善用谋士的体现', '你在第7题选择拉拢老臣稳固班底，映射刘邦联合诸侯的策略', '你在第5题选择改革税制，与刘邦约法三章轻徭薄赋一脉相承'],
      radar: { 谋略: 75, 魄力: 85, 文采: 60, 隐忍: 95, 果断: 80, 包容: 90 },
      themeColor: '#B71C1C', bgStart: '#DC143C', bgEnd: '#8B0000'
    },
    {
      tag: 'CaoCao', figureId: 'caocao', figureName: '曹操', figureTitle: '魏武帝', dynasty: 'sanguo', dynastyName: '东汉末',
      pattern: 'HHH-LMH-HMM',
      title: '曹操式枭雄之姿', intro: '你雄才大略，多谋善断，是乱世的枭雄。',
      desc: '你如魏武帝曹操，治世之能臣，乱世之奸雄。面对朝堂党争（第1题），你选择离间两派使其互相牵制，正是曹操惯用的制衡之术；面对国库空虚（第5题），你倾向加派商税充盈内帑，映射曹操设摸金校尉充实军饷的务实。你唯才是举，不拘品行，深谋远虑，用兵如神。',
      bio: '曹操，字孟德，沛国谯人。举孝廉出身，讨董卓，迎献帝，挟天子以令诸侯。官渡之战败袁绍，统一北方。政治家、军事家、文学家，建安风骨的开创者。',
      quote: '宁教我负天下人，休教天下人负我。',
      reasons: ['你在第1题选择离间两派，正是曹操制衡群臣的权术', '你在第6题选择挥毫赋诗，映射曹操横槊赋诗的文采风流', '你在第3题选择罗织罪名斩草除根，与曹操杀杨修如出一辙'],
      radar: { 谋略: 95, 魄力: 92, 文采: 90, 隐忍: 80, 果断: 88, 包容: 60 },
      themeColor: '#2F4F4F', bgStart: '#2F4F4F', bgEnd: '#1A1A1A'
    },
    {
      tag: 'WuZetian', figureId: 'wuzetian', figureName: '武则天', figureTitle: '则天大圣皇帝', dynasty: 'tang', dynastyName: '唐·武周',
      pattern: 'HHH-MHH-HLM',
      title: '武则天式女皇权谋', intro: '你有过人的胆识与魄力，敢为天下先。',
      desc: '你如则天大圣皇帝武则天，中国历史上唯一的女皇帝。面对功高震主的老臣（第3题），你选择罗织罪名斩草除根，这正是武则天任用酷吏清除异己的手段；面对谏臣犯颜直谏（第4题），你选择虚心纳谏赏赐之，映射武则天重用狄仁杰的胸襟。你意志坚定，手段高明，能在复杂的政治局面中掌控全局。',
      bio: '武则天，名武曌，并州文水人。先为太宗才人，后为高宗皇后，临朝称制，最终改唐为周，自立为帝。在位期间打击门阀，重用人才，开创殿试、武举。',
      quote: '君子虽殒，美名不灭。',
      reasons: ['你在第3题选择斩草除根，正是武则天清除异己的雷霆手段', '你在第4题选择虚心纳谏，映射武则天重用狄仁杰的胸襟', '你在第2题选择御驾亲征，与武则天掌控军权的魄力一致'],
      radar: { 谋略: 92, 魄力: 98, 文采: 80, 隐忍: 90, 果断: 95, 包容: 65 },
      themeColor: '#C71585', bgStart: '#C71585', bgEnd: '#8B008B'
    },
    {
      tag: 'ZhuYuanZhang', figureId: 'zhuyuanzhang', figureName: '朱元璋', figureTitle: '明太祖', dynasty: 'ming', dynastyName: '明',
      pattern: 'MHH-MHL-HMH',
      title: '朱元璋式草根逆袭', intro: '你从微末中崛起，凭借铁腕与谋略成就大业。',
      desc: '你如明太祖朱元璋，从放牛娃、和尚到开国皇帝，古今无双。面对功高震主的老臣（第3题），你选择罗织罪名斩草除根，这正是朱元璋大杀功臣的铁腕；面对国库空虚（第5题），你倾向削减皇室用度与民休息，映射朱元璋出身贫寒深谙民间疾苦。你意志坚韧，掌权后铁腕治贪，废除丞相，集权于一身。',
      bio: '朱元璋，字国瑞，濠州钟离人。出身贫寒，曾为僧为丐。元末投郭子兴，后自立一军，灭陈友谅、张士诚，北伐驱逐元廷，建立大明。在位期间严惩贪官，废除丞相。',
      quote: '雪压枝头低，虽低不着泥。一朝红日出，依旧与天齐。',
      reasons: ['你在第3题选择斩草除根，正是朱元璋大杀功臣的铁腕作风', '你在第7题选择韬光养晦，映射朱元璋早期蛰伏高筑墙广积粮', '你在第5题选择削减皇室用度，与朱元璋体恤百姓的出身一致'],
      radar: { 谋略: 90, 魄力: 95, 文采: 60, 隐忍: 88, 果断: 95, 包容: 50 },
      themeColor: '#8B0000', bgStart: '#8B0000', bgEnd: '#4A0000'
    },
    {
      tag: 'ZhaoKuangYin', figureId: 'zhaokuangyin', figureName: '赵匡胤', figureTitle: '宋太祖', dynasty: 'song', dynastyName: '北宋',
      pattern: 'HMH-HMH-LLH',
      title: '赵匡胤式杯酒释兵权', intro: '你深谙权术，却以仁心待人，是难得的厚道帝王。',
      desc: '你如宋太祖赵匡胤，陈桥兵变黄袍加身，却以杯酒释兵权化解功臣之患。面对功高震主的老臣（第3题），你选择杯酒释兵权给予富贵，这正是赵匡胤的标志性手腕；面对谏臣犯颜直谏（第4题），你选择虚心纳谏，映射赵匡胤崇文之心。你重文抑武，开创两宋三百年文治盛世。',
      bio: '赵匡胤，字元朗，涿郡人。后周殿前都点检，陈桥兵变被黄袍加身，建立宋朝。在位期间杯酒释兵权，加强中央集权，重文抑武，奠定宋代文治基础。',
      quote: '富家不用买良田，书中自有千钟粟。',
      reasons: ['你在第3题选择杯酒释兵权，正是赵匡胤的标志性手腕', '你在第6题选择挥毫赋诗，映射赵匡胤崇文尊儒的开明', '你在第8题在意仁政爱民海晏河清，与赵匡胤文治天下一致'],
      radar: { 谋略: 88, 魄力: 82, 文采: 78, 隐忍: 92, 果断: 85, 包容: 95 },
      themeColor: '#228B22', bgStart: '#228B22', bgEnd: '#2E8B57'
    },
    {
      tag: 'LiuChe', figureId: 'liuche', figureName: '刘彻', figureTitle: '汉武帝', dynasty: 'han', dynastyName: '西汉',
      pattern: 'MMM-MMM-MMM',
      title: '汉武帝式帝王通才', intro: '你兼具多种帝王特质，能根据情境灵活应变，是真正的帝王通才。',
      desc: '你如汉武帝刘彻，兼具谋略与魄力、隐忍与果断。面对朝堂党争（第1题），你选择广纳谏言徐图良策，正是汉武帝内强皇权外御匈奴的稳健作风；面对功高震主的老臣（第3题），你选择委以虚职留京监视，映射汉武帝推恩削藩的谨慎布局。你罢黜百家独尊儒术，开辟丝绸之路，是千古一帝。',
      bio: '汉武帝刘彻，汉景帝之子。十六岁登基，在位五十四年。罢黜百家、独尊儒术，北击匈奴、通西域、开丝绸之路，开创西汉鼎盛局面。',
      quote: '寇可为，我复亦为；寇可往，我复亦往。',
      reasons: ['你在第1题选择广纳谏言，正是汉武帝内强皇权的稳健作风', '你在第7题选择广施恩惠收买人心，映射汉武帝推恩诸侯的策略', '你兼具多种帝王特质，能根据情境调整方略，与汉武帝的通才特质一致'],
      radar: { 谋略: 85, 魄力: 82, 文采: 78, 隐忍: 88, 果断: 85, 包容: 88 },
      themeColor: '#FFD700', bgStart: '#FFD700', bgEnd: '#B8860B'
    }
  ],
  poet: [
    {
      tag: 'LiBai', figureId: 'libai', figureName: '李白', figureTitle: '诗仙', dynasty: 'tang', dynastyName: '盛唐',
      pattern: 'HH-LM-LHH',
      title: '李白式浪漫豪放', intro: '你天性浪漫，追求自由与理想，是诗仙再世。',
      desc: '你如诗仙李白，斗酒诗百篇，长安市上酒家眠。月下独酌（第1题），你选择举杯邀明月对影成三人，正是李白最经典的浪漫意象；面对壮丽山河（第2题），你脱口而出"飞流直下三千尺"，与李白《望庐山瀑布》如出一辙。你追求自由，不阿权贵，让力士脱靴，贵妃研墨。',
      bio: '李白，字太白，号青莲居士，唐代伟大的浪漫主义诗人，被后人誉为"诗仙"。其诗豪放飘逸，想象丰富，代表了盛唐诗歌的巅峰。',
      quote: '天生我材必有用，千金散尽还复来。',
      reasons: ['你在第1题选择举杯邀明月，正是李白最经典的浪漫场景', '你在第2题脱口"飞流直下三千尺"，与李白名句如出一辙', '你在第5题失意时选择"天生我材必有用"，映射李白的豪迈自信'],
      radar: { 才情: 95, 豪放: 98, 婉约: 50, 旷达: 88, 浪漫: 100 },
      themeColor: '#1E90FF', bgStart: '#1E90FF', bgEnd: '#00BFFF'
    },
    {
      tag: 'DuFu', figureId: 'dufu', figureName: '杜甫', figureTitle: '诗圣', dynasty: 'tang', dynastyName: '唐',
      pattern: 'MH-LH-MHM',
      title: '杜甫式忧国忧民', intro: '你心怀天下，忧国忧民，是诗中的圣者。',
      desc: '你如诗圣杜甫，沉郁顿挫，忧国忧民。面对壮丽山河（第2题），你感叹"江山如画一时多少豪杰"，与杜甫《登高》中的历史沧桑感共鸣；友人远行（第3题），你赠言"劝君更尽一杯酒"，映射杜甫对友情的珍重。你"穷年忧黎元，叹息肠内热"，虽一生颠沛，却始终心系苍生。',
      bio: '杜甫，字子美，自号少陵野老，唐代伟大的现实主义诗人。与李白并称"李杜"。其诗被称为"诗史"，反映唐朝由盛转衰的历史。',
      quote: '安得广厦千万间，大庇天下寒士俱欢颜。',
      reasons: ['你在第2题感叹江山如画豪杰多少，与杜甫的历史沧桑感共鸣', '你在第5题失意时选择"问君能有几多愁"，映射杜甫沉郁顿挫的诗风', '你深沉厚重，思虑深远，与杜甫忧国忧民的气质一致'],
      radar: { 才情: 95, 豪放: 70, 婉约: 80, 旷达: 60, 浪漫: 50 },
      themeColor: '#654321', bgStart: '#8B4513', bgEnd: '#654321'
    },
    {
      tag: 'SuShi', figureId: 'sushi', figureName: '苏轼', figureTitle: '东坡居士', dynasty: 'song', dynastyName: '北宋',
      pattern: 'HH-LH-LHH',
      title: '苏轼式旷达乐观', intro: '你豁达乐观，多才多艺，是真正的全才。',
      desc: '你如东坡居士苏轼，诗词文赋书画皆绝。面对友人远行（第3题），你赠言"海内存知己天涯若比邻"，与苏轼"但愿人长久千里共婵娟"的旷达一致；人生失意时（第5题），你选择"一蓑烟雨任平生"，正是苏轼最经典的人生态度。你能在黄州煮东坡肉，能在赤壁赋大江东去，一生坎坷却始终旷达。',
      bio: '苏轼，字子瞻，号东坡居士，眉山人。北宋著名文学家、书法家、画家，"唐宋八大家"之一。一生仕途坎坷，但始终旷达乐观。',
      quote: '竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。',
      reasons: ['你在第3题选择"海内存知己"，与苏轼旷达的友情观一致', '你在第5题选择"一蓑烟雨任平生"，正是苏轼最经典的人生态度', '你多才多艺热爱生活，与苏轼煮东坡肉啖荔枝的真性情如出一辙'],
      radar: { 才情: 98, 豪放: 90, 婉约: 75, 旷达: 100, 浪漫: 80 },
      themeColor: '#228B22', bgStart: '#228B22', bgEnd: '#2E8B57'
    },
    {
      tag: 'BaiJuyi', figureId: 'baijuyi', figureName: '白居易', figureTitle: '诗魔', dynasty: 'tang', dynastyName: '中唐',
      pattern: 'MH-MM-LHL',
      title: '白居易式平易近人', intro: '你平易近人，老妪能解，是诗中的烟火气。',
      desc: '你如诗魔白居易，新乐府运动领袖。春日花朝（第4题），你选择"人面不知何处去桃花依旧笑春风"，与白居易《长恨歌》中"人面不知何处去"的缠绵一脉相承；面对友人远行（第3题），你赠言"莫愁前路无知己天下谁人不识君"，映射白居易平易真挚的友情观。你的诗平易近人，老妪能解，却字字千钧。',
      bio: '白居易，字乐天，号香山居士，唐代伟大的现实主义诗人。新乐府运动领袖，与元稹并称"元白"，与刘禹锡并称"刘白"。',
      quote: '同是天涯沦落人，相逢何必曾相识。',
      reasons: ['你在第4题选择桃花依旧笑春风，与白居易《长恨歌》的缠绵一脉相承', '你在第3题选择"莫愁前路无知己"，映射白居易平易真挚的友情观', '你平易近人懂百姓疾苦，与白居易老妪能解的诗风一致'],
      radar: { 才情: 92, 豪放: 65, 婉约: 88, 旷达: 80, 浪漫: 70 },
      themeColor: '#4682B4', bgStart: '#4682B4', bgEnd: '#5F9EA0'
    },
    {
      tag: 'LiQingZhao', figureId: 'liqingzhao', figureName: '李清照', figureTitle: '易安居士', dynasty: 'song', dynastyName: '南宋',
      pattern: 'MH-HM-LHM',
      title: '李清照式婉约深情', intro: '你婉约深情，才情绝代，是千古第一才女。',
      desc: '你如易安居士李清照，婉约词宗，千古第一才女。月下独酌（第1题），你选择思念远方故人，正是李清照"一种相思两处闲愁"的深情；春日花朝（第4题），你选择"寻春须是先春早看花莫待花老"，与李清照"知否知否应是绿肥红瘦"的婉约惜春一脉相承。你的词"别是一家"，前期清丽婉约，后期沉郁凄婉。',
      bio: '李清照，号易安居士，齐州章丘人。宋代女词人，婉约词派代表，有"千古第一才女"之称。与丈夫赵明诚共撰《金石录》。',
      quote: '生当作人杰，死亦为鬼雄。至今思项羽，不肯过江东。',
      reasons: ['你在第1题选择思念远方故人，正是李清照"一种相思两处闲愁"的深情', '你在第4题选择惜春看花，与李清照"知否知否应是绿肥红瘦"一脉相承', '你在第5题选择"问君能有几多愁"，映射李清照后期沉郁凄婉的词风'],
      radar: { 才情: 98, 豪放: 60, 婉约: 100, 旷达: 65, 浪漫: 85 },
      themeColor: '#C71585', bgStart: '#C71585', bgEnd: '#DA70D6'
    },
    {
      tag: 'SimaQian', figureId: 'simaqian', figureName: '司马迁', figureTitle: '太史公', dynasty: 'han', dynastyName: '西汉',
      pattern: 'MM-MM-MMM',
      title: '司马迁式史家之笔', intro: '你的诗魂兼容并蓄，以史入诗，是难得的通才。',
      desc: '你如太史公司马迁，以史家之笔写诗人之心。面对壮丽山河（第2题），你感叹"此情可待成追忆"，与司马迁"究天人之际通古今之变"的历史纵深感共鸣；人生失意时（第5题），你选择"天生我材必有用"，映射司马迁受宫刑后发愤著《史记》的坚韧。你的诗魂兼容并蓄，兼具豪放与婉约、旷达与浪漫，是诗坛中难得的通才。',
      bio: '司马迁，字子长，夏阳人。西汉史学家、散文家。因替李陵败降之事辩解而受宫刑，发奋完成《史记》百三十篇，史家之绝唱，无韵之离骚。',
      quote: '诗言志，歌永言。究天人之际，通古今之变，成一家之言。',
      reasons: ['你在第2题感叹此情可待成追忆，与司马迁的历史纵深感共鸣', '你在第5题选择"天生我材必有用"，映射司马迁发愤著书的坚韧', '你兼容并蓄诗风多元，与司马迁以史入诗的通才气质一致'],
      radar: { 才情: 88, 豪放: 78, 婉约: 82, 旷达: 85, 浪漫: 75 },
      themeColor: '#654321', bgStart: '#8B6914', bgEnd: '#654321'
    }
  ],
  general: [
    {
      tag: 'XiangYu', figureId: 'xiangyu', figureName: '项羽', figureTitle: '西楚霸王', dynasty: 'sanguo', dynastyName: '秦末·楚',
      pattern: 'HHH-LLM-LLL',
      title: '项羽式霸王之姿', intro: '你勇猛无双，重情重义，是千古悲情英雄。',
      desc: '你如西楚霸王项羽，力能扛鼎，才气过人。两军对垒（第1题），你选择正面强攻一鼓作气，正是项羽巨鹿之战破釜沉舟的勇猛；兵败被围（第5题），你选择宁死不降拔剑自刎，这正是项羽乌江自刎的悲壮。你勇冠三军，却刚愎自用；重情重义，却错失良机。垓下之围，留下千古悲歌。',
      bio: '项羽，名籍，字羽，下相人。楚国贵族。秦末起兵，巨鹿之战破釜沉舟，灭秦主力。后与刘邦争天下，垓下战败，乌江自刎。',
      quote: '力拔山兮气盖世，时不利兮骓不逝。',
      reasons: ['你在第1题选择正面强攻，正是项羽破釜沉舟的勇猛作风', '你在第5题选择宁死不降，映射项羽乌江自刎的悲壮', '你在第4题选择千里走单骑誓死相救，与项羽重情重义的性格一致'],
      radar: { 勇: 100, 谋: 50, 忠: 80, 义: 95, 烈: 100, 稳: 30 },
      themeColor: '#8B0000', bgStart: '#DC143C', bgEnd: '#8B0000'
    },
    {
      tag: 'YueFei', figureId: 'yuefei', figureName: '岳飞', figureTitle: '岳武穆', dynasty: 'song', dynastyName: '南宋',
      pattern: 'HH-HHH-HMH',
      title: '岳飞式精忠报国', intro: '你忠义双全，治军严明，是民族英雄的象征。',
      desc: '你如岳武穆岳飞，精忠报国，百战百胜。朝廷疑你拥兵自重召你回京（第3题），你选择即刻交出兵权单骑回京，这正是岳飞接十二道金牌毅然班师的忠义；战友陷于敌手（第4题），你选择千里走单骑誓死相救，与岳飞"待从头收拾旧山河"的热血一致。你治军严明，岳家军"冻死不拆屋，饿死不掳掠"。',
      bio: '岳飞，字鹏举，相州汤阴人。南宋抗金名将，中国历史上著名军事家、民族英雄。其"精忠报国"的精神，成为中华民族爱国主义的象征。',
      quote: '靖康耻，犹未雪；臣子恨，何时灭！',
      reasons: ['你在第3题选择即刻交出兵权，正是岳飞接十二道金牌班师的忠义', '你在第4题选择千里走单骑，与岳飞的热血义气一致', '你在第5题选择宁死不降，映射岳飞精忠报国的气节'],
      radar: { 勇: 95, 谋: 88, 忠: 100, 义: 95, 烈: 90, 稳: 80 },
      themeColor: '#DC143C', bgStart: '#DC143C', bgEnd: '#8B0000'
    },
    {
      tag: 'GuanYu', figureId: 'guanyu', figureName: '关羽', figureTitle: '关圣帝君', dynasty: 'sanguo', dynastyName: '三国·蜀',
      pattern: 'HH-LHH-HML',
      title: '关羽式义薄云天', intro: '你义薄云天，威震华夏，是武圣的化身。',
      desc: '你如关圣帝君关羽，义薄云天，万人之敌。朝廷疑你拥兵自重（第3题），你选择即刻交出兵权单骑回京，正是关羽"身在曹营心在汉"挂印封金的忠义；战友陷于敌手（第4题），你选择千里走单骑誓死相救，这正是关羽过五关斩六将寻兄的义举。你温酒斩华雄，水淹七军，威震华夏，被后世尊为武圣。',
      bio: '关羽，字云长，河东解良人。蜀汉名将，与刘备、张飞桃园结义。温酒斩华雄，斩颜良诛文丑，过五关斩六将，水淹七军威震华夏。后世尊为"武圣"。',
      quote: '玉可碎而不可改其白，竹可焚而不可毁其节。',
      reasons: ['你在第3题选择即刻交出兵权，正是关羽挂印封金的忠义', '你在第4题选择千里走单骑，与关羽过五关斩六将如出一辙', '你在第5题选择宁死不降，映射关羽威武不能屈的气节'],
      radar: { 勇: 95, 谋: 70, 忠: 100, 义: 100, 烈: 85, 稳: 70 },
      themeColor: '#B22222', bgStart: '#B22222', bgEnd: '#8B0000'
    },
    {
      tag: 'HanXin', figureId: 'hanxin', figureName: '韩信', figureTitle: '淮阴侯', dynasty: 'han', dynastyName: '西汉',
      pattern: 'LH-HML-HMM',
      title: '韩信式兵仙神帅', intro: '你智勇双全，用兵如神，是兵仙再世。',
      desc: '你如淮阴侯韩信，兵仙神帅，国士无双。两军对垒（第1题），你选择先察地形设伏以待，正是韩信背水一战置之死地而后生的谋略；治军之道（第7题），你选择运筹帷幄谋定后动，与韩信"韩信点兵多多益善"的自信一致。你能受胯下之辱，能筑坛拜将，明修栈道暗渡陈仓，十面埋伏垓下定乾坤。',
      bio: '韩信，淮阴人。西汉开国功臣，与张良、萧何并称"汉初三杰"。初投项羽，后归刘邦。平定齐、赵、魏，垓下灭项羽。后遭刘邦猜忌，被吕后诛杀。',
      quote: '韩信点兵，多多益善。',
      reasons: ['你在第1题选择先察地形设伏，正是韩信背水一战的谋略', '你在第7题选择运筹帷幄，与韩信兵仙的自信一致', '你在第2题选择组织援军稳扎稳打，映射韩信用兵谨慎的一面'],
      radar: { 勇: 85, 谋: 100, 忠: 60, 义: 70, 烈: 65, 稳: 80 },
      themeColor: '#2F4F4F', bgStart: '#2F4F4F', bgEnd: '#1A1A1A'
    },
    {
      tag: 'WeiQing', figureId: 'weiqing', figureName: '卫青', figureTitle: '长平侯', dynasty: 'han', dynastyName: '西汉',
      pattern: 'MH-MHH-HMH',
      title: '卫青式常胜将军', intro: '你战功赫赫，却谦逊低调，是难得的良将。',
      desc: '你如长平侯卫青，从奴隶到将军，七战七胜，封狼居胥。连战连捷（第6题），你选择辞封让赏请求归田，正是卫青"为人仁善退让"的谦逊；治军之道（第7题），你选择运筹帷幄谋定后动，与卫青直捣龙城收复河套的战术一致。你战功盖世却从不跋扈，是武将的典范，忠与谦的化身。',
      bio: '卫青，字仲卿，河东平阳人。本平阳公主家奴，后因姊卫子夫得宠而入宫。汉武帝时七征匈奴，七战七胜，封长平侯。',
      quote: '匈奴未灭，何以家为。',
      reasons: ['你在第6题选择辞封让赏，正是卫青"为人仁善退让"的谦逊', '你在第7题选择运筹帷幄，与卫青直捣龙城的战术一致', '你在第3题选择即刻交出兵权，映射卫青忠心耿耿从不跋扈'],
      radar: { 勇: 88, 谋: 92, 忠: 95, 义: 85, 烈: 70, 稳: 95 },
      themeColor: '#1E90FF', bgStart: '#1E90FF', bgEnd: '#4682B4'
    },
    {
      tag: 'HuoQuBing', figureId: 'huoqubing', figureName: '霍去病', figureTitle: '冠军侯', dynasty: 'han', dynastyName: '西汉',
      pattern: 'HHH-LHH-LLH',
      title: '霍去病式少年英雄', intro: '你锋芒毕露，敢战敢胜，是少年英雄的传奇。',
      desc: '你如冠军侯霍去病，十七岁封侯，二十二岁封狼居胥。两军对垒（第1题），你选择正面强攻一鼓作气，正是霍去病长途奔袭深入漠北的锐气；主将遇伏（第2题），你选择率亲兵冲入重围舍命相救，与霍去病少年热血的勇猛一致。你用兵神速，"匈奴未灭何以家为"的豪言激励千载，可惜天妒英才二十四岁早逝。',
      bio: '霍去病，河东平阳人，卫青外甥。善骑射，用兵神速。十七岁领兵作战，封冠军侯。六击匈奴，封狼居胥。元狩六年病逝，年仅二十四。',
      quote: '匈奴未灭，何以家为！',
      reasons: ['你在第1题选择正面强攻，正是霍去病长途奔袭的锐气', '你在第2题选择率亲兵冲入重围，与霍去病少年热血的勇猛一致', '你在第6题选择欣然受封乘胜追击，映射霍去病少年封侯的豪情'],
      radar: { 勇: 98, 谋: 80, 忠: 90, 义: 75, 烈: 95, 稳: 50 },
      themeColor: '#FF8C00', bgStart: '#FF8C00', bgEnd: '#FF4500'
    },
    {
      tag: 'ZhuGeLiang', figureId: 'zhugeliang', figureName: '诸葛亮', figureTitle: '武乡侯', dynasty: 'sanguo', dynastyName: '三国·蜀',
      pattern: 'MM-MM-MMM',
      title: '诸葛亮式儒将风范', intro: '你兼具多种武将特质，运筹帷幄，是难得的帅才。',
      desc: '你如武乡侯诸葛亮，鞠躬尽瘁，死而后已。两军对垒（第1题），你选择断其粮道不战而屈，正是诸葛亮"不战而屈人之兵"的谋略；朝廷疑你（第3题），你选择上表自陈留待后议，与诸葛亮《出师表》中"鞠躬尽瘁"的忠心一致。你的多元特质让你能驾驭不同的战场，是真正的帅才。',
      bio: '诸葛亮，字孔明，琅琊阳都人。三顾茅庐始出山，鞠躬尽瘁，死而后已。著《出师表》《诫子书》，卧龙一出天下惊。',
      quote: '将在谋而不在勇，兵在精而不在多。鞠躬尽瘁，死而后已。',
      reasons: ['你在第1题选择断其粮道，正是诸葛亮"不战而屈人之兵"的谋略', '你在第3题选择上表自陈，与诸葛亮《出师表》的忠心一致', '你兼具多种武将特质，与诸葛亮运筹帷幄的帅才气质一致'],
      radar: { 勇: 75, 谋: 95, 忠: 95, 义: 85, 烈: 70, 稳: 90 },
      themeColor: '#2F4F4F', bgStart: '#3D5A5A', bgEnd: '#2F4F4F'
    }
  ]
}

// ============================================================
// 算分引擎：WEIGHT 模式（服务端权威计算）
// ============================================================

function sumToLevel(score) {
  if (score <= 3) return 'L'
  if (score === 4) return 'M'
  return 'H'
}

function optionValueToLevel(value) {
  const score = Number(value)
  if (score <= 1) return 'L'
  if (score === 2) return 'M'
  return 'H'
}

function levelNum(level) {
  return { L: 1, M: 2, H: 3 }[level] || 1
}

function parsePattern(pattern) {
  if (!pattern || typeof pattern !== 'string') return []
  return pattern.replace(/-/g, '').toUpperCase().split('')
}

function buildQuestionKey(quizId, order) {
  return String(quizId || '') + '_' + String(order || '')
}

function normalizeQuestion(quizId, question) {
  const q = Object.assign({}, question)
  q.quizId = q.quizId || quizId
  q.questionKey = q.questionKey || buildQuestionKey(quizId, q.order)
  return q
}

function normalizeFallbackQuestion(quizId, question) {
  const q = normalizeQuestion(quizId, question)
  return Object.assign({}, q, { _id: q.questionKey })
}

/**
 * WEIGHT 模式计算
 * @param {Array} answers  - [{q, a, dim, dimValue}]
 * @param {Array} resultTypes - dna_results 集合数据
 * @param {Array} dimOrder - [{value, name, model}]
 * @returns {Object} { winner, similarity, exact, dimScores, dimLevels, ranked, resultData }
 */
function calculateWeight(answers, resultTypes, dimOrder) {
  const dims = dimOrder.map(d => d.value)
  const dimScores = {}
  dims.forEach(d => { dimScores[d] = 0 })

  answers.forEach(ans => {
    if (ans.dim && ans.dimValue !== undefined) {
      dimScores[ans.dim] = (dimScores[ans.dim] || 0) + Number(ans.dimValue)
    }
  })

  const dimLevels = {}
  dims.forEach(d => { dimLevels[d] = sumToLevel(dimScores[d] || 0) })

  const userVector = answers.map(ans => levelNum(optionValueToLevel(ans.dimValue)))
  const maxDist = Math.max(userVector.length, 1) * 2

  const ranked = resultTypes.map(rt => {
    const typeVector = parsePattern(rt.pattern).map(levelNum)
    let distance = 0
    let exact = 0
    const len = Math.min(userVector.length, typeVector.length)
    for (let i = 0; i < len; i++) {
      const diff = Math.abs(userVector[i] - typeVector[i])
      distance += diff
      if (diff === 0) exact += 1
    }
    distance += Math.abs(userVector.length - typeVector.length)
    const similarity = Math.max(0, Math.round((1 - distance / maxDist) * 100))
    return { tag: rt.tag, title: rt.title, similarity, exact, distance, _rt: rt }
  }).sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance
    if (b.exact !== a.exact) return b.exact - a.exact
    return b.similarity - a.similarity
  })

  const best = ranked[0] || {}
  // 不再使用 __fallback__ 兜底，直接取相似度最高的结果
  const winner = best.tag || ''
  const winnerRT = best._rt || resultTypes.find(r => r.tag === winner) || null

  return {
    winner,
    similarity: best.similarity || 0,
    exact: best.exact || 0,
    dimScores,
    dimLevels,
    ranked: ranked.map(r => ({ tag: r.tag, title: r.title, similarity: r.similarity, exact: r.exact })),
    resultData: winnerRT
  }
}

// ============================================================
// 种子数据幂等 upsert
// ============================================================

let _seeded = false

// 种子数据版本：当种子内容发生结构性变更时递增，触发强制刷新
const SEED_VERSION = 5

async function ensureSeed() {
  if (_seeded) return
  _seeded = true
  try {
    // 读取已存储的版本号
    let storedVersion = 0
    try {
      const vRes = await db.collection('dna_config').where({ key: 'seed_version' }).limit(1).get()
      if (vRes.data && vRes.data.length > 0) {
        storedVersion = vRes.data[0].value || 0
      }
    } catch (e) {}

    const forceRefresh = storedVersion < SEED_VERSION

    // 并行检查所有 quizzes 是否已存在
    const quizExistRes = await Promise.all(
      SEED_QUIZZES.map(function (q) {
        return db.collection('dna_quizzes').where({ id: q.id }).limit(1).get()
      })
    )
    // 并行执行 quizzes 的插入/更新
    const quizTasks = SEED_QUIZZES.map(function (q, i) {
      var exist = quizExistRes[i]
      if (!exist.data || !exist.data.length) {
        return db.collection('dna_quizzes').add({ data: Object.assign({}, q, { isOffline: false, createdAt: db.serverDate() }) })
      } else if (forceRefresh) {
        return db.collection('dna_quizzes').where({ id: q.id }).update({
          data: Object.assign({}, q, { isOffline: false, updatedAt: db.serverDate() })
        })
      }
      return Promise.resolve()
    })
    await Promise.all(quizTasks)

    // 并行检查所有 questions 是否已存在
    var quizIds_q = Object.keys(SEED_QUESTIONS)
    var qExistRes = await Promise.all(
      quizIds_q.map(function (quizId) {
        return db.collection('dna_questions').where({ quizId: quizId }).limit(1).get()
      })
    )
    // 并行执行 questions 的插入/删除+重插
    var qTasks = quizIds_q.map(function (quizId, i) {
      var exist = qExistRes[i]
      if (!exist.data || !exist.data.length) {
        return Promise.all(
          SEED_QUESTIONS[quizId].map(function (q) {
            return db.collection('dna_questions').add({ data: normalizeQuestion(quizId, q) })
          })
        )
      } else if (forceRefresh) {
        // 删除旧题目后重新插入
        return db.collection('dna_questions').where({ quizId: quizId }).remove().then(function () {
          return Promise.all(
            SEED_QUESTIONS[quizId].map(function (q) {
              return db.collection('dna_questions').add({ data: normalizeQuestion(quizId, q) })
            })
          )
        })
      }
      return Promise.resolve()
    })
    await Promise.all(qTasks)

    // 并行检查所有 results 是否已存在
    var quizIds_r = Object.keys(SEED_RESULTS)
    var rExistRes = await Promise.all(
      quizIds_r.map(function (quizId) {
        return db.collection('dna_results').where({ quizId: quizId }).limit(1).get()
      })
    )
    // 并行执行 results 的插入/删除+重插
    var rTasks = quizIds_r.map(function (quizId, i) {
      var exist = rExistRes[i]
      if (!exist.data || !exist.data.length) {
        return Promise.all(
          SEED_RESULTS[quizId].map(function (r) {
            return db.collection('dna_results').add({ data: Object.assign({ quizId: quizId }, r) })
          })
        )
      } else if (forceRefresh) {
        // 删除旧结果后重新插入
        return db.collection('dna_results').where({ quizId: quizId }).remove().then(function () {
          return Promise.all(
            SEED_RESULTS[quizId].map(function (r) {
              return db.collection('dna_results').add({ data: Object.assign({ quizId: quizId }, r) })
            })
          )
        })
      }
      return Promise.resolve()
    })
    await Promise.all(rTasks)

    // 更新版本号
    if (forceRefresh) {
      try {
        const vExist = await db.collection('dna_config').where({ key: 'seed_version' }).limit(1).get()
        if (vExist.data && vExist.data.length > 0) {
          await db.collection('dna_config').where({ key: 'seed_version' }).update({
            data: { value: SEED_VERSION, updatedAt: db.serverDate() }
          })
        } else {
          await db.collection('dna_config').add({
            data: { key: 'seed_version', value: SEED_VERSION, createdAt: db.serverDate() }
          })
        }
      } catch (e) {
        // dna_config 集合可能不存在，忽略错误
      }
    }
  } catch (e) {
    console.warn('ensureSeed error (ignore if no permission):', e.message)
  }
}

// 后台异步触发种子初始化，不阻塞主请求
function ensureSeedBackground() {
  // 不 await，后台异步执行
  ensureSeed().catch(function (e) {
    console.warn('ensureSeedBackground error:', e && e.message)
  })
}

// ============================================================
// Action 处理
// ============================================================

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event
  const data = normalizeEventData(event)

  // 后台非阻塞触发种子初始化
  ensureSeedBackground()

  try {
    switch (action) {
      case 'quiz-list': return await quizList(OPENID, data)
      case 'quiz-detail': return await quizDetail(OPENID, data)
      case 'submit': return await submit(OPENID, data)
      case 'get-record': return await getRecord(OPENID, data)
      case 'my-records': return await myRecords(OPENID, data)
      case 'admin-quiz-list': return await adminQuizList(OPENID, data)
      case 'admin-update-quiz-cover': return await adminUpdateQuizCover(OPENID, data)
      case 'admin-figure-list': return await adminFigureList(OPENID, data)
      case 'admin-update-figure-avatar': return await adminUpdateFigureAvatar(OPENID, data)
      default: return { code: -1, message: '未知 action: ' + action }
    }
  } catch (e) {
    console.error('dna err:', e)
    return { code: -1, message: e.message || '服务异常' }
  }
}

function normalizeEventData(event) {
  const { action, data, ...rest } = event || {}
  return data && typeof data === 'object' ? { ...rest, ...data } : rest
}

// 测试列表
async function quizList(OPENID, data) {
  const { category } = data
  const where = { isOffline: _.neq(true) }
  if (category && category !== 'all') where.category = category

  const r = await db.collection('dna_quizzes')
    .where(where)
    .orderBy('order', 'asc')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  var rawQuizzes = r.data || []

  // DB 无数据时兜底返回内存种子数据（首次调用 / 种子尚未写入）
  if (!rawQuizzes.length) {
    rawQuizzes = SEED_QUIZZES.map(function (q) {
      return Object.assign({}, q, { _id: '', isOffline: false })
    })
  }

  // 并行统计每个测试的参与人数
  var quizzes = await Promise.all(rawQuizzes.map(function (q) {
    return db.collection('dna_records')
      .where({ quizId: q.id })
      .count()
      .then(function (cnt) {
        return Object.assign({}, q, {
          participantCount: (cnt && cnt.total) || 0,
          questionsCount: q.questionsCount || 0
        })
      })
      .catch(function () {
        return Object.assign({}, q, {
          participantCount: 0,
          questionsCount: q.questionsCount || 0
        })
      })
  }))

  return { code: 0, message: 'ok', data: { quizzes: quizzes } }
}

// 测试详情：quiz + questions + results
async function quizDetail(OPENID, data) {
  const { id } = data
  if (!id) return { code: -1, message: '缺少 id' }

  var quiz = null
  var quizRes = await db.collection('dna_quizzes').where({ id: id }).limit(1).get()
  if (quizRes.data && quizRes.data.length) {
    quiz = quizRes.data[0]
  } else {
    // 兜底：从内存种子数据获取
    var seedQuiz = SEED_QUIZZES.find(function (q) { return q.id === id })
    if (seedQuiz) {
      quiz = Object.assign({}, seedQuiz, { _id: '', isOffline: false })
    } else {
      return { code: -1, message: '测试不存在' }
    }
  }

  var qRes = await db.collection('dna_questions')
    .where({ quizId: id })
    .orderBy('order', 'asc')
    .limit(50)
    .get()
  var questions = (qRes.data || []).map(function (q) {
    return normalizeQuestion(id, q)
  })
  if (!questions.length && SEED_QUESTIONS[id]) {
    questions = SEED_QUESTIONS[id].map(function (q) {
      return normalizeFallbackQuestion(id, q)
    })
  }

  var rRes = await db.collection('dna_results')
    .where({ quizId: id })
    .limit(50)
    .get()
  var results = rRes.data || []
  if (!results.length && SEED_RESULTS[id]) {
    results = SEED_RESULTS[id].map(function (r) {
      return Object.assign({ quizId: id }, r, { _id: '' })
    })
  }

  // 自动补全 dimOrder
  if (!quiz.dimOrder || !quiz.dimOrder.length) {
    var dims = []
    var seen = {}
    questions.forEach(function (q) {
      if (q.dim && !seen[q.dim]) { seen[q.dim] = true; dims.push(q.dim) }
    })
    quiz.dimOrder = dims.map(function (d) { return { value: d, name: d, model: d } })
  }

  // 截取实际使用的题目数
  var n = quiz.questionsCount || questions.length
  var displayQuestions = (quiz.type !== 'WEIGHT' && n && n < questions.length)
    ? questions.slice(0, n)
    : questions

  return {
    code: 0, message: 'ok',
    data: { quiz: quiz, questions: displayQuestions, results: results }
  }
}

// 提交答案：服务端算分 + 存记录
async function submit(OPENID, data) {
  const { quizId, answers = [] } = data
  if (!quizId) return { code: -1, message: '缺少 quizId' }
  if (!answers.length) return { code: -1, message: '请回答问题' }

  // 拉取 quiz + questions + results（含内存兜底）
  var quiz = null
  var quizRes = await db.collection('dna_quizzes').where({ id: quizId }).limit(1).get()
  if (quizRes.data && quizRes.data.length) {
    quiz = quizRes.data[0]
  } else {
    var seedQuiz = SEED_QUIZZES.find(function (q) { return q.id === quizId })
    if (seedQuiz) {
      quiz = Object.assign({}, seedQuiz, { _id: '', isOffline: false })
    } else {
      return { code: -1, message: '测试不存在' }
    }
  }

  var qRes = await db.collection('dna_questions')
    .where({ quizId: quizId })
    .orderBy('order', 'asc')
    .limit(50)
    .get()
  var questions = (qRes.data || []).map(function (q) {
    return normalizeQuestion(quizId, q)
  })
  if (!questions.length && SEED_QUESTIONS[quizId]) {
    questions = SEED_QUESTIONS[quizId].map(function (q) {
      return normalizeFallbackQuestion(quizId, q)
    })
  }

  var rRes = await db.collection('dna_results')
    .where({ quizId: quizId })
    .limit(50)
    .get()
  var results = rRes.data || []
  if (!results.length && SEED_RESULTS[quizId]) {
    results = SEED_RESULTS[quizId].map(function (r) {
      return Object.assign({ quizId: quizId }, r, { _id: '' })
    })
  }

  if (!quiz.dimOrder || !quiz.dimOrder.length) {
    var dims = []
    var seen = {}
    questions.forEach(function (q) {
      if (q.dim && !seen[q.dim]) { seen[q.dim] = true; dims.push(q.dim) }
    })
    quiz.dimOrder = dims.map(function (d) { return { value: d, name: d, model: d } })
  }

  // 服务端重算答案（铁律：不信前端）
  // answers 入参格式: [{q: questionId/questionKey, order, a}]
  // 服务端根据 quizId + q/order 找到题目，再按 a 找到 option，提取 dim + dimValue
  const rebuiltAnswers = []
  for (const ans of answers) {
    const ansOrder = Number(ans.order || ans.q)
    const ansQ = ans.q === undefined || ans.q === null ? '' : String(ans.q)
    const q = questions.find(function (x) {
      if (Number.isFinite(ansOrder) && Number(x.order) === ansOrder) return true
      if (ansQ && x.questionKey && String(x.questionKey) === ansQ) return true
      if (ansQ && x._id && String(x._id) === ansQ) return true
      return false
    })
    if (!q) continue
    const opt = (q.options || []).find(o => o.label === ans.a)
    if (!opt) continue
    rebuiltAnswers.push({
      q: q._id || q.questionKey,
      order: q.order,
      a: opt.label,
      dim: q.dim,
      dimValue: opt.dimValue
    })
  }

  if (!rebuiltAnswers.length) {
    return { code: -1, message: '答案解析失败' }
  }
  rebuiltAnswers.sort(function (a, b) {
    return Number(a.order || 0) - Number(b.order || 0)
  })

  // 算分
  const calc = calculateWeight(rebuiltAnswers, results, quiz.dimOrder)

  // 结果快照（避免后续 result 改动影响历史）
  const resultData = calc.resultData ? {
    tag: calc.resultData.tag,
    figureId: calc.resultData.figureId,
    figureName: calc.resultData.figureName,
    figureTitle: calc.resultData.figureTitle,
    dynasty: calc.resultData.dynasty,
    dynastyName: calc.resultData.dynastyName,
    title: calc.resultData.title,
    intro: calc.resultData.intro,
    desc: calc.resultData.desc,
    bio: calc.resultData.bio,
    quote: calc.resultData.quote,
    reasons: calc.resultData.reasons || [],
    radar: calc.resultData.radar || {},
    themeColor: calc.resultData.themeColor || quiz.themeColor,
    bgStart: calc.resultData.bgStart || quiz.themeColor,
    bgEnd: calc.resultData.bgEnd || quiz.themeColor,
    cover: calc.resultData.cover || ''
  } : null

  // 兜底相似度（保证有可展示值）
  const similarity = Math.max(calc.similarity, 60 + Math.floor(Math.random() * 5))

  const record = {
    _openid: OPENID,
    quizId,
    quizTitle: quiz.title,
    quizIcon: quiz.icon || '',
    quizCover: quiz.cover || '',
    quizThemeColor: quiz.themeColor || '',
    answers: rebuiltAnswers,
    scores: calc.dimScores,
    dimLevels: calc.dimLevels,
    winner: calc.winner,
    similarity,
    resultData,
    createdAt: db.serverDate()
  }

  let recordId = ''
  try {
    const saved = await db.collection('dna_records').add({ data: record })
    recordId = saved._id
  } catch (e) {
    console.warn('save record failed:', e.message)
    recordId = 'mock_' + Date.now()
  }

  tryUnlock(OPENID, 'dna_done')

  return {
    code: 0, message: 'ok',
    data: {
      recordId,
      winner: calc.winner,
      similarity,
      dimLevels: calc.dimLevels,
      dimScores: calc.dimScores,
      resultData,
      ranked: calc.ranked.slice(0, 5)
    }
  }
}

// 获取单条记录
async function getRecord(OPENID, data) {
  const { recordId } = data
  if (!recordId) return { code: -1, message: '缺少 recordId' }

  let record = null
  // 优先按 _id 查
  try {
    const r = await db.collection('dna_records').doc(recordId).get()
    if (r.data) record = r.data
  } catch (e) {}

  // 兜底：按 _openid + recordId 在 mock 情况下查最近一条
  if (!record) {
    const r2 = await db.collection('dna_records')
      .where({ _openid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()
    record = (r2.data || [])[0] || null
  }

  if (!record) return { code: 0, message: 'ok', data: null }

  // 检查结果关联的历史人物是否存在于 figures 集合
  var figureExists = false
  var figureAvatar = ''
  var figureId = record.resultData && record.resultData.figureId
  if (figureId) {
    try {
      var figRes = await db.collection('figures').where({ id: figureId }).limit(1).get()
      if (figRes && figRes.data && figRes.data.length > 0) {
        figureExists = true
        figureAvatar = (figRes.data[0] && (figRes.data[0].mini_avatar_url || figRes.data[0].avatar_url || figRes.data[0].avatar)) || ''
      }
    } catch (e) {}
  }
  record.figureExists = figureExists
  record.figureAvatar = figureAvatar

  // 补充 quizCover（旧记录可能没有）
  if (!record.quizCover && record.quizId) {
    try {
      var qRes = await db.collection('dna_quizzes').where({ id: record.quizId }).limit(1).get()
      if (qRes.data && qRes.data.length > 0 && qRes.data[0].cover) {
        record.quizCover = qRes.data[0].cover
      } else {
        // 内存兜底
        var sq = SEED_QUIZZES.find(function (q) { return q.id === record.quizId })
        if (sq && sq.cover) record.quizCover = sq.cover
      }
    } catch (e) {}
  }

  return { code: 0, message: 'ok', data: record }
}

// 我的测试历史
async function myRecords(OPENID, data) {
  const { page = 0, pageSize = 20 } = data
  const r = await db.collection('dna_records')
    .where({ _openid: OPENID })
    .orderBy('createdAt', 'desc')
    .skip(page * pageSize)
    .limit(Math.min(pageSize, 50))
    .get()
  return {
    code: 0, message: 'ok',
    data: { records: r.data || [], page, pageSize }
  }
}

// ============================================================
// Admin 管理接口：更新测试封面图 / 人物头像
// ============================================================

// 管理端：获取所有测试列表
async function adminQuizList(OPENID, data) {
  var r = await db.collection('dna_quizzes')
    .orderBy('order', 'asc')
    .limit(50)
    .get()
  var quizzes = (r.data || []).map(function (q) {
    return {
      id: q.id,
      title: q.title,
      icon: q.icon || '',
      cover: q.cover || '',
      category: q.category || '',
      questionsCount: q.questionsCount || 0
    }
  })
  return { code: 0, message: 'ok', data: { quizzes: quizzes } }
}

// 管理端：更新测试封面图
async function adminUpdateQuizCover(OPENID, data) {
  var quizId = data.quizId
  var cover = data.cover
  if (!quizId) return { code: -1, message: '缺少 quizId' }
  if (!cover) return { code: -1, message: '缺少 cover (fileID)' }
  await db.collection('dna_quizzes')
    .where({ id: quizId })
    .update({ data: { cover: cover, updatedAt: db.serverDate() } })
  return { code: 0, message: 'ok', data: { quizId: quizId, cover: cover } }
}

// 管理端：获取所有人物列表
async function adminFigureList(OPENID, data) {
  var r = await db.collection('figures')
    .orderBy('id', 'asc')
    .limit(100)
    .get()
  var figures = (r.data || []).map(function (f) {
    return {
      figureId: f.id,
      figureName: f.name || f.figureName || '',
      title: f.identity || f.title || '',
      dynasty: f.dynasty || '',
      dynastyName: f.dynastyName || '',
      avatar: f.mini_avatar_url || f.avatar_url || f.avatar || ''
    }
  })
  return { code: 0, message: 'ok', data: { figures: figures } }
}

// 管理端：更新人物头像
async function adminUpdateFigureAvatar(OPENID, data) {
  var figureId = data.figureId
  var avatar = data.avatar
  if (!figureId) return { code: -1, message: '缺少 figureId' }
  if (!avatar) return { code: -1, message: '缺少 avatar (fileID)' }
  await db.collection('figures')
    .where({ id: figureId })
    .update({ data: { mini_avatar_url: avatar, avatar_url: avatar, updatedAt: db.serverDate() } })
  return { code: 0, message: 'ok', data: { figureId: figureId, avatar: avatar } }
}
