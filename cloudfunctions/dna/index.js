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
    const REWARDS = { first_chat: 10, first_letter: 10, first_like: 5, dna_done: 20, first_visit: 10, first_profile: 10, chat_10: 30, chat_50: 80, letter_5: 50, comment_10: 30, chat_100: 150, letter_10: 100, first_memorial: 20, memorial_5: 80, read_book: 15, memorial_20: 200, read_5: 100, dna_share: 30, all_dynasties: 200, collector: 500, time_master: 1000, all_figures: 300, moment_popular: 200, memorial_master: 500 }
    const reward = REWARDS[key] || 0
    achievements.push({ key, unlockedAt: new Date() })
    await db.collection('users').doc(user._id).update({
      data: { achievements, points: db.command.inc(reward), updatedAt: db.serverDate() }
    })
  } catch (e) { console.warn('tryUnlock fail', key, e.message) }
}

// 管理员权限校验：users 集合 role 字段须为 admin 或 superadmin
async function checkAdmin(OPENID) {
  const res = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
  if (!res.data || res.data.length === 0) throw new Error('用户不存在')
  const role = res.data[0].role || 'user'
  if (role !== 'admin' && role !== 'superadmin') throw new Error('无管理员权限')
  return res.data[0]
}

// 封面图云文件 ID（已上传到云存储）
const COVER_FILE_IDS = {
  emperor: 'cloud://cloud1-d8guq74iacc68352a.636c-cloud1-d8guq74iacc68352a-1464144866/dna-covers/emperor.jpg',
  poet: 'cloud://cloud1-d8guq74iacc68352a.636c-cloud1-d8guq74iacc68352a-1464144866/dna-covers/poet.jpg',
  general: 'cloud://cloud1-d8guq74iacc68352a.636c-cloud1-d8guq74iacc68352a-1464144866/dna-covers/general.jpg',
  strategist: 'cloud://cloud1-d8guq74iacc68352a.636c-cloud1-d8guq74iacc68352a-1464144866/dna-covers/strategist.jpg',
  historian: 'cloud://cloud1-d8guq74iacc68352a.636c-cloud1-d8guq74iacc68352a-1464144866/dna-covers/historian.jpg',
  hero: 'cloud://cloud1-d8guq74iacc68352a.636c-cloud1-d8guq74iacc68352a-1464144866/dna-covers/hero.jpg'
}

// ============================================================
// 种子数据：6 个测试（emperor / poet / general / strategist / historian / hero）
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
  },
  {
    id: 'strategist',
    title: '测测你更像哪位谋士？',
    subtitle: '帷幄之间，谁与你同谋',
    desc: '6 道题测出你的谋士气质，是奇谋迭出还是稳国安邦？',
    cover: COVER_FILE_IDS.strategist,
    icon: '',
    themeColor: '#5B6D92',
    questionsCount: 6,
    dimOrder: [
      { value: 'Q', name: '奇谋', model: '出奇制胜' },
      { value: 'S', name: '审势', model: '识时知变' },
      { value: 'R', name: '忍耐', model: '韬晦深藏' },
      { value: 'L', name: '忠诚', model: '辅主之心' },
      { value: 'G', name: '格局', model: '经世之才' }
    ],
    category: 'strategist',
    order: 4
  },
  {
    id: 'historian',
    title: '测测你更像哪位史家？',
    subtitle: '青简之上，谁执你笔',
    desc: '6 道题测出你的史家人格，是秉笔直书还是通鉴治世？',
    cover: COVER_FILE_IDS.historian,
    icon: '',
    themeColor: '#6D4C41',
    questionsCount: 6,
    dimOrder: [
      { value: 'Z', name: '直笔', model: '史德' },
      { value: 'K', name: '考据', model: '史识' },
      { value: 'W', name: '文采', model: '史才' },
      { value: 'J', name: '经世', model: '史用' },
      { value: 'R', name: '韧性', model: '史魂' }
    ],
    category: 'historian',
    order: 5
  },
  {
    id: 'hero',
    title: '测测你更像哪位乱世英雄？',
    subtitle: '风云际会，谁与你同局',
    desc: '6 道题测出你的乱世选择，是雄主、仁主还是霸者？',
    cover: COVER_FILE_IDS.hero,
    icon: '',
    themeColor: '#7A3E2F',
    questionsCount: 6,
    dimOrder: [
      { value: 'X', name: '雄心', model: '逐鹿之志' },
      { value: 'R', name: '仁义', model: '得人之道' },
      { value: 'M', name: '谋断', model: '权变之术' },
      { value: 'Y', name: '用人', model: '聚众之能' },
      { value: 'B', name: '霸气', model: '威势之锋' }
    ],
    category: 'hero',
    order: 6
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
  ],
  strategist: [
    { order: 1, text: '主公初入乱局，四方势力未明，你先做什么：', dim: 'S',
      options: [
        { label: 'A', text: '先绘天下形势，判断谁可联合', dimValue: 3 },
        { label: 'B', text: '献一条险计，迅速打开局面', dimValue: 2 },
        { label: 'C', text: '稳住粮草人心，避免先乱阵脚', dimValue: 2 },
        { label: 'D', text: '暂不表态，暗中观察胜负', dimValue: 1 }
      ]},
    { order: 2, text: '敌强我弱，最适合的破局方式是：', dim: 'Q',
      options: [
        { label: 'A', text: '声东击西，打敌人最意外之处', dimValue: 3 },
        { label: 'B', text: '坚守要地，拖到敌方疲敝', dimValue: 2 },
        { label: 'C', text: '请第三方入局，改变力量对比', dimValue: 2 },
        { label: 'D', text: '避免冒险，先保存实力', dimValue: 1 }
      ]},
    { order: 3, text: '你的计策被主公否决，你会：', dim: 'R',
      options: [
        { label: 'A', text: '再三陈说利害，务求采纳', dimValue: 2 },
        { label: 'B', text: '暂且退下，等待下一次时机', dimValue: 3 },
        { label: 'C', text: '改换说法，从主公关切处切入', dimValue: 2 },
        { label: 'D', text: '心灰意冷，另寻明主', dimValue: 1 }
      ]},
    { order: 4, text: '功成之后，你更在意：', dim: 'L',
      options: [
        { label: 'A', text: '主公与天下都能长治久安', dimValue: 3 },
        { label: 'B', text: '自己的谋略被后世记住', dimValue: 2 },
        { label: 'C', text: '家族门第能稳固延续', dimValue: 1 },
        { label: 'D', text: '退居幕后，避开权力漩涡', dimValue: 2 }
      ]},
    { order: 5, text: '治理国家时，你最看重：', dim: 'G',
      options: [
        { label: 'A', text: '制度、人才、粮赋一并成体系', dimValue: 3 },
        { label: 'B', text: '先抓关键矛盾，逐项修补', dimValue: 2 },
        { label: 'C', text: '维持旧制，减少震荡', dimValue: 1 },
        { label: 'D', text: '以法令威势迅速压住局面', dimValue: 2 }
      ]},
    { order: 6, text: '你留给后人的形象更像：', dim: 'Q',
      options: [
        { label: 'A', text: '算无遗策的奇谋家', dimValue: 3 },
        { label: 'B', text: '稳定大局的辅政者', dimValue: 2 },
        { label: 'C', text: '忍到最后的胜利者', dimValue: 2 },
        { label: 'D', text: '功成身退的隐者', dimValue: 1 }
      ]}
  ],
  historian: [
    { order: 1, text: '面对权贵要求改史，你会：', dim: 'Z',
      options: [
        { label: 'A', text: '秉笔直书，宁可得罪权贵', dimValue: 3 },
        { label: 'B', text: '保留事实，但措辞稍作回旋', dimValue: 2 },
        { label: 'C', text: '另存底稿，等待后世辨明', dimValue: 2 },
        { label: 'D', text: '顺势而写，先保全自己', dimValue: 1 }
      ]},
    { order: 2, text: '整理史料时，你最不能忍受：', dim: 'K',
      options: [
        { label: 'A', text: '传闻当事实，年月人物混乱', dimValue: 3 },
        { label: 'B', text: '只写事件，不看制度背景', dimValue: 2 },
        { label: 'C', text: '文笔枯燥，读者难以进入', dimValue: 1 },
        { label: 'D', text: '材料太多，迟迟无法定稿', dimValue: 2 }
      ]},
    { order: 3, text: '你写历史，更想写出：', dim: 'W',
      options: [
        { label: 'A', text: '人物命运的跌宕与悲欢', dimValue: 3 },
        { label: 'B', text: '制度兴衰背后的规律', dimValue: 2 },
        { label: 'C', text: '简明清楚的年代脉络', dimValue: 2 },
        { label: 'D', text: '冷静克制的事实记录', dimValue: 1 }
      ]},
    { order: 4, text: '读史的最大意义是：', dim: 'J',
      options: [
        { label: 'A', text: '给当下政治治理提供借鉴', dimValue: 3 },
        { label: 'B', text: '让后人知道真相与代价', dimValue: 2 },
        { label: 'C', text: '保存一代人的制度记忆', dimValue: 2 },
        { label: 'D', text: '满足对古人的好奇', dimValue: 1 }
      ]},
    { order: 5, text: '遭遇人生重挫时，你会：', dim: 'R',
      options: [
        { label: 'A', text: '把痛苦化成一部必须完成的书', dimValue: 3 },
        { label: 'B', text: '隐忍整理材料，等待时机', dimValue: 2 },
        { label: 'C', text: '转向考据细节，避开风波', dimValue: 2 },
        { label: 'D', text: '放下著述，远离是非', dimValue: 1 }
      ]},
    { order: 6, text: '你理想中的史书气质是：', dim: 'Z',
      options: [
        { label: 'A', text: '有胆识、有血性、有判断', dimValue: 3 },
        { label: 'B', text: '严谨完备，结构清楚', dimValue: 2 },
        { label: 'C', text: '能警醒君臣，服务治道', dimValue: 2 },
        { label: 'D', text: '少作评判，只存材料', dimValue: 1 }
      ]}
  ],
  hero: [
    { order: 1, text: '乱世初起，你最先争取的是：', dim: 'Y',
      options: [
        { label: 'A', text: '人才和谋士，先把班底搭起来', dimValue: 3 },
        { label: 'B', text: '精兵强将，先打出威名', dimValue: 2 },
        { label: 'C', text: '百姓口碑，先站稳名义', dimValue: 2 },
        { label: 'D', text: '城池粮草，先守住一方', dimValue: 1 }
      ]},
    { order: 2, text: '面对强敌压境，你的姿态是：', dim: 'B',
      options: [
        { label: 'A', text: '主动决战，用胜利震慑天下', dimValue: 3 },
        { label: 'B', text: '避其锋芒，等敌人露出破绽', dimValue: 2 },
        { label: 'C', text: '先结盟，再寻找反击窗口', dimValue: 2 },
        { label: 'D', text: '退守自保，不轻易下注', dimValue: 1 }
      ]},
    { order: 3, text: '你对部下最看重：', dim: 'R',
      options: [
        { label: 'A', text: '愿与我共患难的情义', dimValue: 3 },
        { label: 'B', text: '能打胜仗的实际能力', dimValue: 2 },
        { label: 'C', text: '绝对服从的纪律', dimValue: 1 },
        { label: 'D', text: '能各展其长的合作关系', dimValue: 2 }
      ]},
    { order: 4, text: '夺取天下的关键在于：', dim: 'M',
      options: [
        { label: 'A', text: '看清大势，抓住转折点', dimValue: 3 },
        { label: 'B', text: '敢打硬仗，先破最大敌人', dimValue: 2 },
        { label: 'C', text: '经营名望，让天下归心', dimValue: 2 },
        { label: 'D', text: '慢慢积累，少犯错误', dimValue: 1 }
      ]},
    { order: 5, text: '胜利之后，你会如何安排功臣：', dim: 'X',
      options: [
        { label: 'A', text: '重赏重用，让英雄各得其位', dimValue: 2 },
        { label: 'B', text: '削弱兵权，防止尾大不掉', dimValue: 3 },
        { label: 'C', text: '以情义维系，不急于改动', dimValue: 2 },
        { label: 'D', text: '保守处理，维持原状', dimValue: 1 }
      ]},
    { order: 6, text: '后世评价里，你最想得到：', dim: 'X',
      options: [
        { label: 'A', text: '乱世雄主，开创新局', dimValue: 3 },
        { label: 'B', text: '仁义之主，众人归心', dimValue: 2 },
        { label: 'C', text: '一代霸者，威震四方', dimValue: 2 },
        { label: 'D', text: '守成有道，少有败笔', dimValue: 1 }
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
      tag: 'ZhuDi', figureId: 'zhudi', figureName: '朱棣', figureTitle: '明成祖', dynasty: 'ming', dynastyName: '明',
      pattern: 'HHH-LMH-HMM',
      title: '朱棣式永乐雄主', intro: '你胆识过人，敢破旧局，是开疆拓土的雄主。',
      desc: '你如明成祖朱棣，起于藩王而定鼎天下。面对朝堂党争（第1题），你倾向以制衡手腕重整局面；面对国库空虚（第5题），你更看重能支撑远略的制度安排。你有强烈的行动力，也有经营大局的耐心，适合在动荡中重塑秩序。',
      bio: '朱棣，明太祖第四子。靖难之后即位，年号永乐。在位期间迁都北京、修《永乐大典》、遣郑和下西洋，并多次北征，塑造明代前期强盛格局。',
      quote: '天下不可一日无主。',
      reasons: ['你在关键题中表现出强势破局的倾向', '你重视制度与威望并用，接近永乐朝的治理风格', '你能在复杂局面中快速夺回主动权'],
      radar: { 谋略: 92, 魄力: 96, 文采: 78, 隐忍: 82, 果断: 94, 包容: 68 },
      themeColor: '#8B1A1A', bgStart: '#8B1A1A', bgEnd: '#4A1010'
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
      tag: 'WangWei', figureId: 'wangwei', figureName: '王维', figureTitle: '诗佛', dynasty: 'tang', dynastyName: '唐',
      pattern: 'MM-MM-MMM',
      title: '王维式空山清远', intro: '你安静澄明，诗心含蓄，是山水之间的清音。',
      desc: '你如诗佛王维，诗中有画，画中有诗。面对壮丽山河（第2题），你不急于高声赞叹，而更愿把山水化成心境；人生失意时（第5题），你能退一步看风月流转。你的诗魂不在激烈处，而在静水深流处。',
      bio: '王维，字摩诘，唐代诗人、画家。精通诗、书、画、乐，山水田园诗成就极高，与孟浩然并称"王孟"，有"诗佛"之称。',
      quote: '行到水穷处，坐看云起时。',
      reasons: ['你在多题中表现出含蓄、平衡、留白的气质', '你不执着于激烈表达，更接近王维山水诗中的澄明', '你兼具才情与旷达，适合安放在诗佛一路'],
      radar: { 才情: 92, 豪放: 65, 婉约: 82, 旷达: 88, 浪漫: 72 },
      themeColor: '#4F7A5A', bgStart: '#4F7A5A', bgEnd: '#2F4F3A'
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
      tag: 'LiJing', figureId: 'lijing', figureName: '李靖', figureTitle: '卫国公', dynasty: 'tang', dynastyName: '唐',
      pattern: 'MM-MM-MMM',
      title: '李靖式沉稳名将', intro: '你谋勇兼备，出手稳准，是能定大局的统帅。',
      desc: '你如唐代名将李靖，既懂兵法，也能临阵决断。两军对垒（第1题），你不一定只凭血勇，而会判断地形、军心与时机；功成身退（第8题），你也懂得收敛锋芒。你的武将人格更接近稳健统帅，而不是单纯猛将。',
      bio: '李靖，唐初军事家，封卫国公。参与平定萧铣、辅公祏，后北破东突厥，南平吐谷浑，是唐代开国与扩张时期的重要名将。',
      quote: '兵贵神速，亦贵审势。',
      reasons: ['你在战场题中表现出谋略与稳健并重', '你能在进取和收束之间保持平衡', '你不是单纯冲锋型，更接近统帅型名将'],
      radar: { 勇: 82, 谋: 95, 忠: 88, 义: 82, 烈: 75, 稳: 95 },
      themeColor: '#345A6F', bgStart: '#345A6F', bgEnd: '#1D3442'
    }
  ],
  strategist: [
    {
      tag: 'ZhuGeLiang', figureId: 'zhugeliang', figureName: '诸葛亮', figureTitle: '卧龙', dynasty: 'sanguo', dynastyName: '三国·蜀',
      pattern: 'HHH-HHH',
      title: '诸葛亮式经世辅政', intro: '你审势深远，忠诚持重，是能托付天下的谋士。',
      desc: '你如诸葛亮，既能隆中对定天下三分，也能出师北伐守一国根基。你不是单纯出奇谋的人，而是能把战略、制度、人才和责任连在一起的人。',
      bio: '诸葛亮，字孔明，三国蜀汉丞相。辅佐刘备、刘禅，提出隆中对，治理蜀汉，北伐中原，是中国谋臣与辅政者形象的代表。',
      quote: '鞠躬尽瘁，死而后已。',
      reasons: ['你重视大势判断与长期治理', '你对辅佐对象有强烈责任感', '你能把谋略落到制度与执行上'],
      radar: { 奇谋: 92, 审势: 98, 忍耐: 90, 忠诚: 100, 格局: 96 },
      themeColor: '#4A5F7A', bgStart: '#4A5F7A', bgEnd: '#26384D'
    },
    {
      tag: 'ZhangLiang', figureId: 'zhangliang', figureName: '张良', figureTitle: '留侯', dynasty: 'han', dynastyName: '西汉',
      pattern: 'HHM-HMM',
      title: '张良式运筹帷幄', intro: '你善看大势，懂得借力，是决胜千里的谋士。',
      desc: '你如留侯张良，不以力争，而以势取。你擅长判断关键节点，知道何时进、何时退、何时借他人之力完成布局。',
      bio: '张良，字子房，汉初三杰之一。辅佐刘邦灭秦破楚，善谋略，功成后明哲保身。',
      quote: '运筹帷幄之中，决胜千里之外。',
      reasons: ['你偏好先看天下形势再落子', '你能用联盟与时机改变局面', '你有功成身退的清醒'],
      radar: { 奇谋: 95, 审势: 96, 忍耐: 86, 忠诚: 82, 格局: 90 },
      themeColor: '#6A5B8A', bgStart: '#6A5B8A', bgEnd: '#362C4D'
    },
    {
      tag: 'XiaoHe', figureId: 'xiaohe', figureName: '萧何', figureTitle: '酂文终侯', dynasty: 'han', dynastyName: '西汉',
      pattern: 'MML-HHH',
      title: '萧何式安邦定国', intro: '你不炫奇谋，却能稳住根本，是后方定海针。',
      desc: '你如萧何，懂得粮草、法度、人才和后方秩序的重要。你的力量不在惊险一击，而在让大局不崩。',
      bio: '萧何，汉初三杰之一。辅佐刘邦，定律令、守关中、荐韩信，为汉朝建立提供制度与后勤支撑。',
      quote: '镇国家，抚百姓，给馈饷，不绝粮道。',
      reasons: ['你更重视制度和后方根基', '你擅长补足团队最需要的能力', '你能让复杂局面保持稳定运行'],
      radar: { 奇谋: 70, 审势: 88, 忍耐: 84, 忠诚: 94, 格局: 98 },
      themeColor: '#586B4F', bgStart: '#586B4F', bgEnd: '#2D3D29'
    },
    {
      tag: 'SimaYi', figureId: 'simayi', figureName: '司马懿', figureTitle: '晋宣帝', dynasty: 'sanguo', dynastyName: '三国·魏',
      pattern: 'MLH-LMM',
      title: '司马懿式深藏不露', intro: '你耐心极强，善于等待，是笑到最后的谋者。',
      desc: '你如司马懿，能忍一时之辱，也能抓住最终窗口。你不急于证明自己，更重视在关键时刻完成翻盘。',
      bio: '司马懿，三国时期魏国重臣、军事家、政治家。长期隐忍经营，晚年发动高平陵之变，为司马氏代魏奠定基础。',
      quote: '忍常人所不能忍，成常人所不能成。',
      reasons: ['你擅长等待时机', '你不会轻易暴露真实意图', '你更看重最终胜势而非一时名声'],
      radar: { 奇谋: 84, 审势: 92, 忍耐: 100, 忠诚: 55, 格局: 88 },
      themeColor: '#3F4654', bgStart: '#3F4654', bgEnd: '#1F232B'
    },
    {
      tag: 'GuoJia', figureId: 'guojia', figureName: '郭嘉', figureTitle: '奉孝', dynasty: 'sanguo', dynastyName: '东汉末',
      pattern: 'HHM-LML',
      title: '郭嘉式奇策洞察', intro: '你眼光犀利，善断人心，是出奇制胜的谋士。',
      desc: '你如郭嘉，善于从人性与局势缝隙中找到破局点。你的计策未必最稳，却常常直击要害。',
      bio: '郭嘉，字奉孝，曹操重要谋士。以洞察局势、判断人物著称，对曹操统一北方贡献很大。',
      quote: '兵贵神速，谋贵识人。',
      reasons: ['你偏好出其不意的破局方式', '你很会判断对手心理', '你更在意关键一击而非长期经营'],
      radar: { 奇谋: 100, 审势: 92, 忍耐: 70, 忠诚: 78, 格局: 76 },
      themeColor: '#6B4F7A', bgStart: '#6B4F7A', bgEnd: '#382447'
    },
    {
      tag: 'LiuBowen', figureId: 'liubowen', figureName: '刘伯温', figureTitle: '诚意伯', dynasty: 'ming', dynastyName: '明',
      pattern: 'MHH-MHM',
      title: '刘伯温式洞明大势', intro: '你善识天时人事，能在乱局中看见秩序。',
      desc: '你如刘伯温，既有谋略，也懂制度与人心。你适合在混乱中找到方向，并把方向转成可执行的方案。',
      bio: '刘基，字伯温，明初谋臣、文学家。辅佐朱元璋建立明朝，封诚意伯，后世常称刘伯温。',
      quote: '知机者善谋，善谋者成事。',
      reasons: ['你能看出局势背后的运行规律', '你兼具谋略与经世视野', '你在进退之间保持谨慎'],
      radar: { 奇谋: 88, 审势: 96, 忍耐: 82, 忠诚: 78, 格局: 92 },
      themeColor: '#5E6B48', bgStart: '#5E6B48', bgEnd: '#303A24'
    }
  ],
  historian: [
    {
      tag: 'SimaQian', figureId: 'simaqian', figureName: '司马迁', figureTitle: '太史公', dynasty: 'han', dynastyName: '西汉',
      pattern: 'HHH-HHH',
      title: '司马迁式究天通变', intro: '你有直笔之胆，也有承受命运重压的韧性。',
      desc: '你如司马迁，能把个人痛苦转化成历史书写。你重视人物命运，也重视时代变化的深层逻辑。',
      bio: '司马迁，字子长，西汉史学家、文学家。著《史记》，开创纪传体通史传统。',
      quote: '究天人之际，通古今之变，成一家之言。',
      reasons: ['你在真相与权势之间更倾向直笔', '你重视人物命运的复杂性', '你有把挫折转化为作品的韧性'],
      radar: { 直笔: 96, 考据: 90, 文采: 100, 经世: 88, 韧性: 100 },
      themeColor: '#6D4C41', bgStart: '#6D4C41', bgEnd: '#3A241D'
    },
    {
      tag: 'BanGu', figureId: 'banggu', figureName: '班固', figureTitle: '兰台令史', dynasty: 'han', dynastyName: '东汉',
      pattern: 'MHM-MHM',
      title: '班固式典雅断代', intro: '你重结构、重体例，擅长把一代历史写得严整。',
      desc: '你如班固，讲究体例完备与材料组织。你适合做系统性整理，把复杂事实纳入清楚框架。',
      bio: '班固，东汉史学家、文学家，撰《汉书》，开创纪传体断代史体例。',
      quote: '述而有体，断代成书。',
      reasons: ['你重视史料结构和体例', '你能在庞杂材料中建立秩序', '你的表达更偏典雅严整'],
      radar: { 直笔: 82, 考据: 96, 文采: 88, 经世: 82, 韧性: 86 },
      themeColor: '#735C42', bgStart: '#735C42', bgEnd: '#3D2D1D'
    },
    {
      tag: 'SimaGuang', figureId: 'simaguang', figureName: '司马光', figureTitle: '温国文正公', dynasty: 'song', dynastyName: '北宋',
      pattern: 'MMH-HMM',
      title: '司马光式通鉴治世', intro: '你读史为鉴，关注兴衰得失与现实治理。',
      desc: '你如司马光，写史不是只为记事，更是为了给现实提供镜鉴。你重视制度、君臣、成败之间的因果。',
      bio: '司马光，北宋政治家、史学家，主持编纂《资治通鉴》。',
      quote: '鉴前世之兴衰，考当今之得失。',
      reasons: ['你最看重历史对治理的借鉴', '你善于从事件中抽出因果', '你表达克制但判断明确'],
      radar: { 直笔: 86, 考据: 92, 文采: 78, 经世: 100, 韧性: 82 },
      themeColor: '#4F5E6D', bgStart: '#4F5E6D', bgEnd: '#28323D'
    },
    {
      tag: 'ChenShou', figureId: 'chenshou', figureName: '陈寿', figureTitle: '史官', dynasty: 'jin', dynastyName: '西晋',
      pattern: 'MML-MMH',
      title: '陈寿式冷静取舍', intro: '你克制审慎，能在复杂立场中保持叙事平衡。',
      desc: '你如陈寿，面对三国旧事，懂得取舍与分寸。你不追求情绪爆发，而追求相对稳妥的历史判断。',
      bio: '陈寿，西晋史学家，著《三国志》，为研究三国历史的重要史籍。',
      quote: '据事直书，慎于褒贬。',
      reasons: ['你写史重视材料取舍', '你能在复杂人物间保持克制', '你偏向冷静记录而非激烈评断'],
      radar: { 直笔: 84, 考据: 86, 文采: 72, 经世: 78, 韧性: 88 },
      themeColor: '#5C5A4A', bgStart: '#5C5A4A', bgEnd: '#303027'
    },
    {
      tag: 'LiuZhiji', figureId: 'liuzhiji', figureName: '刘知几', figureTitle: '史通作者', dynasty: 'tang', dynastyName: '唐',
      pattern: 'HHM-MMM',
      title: '刘知几式史识批判', intro: '你重史法，也敢批评旧说，是有方法意识的史家。',
      desc: '你如刘知几，不满足于照抄材料，而会追问史书怎样写才可信。你重视史学方法、判断与批判。',
      bio: '刘知几，唐代史学家，著《史通》，是中国古代重要的史学理论著作。',
      quote: '史贵实录，亦贵识断。',
      reasons: ['你对材料真伪很敏感', '你愿意批评不合理旧说', '你重视写史的方法和标准'],
      radar: { 直笔: 92, 考据: 95, 文采: 78, 经世: 76, 韧性: 80 },
      themeColor: '#665A73', bgStart: '#665A73', bgEnd: '#332B40'
    },
    {
      tag: 'DuYou', figureId: 'duyou', figureName: '杜佑', figureTitle: '通典作者', dynasty: 'tang', dynastyName: '唐',
      pattern: 'MHH-HML',
      title: '杜佑式制度通观', intro: '你关注制度沿革，擅长从典章中看见国家运行。',
      desc: '你如杜佑，写史更重制度和经世实用。你会追问一项制度为什么出现、如何变化、对现实有什么用。',
      bio: '杜佑，唐代政治家、史学家，著《通典》，开创典章制度通史的重要传统。',
      quote: '通古今之制，明治乱之由。',
      reasons: ['你重视制度背景而非只看故事', '你读史带有现实治理意识', '你适合做系统性归纳'],
      radar: { 直笔: 78, 考据: 94, 文采: 76, 经世: 96, 韧性: 72 },
      themeColor: '#596B5C', bgStart: '#596B5C', bgEnd: '#2C3A2E'
    }
  ],
  hero: [
    {
      tag: 'CaoCao', figureId: 'caocao', figureName: '曹操', figureTitle: '魏武帝', dynasty: 'sanguo', dynastyName: '东汉末',
      pattern: 'HHM-HHH',
      title: '曹操式乱世枭雄', intro: '你务实果断，善用人才，是能在乱世重塑秩序的人。',
      desc: '你如曹操，挟乱世而起，以能力和制度聚合人才。你不是皇帝题里的帝王，而是乱世格局中的雄主型人物。',
      bio: '曹操，字孟德，东汉末政治家、军事家、文学家。统一北方，奠定曹魏基础，后被追尊为魏武帝。',
      quote: '周公吐哺，天下归心。',
      reasons: ['你重视人才和主动权', '你敢在强敌面前寻找破局点', '你有统一乱局的雄心和手腕'],
      radar: { 雄心: 96, 仁义: 68, 谋断: 95, 用人: 96, 霸气: 92 },
      themeColor: '#2F4F4F', bgStart: '#2F4F4F', bgEnd: '#1A1A1A'
    },
    {
      tag: 'LiuBei', figureId: 'liubei', figureName: '刘备', figureTitle: '昭烈帝', dynasty: 'sanguo', dynastyName: '三国·蜀',
      pattern: 'MHH-MMM',
      title: '刘备式仁义聚众', intro: '你重情义、重人心，擅长让人愿意同行。',
      desc: '你如刘备，虽起点艰难，却能凭仁义与识人聚起一支队伍。你的优势不在威压，而在凝聚。',
      bio: '刘备，字玄德，蜀汉开国皇帝。以仁义和用人著称，与关羽、张飞桃园结义，三顾茅庐请诸葛亮。',
      quote: '勿以善小而不为，勿以恶小而为之。',
      reasons: ['你重视部下情义', '你更愿以人心和名义聚众', '你能在低谷中坚持理想'],
      radar: { 雄心: 85, 仁义: 100, 谋断: 78, 用人: 95, 霸气: 72 },
      themeColor: '#356B45', bgStart: '#356B45', bgEnd: '#1C3A25'
    },
    {
      tag: 'SunQuan', figureId: 'sunquan', figureName: '孙权', figureTitle: '吴大帝', dynasty: 'sanguo', dynastyName: '三国·吴',
      pattern: 'MMM-HMM',
      title: '孙权式守成制衡', intro: '你稳健审慎，懂得用人制衡，是守住一方的雄主。',
      desc: '你如孙权，能在强敌环伺下守住江东，也能在不同派系中维持平衡。你不轻易冒进，但懂得抓住关键战机。',
      bio: '孙权，字仲谋，三国吴国建立者。承父兄基业，联合刘备赢得赤壁之战，长期经营江东。',
      quote: '能用众力，则无敌于天下。',
      reasons: ['你重视稳固根据地', '你擅长平衡人才和派系', '你不会轻易做孤注一掷的选择'],
      radar: { 雄心: 82, 仁义: 78, 谋断: 84, 用人: 92, 霸气: 76 },
      themeColor: '#3D6F7A', bgStart: '#3D6F7A', bgEnd: '#1E3C44'
    },
    {
      tag: 'XiangYuHero', figureId: 'xiangyu', figureName: '项羽', figureTitle: '西楚霸王', dynasty: 'chuhan', dynastyName: '秦末·楚',
      pattern: 'MHL-HHL',
      title: '项羽式霸者锋芒', intro: '你锋芒极盛，敢打硬仗，是震慑天下的霸者。',
      desc: '你如项羽，重情重义，也极具压迫感。你能打出让天下震动的胜利，但也需要警惕过度依赖个人锋芒。',
      bio: '项羽，秦末起义军领袖，巨鹿之战破釜沉舟，后自立西楚霸王，与刘邦争天下。',
      quote: '力拔山兮气盖世。',
      reasons: ['你面对强敌时更愿主动决战', '你重视情义和威势', '你有强烈的霸者气场'],
      radar: { 雄心: 90, 仁义: 85, 谋断: 70, 用人: 72, 霸气: 100 },
      themeColor: '#8B0000', bgStart: '#8B0000', bgEnd: '#3A0000'
    },
    {
      tag: 'YuanShao', figureId: 'yuanshao', figureName: '袁绍', figureTitle: '大将军', dynasty: 'donghan', dynastyName: '东汉末',
      pattern: 'MLM-MML',
      title: '袁绍式门阀雄心', intro: '你资源雄厚，讲究名望，但关键时刻容易犹疑。',
      desc: '你如袁绍，起点高、声望盛，能聚合一方豪杰。你的课题是把资源优势转化成真正果断的胜势。',
      bio: '袁绍，东汉末群雄之一，出身汝南袁氏，曾据河北，与曹操官渡决战失利。',
      quote: '势大者未必胜，善断者方能成。',
      reasons: ['你重视名望和资源积累', '你倾向稳健而非冒险', '你需要提升关键时刻的决断力'],
      radar: { 雄心: 86, 仁义: 70, 谋断: 68, 用人: 82, 霸气: 78 },
      themeColor: '#7A6142', bgStart: '#7A6142', bgEnd: '#3D2D1B'
    },
    {
      tag: 'ChenSheng', figureId: 'chensheng', figureName: '陈胜', figureTitle: '张楚王', dynasty: 'qin', dynastyName: '秦末',
      pattern: 'LMH-LLH',
      title: '陈胜式揭竿而起', intro: '你不甘命运压迫，敢第一个喊出改变。',
      desc: '你如陈胜，未必拥有最完整的资源，却有点燃局势的勇气。你的力量在于打破沉默、率先行动。',
      bio: '陈胜，秦末农民起义领袖，与吴广发动大泽乡起义，建立张楚政权。',
      quote: '王侯将相宁有种乎。',
      reasons: ['你有不甘现状的强烈雄心', '你能在压迫中率先行动', '你更像点火者而非守成者'],
      radar: { 雄心: 92, 仁义: 66, 谋断: 62, 用人: 65, 霸气: 88 },
      themeColor: '#7A4A2F', bgStart: '#7A4A2F', bgEnd: '#3A2115'
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
const SEED_VERSION = 7

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
      case 'admin-quiz-list': {
        await checkAdmin(OPENID)
        return await adminQuizList(OPENID, data)
      }
      case 'admin-update-quiz-cover': {
        await checkAdmin(OPENID)
        return await adminUpdateQuizCover(OPENID, data)
      }
      case 'admin-figure-list': {
        await checkAdmin(OPENID)
        return await adminFigureList(OPENID, data)
      }
      case 'admin-update-figure-avatar': {
        await checkAdmin(OPENID)
        return await adminUpdateFigureAvatar(OPENID, data)
      }
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
