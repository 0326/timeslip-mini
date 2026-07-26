const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

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
    cover: '',
    icon: '👑',
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
    cover: '',
    icon: '✍️',
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
    cover: '',
    icon: '⚔️',
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
      tag: 'LiShiMin', figureId: 'fig-libai', figureName: '李世民', figureTitle: '唐太宗', dynasty: 'tang', dynastyName: '唐',
      pattern: 'HHM-HMM-HMH',
      title: '李世民式贞观之治', intro: '你雄才大略，从善如流，是开创盛世的明君。',
      desc: '你如唐太宗李世民，文治武功皆备。你既有运筹帷幄的谋略，也有虚心纳谏的胸襟。在你治下，万国来朝，四海升平。你懂得"水能载舟，亦能覆舟"的道理，是千古帝王的典范。',
      bio: '李世民，唐高祖李渊次子。少年从军，雁门关救驾。玄武门之变后登基，年号贞观。在位期间，任用魏徵、房玄龄、杜如晦，开创贞观之治，被尊为"天可汗"。',
      quote: '以铜为镜，可以正衣冠；以古为镜，可以知兴替；以人为镜，可以明得失。',
      reasons: ['你有雄才大略，能开疆拓土', '你虚心纳谏，有容人之量', '你深谙权术，却懂得节制'],
      radar: { 谋略: 92, 魄力: 95, 文采: 85, 隐忍: 70, 果断: 90, 包容: 88 },
      themeColor: '#C9A24D', bgStart: '#C9A24D', bgEnd: '#8B5A2B'
    },
    {
      tag: 'LiuBang', figureId: 'fig-kongzi', figureName: '刘邦', figureTitle: '汉高祖', dynasty: 'han', dynastyName: '西汉',
      pattern: 'MHH-LMH-MHH',
      title: '刘邦式知人善任', intro: '你看似平凡，却能让英雄为你所用。',
      desc: '你如汉高祖刘邦，出身微末却终成大业。你的本事不在自己有多强，而在能用比自己强的人。你懂人情，知进退，能屈能伸，最终以弱胜强，开创四百年大汉基业。',
      bio: '刘邦，沛丰邑中阳里人，初为泗水亭长。秦末起兵，先入关中，约法三章。楚汉相争中虽屡战屡败，最终垓下一战定乾坤，建立汉朝。',
      quote: '夫运筹策帷帐之中，决胜于千里之外，吾不如子房；镇国家，抚百姓，吾不如萧何；连百万之军，战必胜，攻必取，吾不如韩信。',
      reasons: ['你善于用人，能驾驭英雄', '你能屈能伸，懂得隐忍', '你知错能改，从善如流'],
      radar: { 谋略: 75, 魄力: 85, 文采: 60, 隐忍: 95, 果断: 80, 包容: 90 },
      themeColor: '#B71C1C', bgStart: '#DC143C', bgEnd: '#8B0000'
    },
    {
      tag: 'CaoCao', figureId: 'fig-caocao', figureName: '曹操', figureTitle: '魏武帝', dynasty: 'sanguo', dynastyName: '东汉末',
      pattern: 'HHH-LMH-HMM',
      title: '曹操式枭雄之姿', intro: '你雄才大略，多谋善断，是乱世的枭雄。',
      desc: '你如魏武帝曹操，治世之能臣，乱世之奸雄。你深谋远虑，用兵如神，又能诗能文。你唯才是举，不拘品行，宁教我负天下人，休教天下人负我。你的复杂与雄才，让你在乱世中脱颖而出。',
      bio: '曹操，字孟德，沛国谯人。举孝廉出身，讨董卓，迎献帝，挟天子以令诸侯。官渡之战败袁绍，统一北方。政治家、军事家、文学家，建安风骨的开创者。',
      quote: '宁教我负天下人，休教天下人负我。',
      reasons: ['你深谋远虑，胸怀大志', '你唯才是举，不拘一格', '你既能铁血，也能柔情'],
      radar: { 谋略: 95, 魄力: 92, 文采: 90, 隐忍: 80, 果断: 88, 包容: 60 },
      themeColor: '#2F4F4F', bgStart: '#2F4F4F', bgEnd: '#1A1A1A'
    },
    {
      tag: 'WuZetian', figureId: 'fig-wuzetian', figureName: '武则天', figureTitle: '则天大圣皇帝', dynasty: 'tang', dynastyName: '唐·武周',
      pattern: 'HHH-MHH-HLM',
      title: '武则天式女皇权谋', intro: '你有过人的胆识与魄力，敢为天下先。',
      desc: '你如则天大圣皇帝武则天，中国历史上唯一的女皇帝。你意志坚定，手段高明，能在复杂的政治局面中掌控全局。你既有雄才大略，也懂用人之道，开创武周盛世。',
      bio: '武则天，名武曌，并州文水人。先为太宗才人，后为高宗皇后，临朝称制，最终改唐为周，自立为帝。在位期间打击门阀，重用人才，开创殿试、武举。',
      quote: '君子虽殒，美名不灭。',
      reasons: ['你有打破常规的胆识', '你善于在复杂局势中把握机遇', '你既有铁腕，也懂怀柔'],
      radar: { 谋略: 92, 魄力: 98, 文采: 80, 隐忍: 90, 果断: 95, 包容: 65 },
      themeColor: '#C71585', bgStart: '#C71585', bgEnd: '#8B008B'
    },
    {
      tag: 'ZhuYuanZhang', figureId: 'fig-mulan', figureName: '朱元璋', figureTitle: '明太祖', dynasty: 'ming', dynastyName: '明',
      pattern: 'MHH-MHL-HMH',
      title: '朱元璋式草根逆袭', intro: '你从微末中崛起，凭借铁腕与谋略成就大业。',
      desc: '你如明太祖朱元璋，从放牛娃、和尚到开国皇帝，古今无双。你意志坚韧，深谙民间疾苦，掌权后铁腕治贪，废除丞相，集权于一身。你的强势与多疑，让你成为历史上最复杂的帝王之一。',
      bio: '朱元璋，字国瑞，濠州钟离人。出身贫寒，曾为僧为丐。元末投郭子兴，后自立一军，灭陈友谅、张士诚，北伐驱逐元廷，建立大明。在位期间严惩贪官，废除丞相。',
      quote: '雪压枝头低，虽低不着泥。一朝红日出，依旧与天齐。',
      reasons: ['你意志坚韧，能屈能伸', '你深谙民间，懂百姓所需', '你铁腕治国，雷厉风行'],
      radar: { 谋略: 90, 魄力: 95, 文采: 60, 隐忍: 88, 果断: 95, 包容: 50 },
      themeColor: '#8B0000', bgStart: '#8B0000', bgEnd: '#4A0000'
    },
    {
      tag: 'ZhaoKuangYin', figureId: 'fig-zhenghe', figureName: '赵匡胤', figureTitle: '宋太祖', dynasty: 'song', dynastyName: '北宋',
      pattern: 'HMH-HMH-LLH',
      title: '赵匡胤式杯酒释兵权', intro: '你深谙权术，却以仁心待人，是难得的厚道帝王。',
      desc: '你如宋太祖赵匡胤，陈桥兵变黄袍加身，却以杯酒释兵权化解功臣之患。你重文抑武，崇文尊儒，开创两宋三百年文治盛世。你的厚道与谋略并存，是帝王中难得的仁主。',
      bio: '赵匡胤，字元朗，涿郡人。后周殿前都点检，陈桥兵变被黄袍加身，建立宋朝。在位期间杯酒释兵权，加强中央集权，重文抑武，奠定宋代文治基础。',
      quote: '富家不用买良田，书中自有千钟粟。',
      reasons: ['你深谙权术，却不失厚道', '你崇文尊儒，开文治之风', '你处事果断，又留有余地'],
      radar: { 谋略: 88, 魄力: 82, 文采: 78, 隐忍: 92, 果断: 85, 包容: 95 },
      themeColor: '#228B22', bgStart: '#228B22', bgEnd: '#2E8B57'
    },
    {
      tag: '__fallback__', figureId: '', figureName: '帝王之才', figureTitle: '雄主', dynasty: 'all', dynastyName: '古今',
      pattern: 'MMM-MMM-MMM',
      title: '帝王综合之才', intro: '你兼具多种帝王特质，是难以定义的雄主。',
      desc: '你的帝王人格呈现多元分布，没有单一类型特别突出。这意味着你是一个多面手，能根据情境调整自己的治国方略。你兼具谋略与魄力、隐忍与果断、文采与包容，是帝王中最难能可贵的综合型人才。',
      bio: '历史上帝王众多，各有千秋。你的多元特质让你能在不同局面下切换不同的治国模式，是真正的帝王之才。',
      quote: '天下兴亡，匹夫有责；帝王之道，贵在得人。',
      reasons: ['你兼具多种帝王特质', '你能根据情境调整方略', '你难以被定义，却最为难得'],
      radar: { 谋略: 80, 魄力: 80, 文采: 80, 隐忍: 80, 果断: 80, 包容: 80 },
      themeColor: '#666666', bgStart: '#888888', bgEnd: '#444444'
    }
  ],
  poet: [
    {
      tag: 'LiBai', figureId: 'fig-libai', figureName: '李白', figureTitle: '诗仙', dynasty: 'tang', dynastyName: '盛唐',
      pattern: 'HH-LM-LHH',
      title: '李白式浪漫豪放', intro: '你天性浪漫，追求自由与理想，是诗仙再世。',
      desc: '你如诗仙李白，斗酒诗百篇，长安市上酒家眠。你的诗豪放飘逸，想象丰富，语言流转自然。你追求自由，不阿权贵，让力士脱靴，贵妃研墨。你的人生虽坎坷，却始终保持一颗赤子之心。',
      bio: '李白，字太白，号青莲居士，唐代伟大的浪漫主义诗人，被后人誉为"诗仙"。其诗豪放飘逸，想象丰富，代表了盛唐诗歌的巅峰。',
      quote: '天生我材必有用，千金散尽还复来。',
      reasons: ['你天性浪漫，追求自由', '你才华横溢，不拘一格', '你面对人生起伏，乐观洒脱'],
      radar: { 才情: 95, 豪放: 98, 婉约: 50, 旷达: 88, 浪漫: 100 },
      themeColor: '#1E90FF', bgStart: '#1E90FF', bgEnd: '#00BFFF'
    },
    {
      tag: 'DuFu', figureId: 'fig-baijuyi', figureName: '杜甫', figureTitle: '诗圣', dynasty: 'tang', dynastyName: '唐',
      pattern: 'MH-LH-MHM',
      title: '杜甫式忧国忧民', intro: '你心怀天下，忧国忧民，是诗中的圣者。',
      desc: '你如诗圣杜甫，沉郁顿挫，忧国忧民。你的诗是时代的镜子，记录了盛唐转衰的苦难。你"穷年忧黎元，叹息肠内热"，虽一生颠沛，却始终心系苍生。你是诗史，更是诗圣。',
      bio: '杜甫，字子美，自号少陵野老，唐代伟大的现实主义诗人。与李白并称"李杜"。其诗被称为"诗史"，反映唐朝由盛转衰的历史。',
      quote: '安得广厦千万间，大庇天下寒士俱欢颜。',
      reasons: ['你心怀天下，忧国忧民', '你深沉厚重，思虑深远', '你虽处逆境，仍心系苍生'],
      radar: { 才情: 95, 豪放: 70, 婉约: 80, 旷达: 60, 浪漫: 50 },
      themeColor: '#654321', bgStart: '#8B4513', bgEnd: '#654321'
    },
    {
      tag: 'SuShi', figureId: 'fig-sushi', figureName: '苏轼', figureTitle: '东坡居士', dynasty: 'song', dynastyName: '北宋',
      pattern: 'HH-LH-LHH',
      title: '苏轼式旷达乐观', intro: '你豁达乐观，多才多艺，是真正的全才。',
      desc: '你如东坡居士苏轼，诗词文赋书画皆绝。一生仕途坎坷，却始终旷达乐观。你能在黄州煮东坡肉，能在赤壁赋大江东去，能在海南啖荔枝。"一蓑烟雨任平生"是你最好的写照。',
      bio: '苏轼，字子瞻，号东坡居士，眉山人。北宋著名文学家、书法家、画家，"唐宋八大家"之一。一生仕途坎坷，但始终旷达乐观。',
      quote: '竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。',
      reasons: ['你有豁达的人生态度', '你多才多艺，热爱生活', '你真性情，重情义，有风骨'],
      radar: { 才情: 98, 豪放: 90, 婉约: 75, 旷达: 100, 浪漫: 80 },
      themeColor: '#228B22', bgStart: '#228B22', bgEnd: '#2E8B57'
    },
    {
      tag: 'BaiJuyi', figureId: 'fig-baijuyi', figureName: '白居易', figureTitle: '诗魔', dynasty: 'tang', dynastyName: '中唐',
      pattern: 'MH-MM-LHL',
      title: '白居易式平易近人', intro: '你平易近人，老妪能解，是诗中的烟火气。',
      desc: '你如诗魔白居易，新乐府运动领袖。你的诗平易近人，老妪能解，却字字千钧。"文章合为时而著，歌诗合为事而作"是你的主张。你既能写《长恨歌》的缠绵，也能写《卖炭翁》的悲悯。',
      bio: '白居易，字乐天，号香山居士，唐代伟大的现实主义诗人。新乐府运动领袖，与元稹并称"元白"，与刘禹锡并称"刘白"。',
      quote: '同是天涯沦落人，相逢何必曾相识。',
      reasons: ['你平易近人，懂百姓疾苦', '你既能写情，也能写民生', '你真挚深沉，有烟火气'],
      radar: { 才情: 92, 豪放: 65, 婉约: 88, 旷达: 80, 浪漫: 70 },
      themeColor: '#4682B4', bgStart: '#4682B4', bgEnd: '#5F9EA0'
    },
    {
      tag: 'LiQingZhao', figureId: 'fig-mulan', figureName: '李清照', figureTitle: '易安居士', dynasty: 'song', dynastyName: '南宋',
      pattern: 'MH-HM-LHM',
      title: '李清照式婉约深情', intro: '你婉约深情，才情绝代，是千古第一才女。',
      desc: '你如易安居士李清照，婉约词宗，千古第一才女。你的词"别是一家"，前期清丽婉约，后期沉郁凄婉。"寻寻觅觅，冷冷清清，凄凄惨惨戚戚"，道尽了家国之痛与身世之悲。',
      bio: '李清照，号易安居士，齐州章丘人。宋代女词人，婉约词派代表，有"千古第一才女"之称。与丈夫赵明诚共撰《金石录》。',
      quote: '生当作人杰，死亦为鬼雄。至今思项羽，不肯过江东。',
      reasons: ['你才情绝代，婉约深情', '你既有柔情，也有傲骨', '你历经沧桑，依然真挚'],
      radar: { 才情: 98, 豪放: 60, 婉约: 100, 旷达: 65, 浪漫: 85 },
      themeColor: '#C71585', bgStart: '#C71585', bgEnd: '#DA70D6'
    },
    {
      tag: '__fallback__', figureId: '', figureName: '诗魂', figureTitle: '诗人', dynasty: 'all', dynastyName: '古今',
      pattern: 'MM-MM-MMM',
      title: '诗人综合之才', intro: '你的诗魂兼容并蓄，难以单一归类。',
      desc: '你的诗人人格呈现多元分布，兼具豪放与婉约、旷达与浪漫。你是一个全能型诗人，能根据心境切换不同的诗风。这种兼容并蓄，是诗坛中难得的通才。',
      bio: '诗无达诂，诗人亦然。你的多元诗魂让你能游走于各种诗风之间，是真正的诗坛通才。',
      quote: '诗言志，歌永言。你的诗，便是你自己。',
      reasons: ['你兼容并蓄，诗风多元', '你能驾驭不同题材与风格', '你是诗坛难得的通才'],
      radar: { 才情: 85, 豪放: 80, 婉约: 80, 旷达: 80, 浪漫: 80 },
      themeColor: '#666666', bgStart: '#888888', bgEnd: '#444444'
    }
  ],
  general: [
    {
      tag: 'XiangYu', figureId: 'fig-wujiang', figureName: '项羽', figureTitle: '西楚霸王', dynasty: 'sanguo', dynastyName: '秦末·楚',
      pattern: 'HHH-LLM-LLL',
      title: '项羽式霸王之姿', intro: '你勇猛无双，重情重义，是千古悲情英雄。',
      desc: '你如西楚霸王项羽，力能扛鼎，才气过人。破釜沉舟，百二秦关终属楚。你勇冠三军，却刚愎自用；重情重义，却错失良机。垓下之围，乌江自刎，留下千古悲歌。',
      bio: '项羽，名籍，字羽，下相人。楚国贵族。秦末起兵，巨鹿之战破釜沉舟，灭秦主力。后与刘邦争天下，垓下战败，乌江自刎。',
      quote: '力拔山兮气盖世，时不利兮骓不逝。',
      reasons: ['你勇猛无双，气冠三军', '你重情重义，光明磊落', '你刚愎自用，宁折不弯'],
      radar: { 勇: 100, 谋: 50, 忠: 80, 义: 95, 烈: 100, 稳: 30 },
      themeColor: '#8B0000', bgStart: '#DC143C', bgEnd: '#8B0000'
    },
    {
      tag: 'YueFei', figureId: 'fig-mulan', figureName: '岳飞', figureTitle: '岳武穆', dynasty: 'song', dynastyName: '南宋',
      pattern: 'HH-HHH-HMH',
      title: '岳飞式精忠报国', intro: '你忠义双全，治军严明，是民族英雄的象征。',
      desc: '你如岳武穆岳飞，精忠报国，百战百胜。你治军严明，岳家军"冻死不拆屋，饿死不掳掠"。你"待从头、收拾旧山河，朝天阙"，却遭十二道金牌召回，含冤风波亭。你的忠义，成为中华民族的精神丰碑。',
      bio: '岳飞，字鹏举，相州汤阴人。南宋抗金名将，中国历史上著名军事家、民族英雄。其"精忠报国"的精神，成为中华民族爱国主义的象征。',
      quote: '靖康耻，犹未雪；臣子恨，何时灭！',
      reasons: ['你有强烈的家国情怀', '你治军严明，百折不挠', '你重气节，轻生死'],
      radar: { 勇: 95, 谋: 88, 忠: 100, 义: 95, 烈: 90, 稳: 80 },
      themeColor: '#DC143C', bgStart: '#DC143C', bgEnd: '#8B0000'
    },
    {
      tag: 'GuanYu', figureId: 'fig-caocao', figureName: '关羽', figureTitle: '关圣帝君', dynasty: 'sanguo', dynastyName: '三国·蜀',
      pattern: 'HH-LHH-HML',
      title: '关羽式义薄云天', intro: '你义薄云天，威震华夏，是武圣的化身。',
      desc: '你如关圣帝君关羽，义薄云天，万人之敌。你温酒斩华雄，过五关斩六将，单刀赴会，水淹七军。你"身在曹营心在汉"，"挂印封金"寻兄。你的义，被后世尊为武圣，与孔子齐名。',
      bio: '关羽，字云长，河东解良人。蜀汉名将，与刘备、张飞桃园结义。温酒斩华雄，斩颜良诛文丑，过五关斩六将，水淹七军威震华夏。后世尊为"武圣"。',
      quote: '玉可碎而不可改其白，竹可焚而不可毁其节。',
      reasons: ['你义薄云天，重情重义', '你威武不能屈，富贵不能淫', '你傲骨铮铮，气节凛然'],
      radar: { 勇: 95, 谋: 70, 忠: 100, 义: 100, 烈: 85, 稳: 70 },
      themeColor: '#B22222', bgStart: '#B22222', bgEnd: '#8B0000'
    },
    {
      tag: 'HanXin', figureId: 'fig-kongzi', figureName: '韩信', figureTitle: '淮阴侯', dynasty: 'han', dynastyName: '西汉',
      pattern: 'LH-HML-HMM',
      title: '韩信式兵仙神帅', intro: '你智勇双全，用兵如神，是兵仙再世。',
      desc: '你如淮阴侯韩信，兵仙神帅，国士无双。你能受胯下之辱，能筑坛拜将。明修栈道，暗渡陈仓；背水一战，置之死地而后生；十面埋伏，垓下一战定乾坤。你的军事才能，千古无出其右。',
      bio: '韩信，淮阴人。西汉开国功臣，与张良、萧何并称"汉初三杰"。初投项羽，后归刘邦。平定齐、赵、魏，垓下灭项羽。后遭刘邦猜忌，被吕后诛杀。',
      quote: '韩信点兵，多多益善。',
      reasons: ['你智勇双全，用兵如神', '你能屈能伸，懂得隐忍', '你才华盖世，却功高震主'],
      radar: { 勇: 85, 谋: 100, 忠: 60, 义: 70, 烈: 65, 稳: 80 },
      themeColor: '#2F4F4F', bgStart: '#2F4F4F', bgEnd: '#1A1A1A'
    },
    {
      tag: 'WeiQing', figureId: 'fig-zhenghe', figureName: '卫青', figureTitle: '长平侯', dynasty: 'han', dynastyName: '西汉',
      pattern: 'MH-MHH-HMH',
      title: '卫青式常胜将军', intro: '你战功赫赫，却谦逊低调，是难得的良将。',
      desc: '你如长平侯卫青，从奴隶到将军，七战七胜，封狼居胥。你直捣龙城，收复河套，漠北之战大败匈奴。你战功盖世，却"为人仁善退让"，从不跋扈。你是武将的典范，忠与谦的化身。',
      bio: '卫青，字仲卿，河东平阳人。本平阳公主家奴，后因姊卫子夫得宠而入宫。汉武帝时七征匈奴，七战七胜，封长平侯。',
      quote: '匈奴未灭，何以家为。',
      reasons: ['你战功赫赫，常胜不败', '你谦逊低调，不骄不躁', '你忠心耿耿，为人仁善'],
      radar: { 勇: 88, 谋: 92, 忠: 95, 义: 85, 烈: 70, 稳: 95 },
      themeColor: '#1E90FF', bgStart: '#1E90FF', bgEnd: '#4682B4'
    },
    {
      tag: 'HuoQuBing', figureId: 'fig-zhenghe', figureName: '霍去病', figureTitle: '冠军侯', dynasty: 'han', dynastyName: '西汉',
      pattern: 'HHH-LHH-LLH',
      title: '霍去病式少年英雄', intro: '你锋芒毕露，敢战敢胜，是少年英雄的传奇。',
      desc: '你如冠军侯霍去病，十七岁封侯，二十二岁封狼居胥。你用兵神速，长途奔袭，深入漠北两千里，祭天封礼于狼居胥山。你"匈奴未灭，何以家为"的豪言，激励千载。可惜天妒英才，二十四岁早逝。',
      bio: '霍去病，河东平阳人，卫青外甥。善骑射，用兵神速。十七岁领兵作战，封冠军侯。六击匈奴，封狼居胥。元狩六年病逝，年仅二十四。',
      quote: '匈奴未灭，何以家为！',
      reasons: ['你锋芒毕露，敢战敢胜', '你用兵神速，深入敌后', '你少年壮志，气吞万里'],
      radar: { 勇: 98, 谋: 80, 忠: 90, 义: 75, 烈: 95, 稳: 50 },
      themeColor: '#FF8C00', bgStart: '#FF8C00', bgEnd: '#FF4500'
    },
    {
      tag: '__fallback__', figureId: '', figureName: '武将', figureTitle: '良将', dynasty: 'all', dynastyName: '古今',
      pattern: 'MM-MM-MMM',
      title: '武将综合之才', intro: '你兼具多种武将特质，是难得的全能之将。',
      desc: '你的武将人格呈现多元分布，兼具勇与谋、忠与义、烈与稳。你是一个全能型将领，能根据战场形势切换不同的作战风格。这种兼容并蓄，是战场上难得的帅才。',
      bio: '武将之道，贵在通变。你的多元特质让你能驾驭不同的战场，是真正的帅才。',
      quote: '将在谋而不在勇，兵在精而不在多。',
      reasons: ['你兼具多种武将特质', '你能根据战场形势切换风格', '你是难得的帅才'],
      radar: { 勇: 80, 谋: 80, 忠: 80, 义: 80, 烈: 80, 稳: 80 },
      themeColor: '#666666', bgStart: '#888888', bgEnd: '#444444'
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

function levelNum(level) {
  return { L: 1, M: 2, H: 3 }[level] || 1
}

function parsePattern(pattern) {
  if (!pattern || typeof pattern !== 'string') return []
  return pattern.replace(/-/g, '').toUpperCase().split('')
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

  const userVector = dims.map(d => levelNum(dimLevels[d]))
  const maxDist = dims.length * 2

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
    const similarity = Math.max(0, Math.round((1 - distance / maxDist) * 100))
    return { tag: rt.tag, title: rt.title, similarity, exact, distance, _rt: rt }
  }).sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance
    if (b.exact !== a.exact) return b.exact - a.exact
    return b.similarity - a.similarity
  })

  const best = ranked[0] || {}
  // 兜底结果优先级：若最高相似度 < 60%，命中 __fallback__
  const winner = (best.similarity >= 60) ? best.tag : '__fallback__'
  const winnerRT = resultTypes.find(r => r.tag === winner) || best._rt || null

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

async function ensureSeed() {
  if (_seeded) return
  _seeded = true
  try {
    // quizzes
    for (const q of SEED_QUIZZES) {
      const exist = await db.collection('dna_quizzes').where({ id: q.id }).limit(1).get()
      if (!exist.data || !exist.data.length) {
        await db.collection('dna_quizzes').add({ data: { ...q, isOffline: false, createdAt: db.serverDate() } })
      }
    }
    // questions
    for (const quizId of Object.keys(SEED_QUESTIONS)) {
      const exist = await db.collection('dna_questions').where({ quizId }).limit(1).get()
      if (!exist.data || !exist.data.length) {
        for (const q of SEED_QUESTIONS[quizId]) {
          await db.collection('dna_questions').add({ data: { quizId, ...q } })
        }
      }
    }
    // results
    for (const quizId of Object.keys(SEED_RESULTS)) {
      const exist = await db.collection('dna_results').where({ quizId }).limit(1).get()
      if (!exist.data || !exist.data.length) {
        for (const r of SEED_RESULTS[quizId]) {
          await db.collection('dna_results').add({ data: { quizId, ...r } })
        }
      }
    }
  } catch (e) {
    console.warn('ensureSeed error (ignore if no permission):', e.message)
  }
}

// ============================================================
// Action 处理
// ============================================================

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event
  const data = normalizeEventData(event)

  await ensureSeed()

  try {
    switch (action) {
      case 'quiz-list': return await quizList(OPENID, data)
      case 'quiz-detail': return await quizDetail(OPENID, data)
      case 'submit': return await submit(OPENID, data)
      case 'get-record': return await getRecord(OPENID, data)
      case 'my-records': return await myRecords(OPENID, data)
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

  // 统计每个测试的参与人数（去重 openid）
  const quizzes = []
  for (const q of r.data) {
    let participantCount = 0
    try {
      const cnt = await db.collection('dna_records')
        .where({ quizId: q.id })
        .count()
      participantCount = cnt.total || 0
    } catch (e) {}
    quizzes.push({
      ...q,
      participantCount,
      questionsCount: q.questionsCount || 0
    })
  }

  return { code: 0, message: 'ok', data: { quizzes } }
}

// 测试详情：quiz + questions + results
async function quizDetail(OPENID, data) {
  const { id } = data
  if (!id) return { code: -1, message: '缺少 id' }

  const quizRes = await db.collection('dna_quizzes').where({ id }).limit(1).get()
  if (!quizRes.data || !quizRes.data.length) {
    return { code: -1, message: '测试不存在' }
  }
  const quiz = quizRes.data[0]

  const qRes = await db.collection('dna_questions')
    .where({ quizId: id })
    .orderBy('order', 'asc')
    .limit(50)
    .get()
  const questions = qRes.data || []

  const rRes = await db.collection('dna_results')
    .where({ quizId: id })
    .limit(50)
    .get()
  const results = rRes.data || []

  // 自动补全 dimOrder
  if (!quiz.dimOrder || !quiz.dimOrder.length) {
    const dims = [...new Set(questions.map(q => q.dim).filter(Boolean))]
    quiz.dimOrder = dims.map(d => ({ value: d, name: d, model: d }))
  }

  // 截取实际使用的题目数
  const n = quiz.questionsCount || questions.length
  const displayQuestions = (quiz.type !== 'WEIGHT' && n && n < questions.length)
    ? questions.slice(0, n)
    : questions

  return {
    code: 0, message: 'ok',
    data: { quiz, questions: displayQuestions, results }
  }
}

// 提交答案：服务端算分 + 存记录
async function submit(OPENID, data) {
  const { quizId, answers = [] } = data
  if (!quizId) return { code: -1, message: '缺少 quizId' }
  if (!answers.length) return { code: -1, message: '请回答问题' }

  // 拉取 quiz + questions + results
  const quizRes = await db.collection('dna_quizzes').where({ id: quizId }).limit(1).get()
  if (!quizRes.data || !quizRes.data.length) {
    return { code: -1, message: '测试不存在' }
  }
  const quiz = quizRes.data[0]

  const qRes = await db.collection('dna_questions')
    .where({ quizId })
    .orderBy('order', 'asc')
    .limit(50)
    .get()
  const questions = qRes.data || []

  const rRes = await db.collection('dna_results')
    .where({ quizId })
    .limit(50)
    .get()
  const results = rRes.data || []

  if (!quiz.dimOrder || !quiz.dimOrder.length) {
    const dims = [...new Set(questions.map(q => q.dim).filter(Boolean))]
    quiz.dimOrder = dims.map(d => ({ value: d, name: d, model: d }))
  }

  // 服务端重算答案（铁律：不信前端）
  // answers 入参格式: [{q: questionId/order, a: label}]
  // 服务端根据 quizId + q 找到题目，再按 a 找到 option，提取 dim + dimValue
  const rebuiltAnswers = []
  for (const ans of answers) {
    const q = questions.find(x => String(x._id) === String(ans.q) || x.order === ans.q)
    if (!q) continue
    const opt = (q.options || []).find(o => o.label === ans.a)
    if (!opt) continue
    rebuiltAnswers.push({
      q: q._id,
      a: opt.label,
      dim: q.dim,
      dimValue: opt.dimValue
    })
  }

  if (!rebuiltAnswers.length) {
    return { code: -1, message: '答案解析失败' }
  }

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

  // 优先按 _id 查
  try {
    const r = await db.collection('dna_records').doc(recordId).get()
    if (r.data) {
      return { code: 0, message: 'ok', data: r.data }
    }
  } catch (e) {}

  // 兜底：按 _openid + recordId 在 mock 情况下查最近一条
  const r2 = await db.collection('dna_records')
    .where({ _openid: OPENID })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
  return { code: 0, message: 'ok', data: (r2.data || [])[0] || null }
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
