const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const COLLECTIONS = [
  'users',
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
  'system_config',
  'video_channels',
  'videos',
  'video_likes',
  'video_comments',
  'video_follows',
  'yan_letters',
  'yan_user_gifts'
]

// ============================================================
// 人物种子：12 位（与 lantai 前端 mock 对齐）
// figureId 统一为拼音格式（无 fig- 前缀），与主数据库 ID 对齐；新增 initial 字段（拼音首字母）用于通讯录索引
// ============================================================
const FIGURE_SEED = [
  { figureId: 'huangdi', figureName: '黄帝', dynasty: 'xianqin', dynastyName: '上古', initial: 'H', title: '人文初祖', bio: '中华民族始祖，统一华夏部落，播百谷草木，创医药历法。', tags: ['始祖', '上古'], color: '#4B0082', avatar: '' },
  { figureId: 'simaqian', figureName: '司马迁', dynasty: 'han', dynastyName: '西汉', initial: 'S', title: '太史公', bio: '字子长，夏阳人。西汉史学家、散文家。因替李陵败降之事辩解而受宫刑，发奋完成《史记》百三十篇，史家之绝唱，无韵之离骚。', tags: ['史学', '文学'], color: '#654321', avatar: '' },
  { figureId: 'liubang', figureName: '刘邦', dynasty: 'han', dynastyName: '西汉', initial: 'L', title: '汉高祖', bio: '沛丰邑人，初为泗水亭长。秦末起兵，先入关中，约法三章。楚汉相争中虽屡战屡败，最终垓下一战定乾坤，建立汉朝。', tags: ['政治', '军事'], color: '#B22222', avatar: '' },
  { figureId: 'liuche', figureName: '刘彻', dynasty: 'han', dynastyName: '西汉', initial: 'L', title: '汉武帝', bio: '罢黜百家，独尊儒术；北击匈奴，凿空西域。雄才大略，开创西汉鼎盛之世。', tags: ['政治', '军事'], color: '#8B0000', avatar: '' },
  { figureId: 'zhugeliang', figureName: '诸葛亮', dynasty: 'sanguo', dynastyName: '三国·蜀', initial: 'Z', title: '武乡侯', bio: '字孔明，琅琊阳都人。三顾茅庐始出山，鞠躬尽瘁，死而后已。著《出师表》《诫子书》，卧龙一出天下惊。', tags: ['政治', '军事'], color: '#2F4F4F', avatar: '' },
  { figureId: 'libai', figureName: '李白', dynasty: 'tang', dynastyName: '盛唐', initial: 'L', title: '诗仙', bio: '字太白，号青莲居士。斗酒诗百篇，剑气纵横三万里。浪漫主义诗歌巅峰，与杜甫并称李杜。', tags: ['诗歌', '浪漫', '酒'], color: '#B22222', avatar: '' },
  { figureId: 'wuzetian', figureName: '武则天', dynasty: 'tang', dynastyName: '唐·武周', initial: 'W', title: '则天大圣皇帝', bio: '中国历史上唯一的女皇帝。从太宗才人，到高宗皇后，再到君临天下。创殿试、开武举、重人才。', tags: ['政治', '女皇'], color: '#9932CC', avatar: '' },
  { figureId: 'sushi', figureName: '苏轼', dynasty: 'song', dynastyName: '北宋', initial: 'S', title: '东坡居士', bio: '字子瞻，号东坡。诗词文书画皆冠绝一时。屡遭贬谪，旷达乐观，一蓑烟雨任平生。', tags: ['文学', '艺术', '美食'], color: '#2E8B57', avatar: '' },
  { figureId: 'yuefei', figureName: '岳飞', dynasty: 'song', dynastyName: '南宋', initial: 'Y', title: '岳武穆', bio: '字鹏举，相州汤阴人。南宋抗金名将，精忠报国。治军严明，岳家军"冻死不拆屋，饿死不掳掠"。遭十二道金牌召回，含冤风波亭。', tags: ['军事', '忠义'], color: '#8B0000', avatar: '' },
  { figureId: 'zhuyuanzhang', figureName: '朱元璋', dynasty: 'ming', dynastyName: '明', initial: 'Z', title: '明太祖', bio: '字国瑞，濠州钟离人。出身贫寒，曾为僧为丐。元末投郭子兴，后自立一军，灭陈友谅、张士诚，北伐驱逐元廷，建立大明。', tags: ['政治', '军事'], color: '#8B0000', avatar: '' },
  { figureId: 'zhenghe', figureName: '郑和', dynasty: 'ming', dynastyName: '明', initial: 'Z', title: '三保太监', bio: '原姓马，云南人。七下西洋，遍历三十余国，宝船六十余丈，示中国富强，通朝贡贸易。', tags: ['航海', '外交'], color: '#1E90FF', avatar: '' },
  // 以下为 shiji 原始数据保留
  { figureId: 'kongzi', figureName: '孔子', dynasty: 'xianqin', dynastyName: '春秋·鲁', initial: 'K', title: '儒家创始人', bio: '孔丘，字仲尼。万世师表，有教无类，弟子三千，贤人七十二。修诗书礼乐，序周易，著春秋。', tags: ['教育', '思想', '礼乐'], color: '#8B7355', avatar: '' },
  { figureId: 'baijuyi', figureName: '白居易', dynasty: 'tang', dynastyName: '中唐', initial: 'B', title: '诗魔', bio: '字乐天，号香山居士。新乐府运动领袖，文章合为时而著，歌诗合为事而作。老妪能解。', tags: ['诗歌', '现实'], color: '#4682B4', avatar: '' },
  { figureId: 'xiangyu', figureName: '项羽', dynasty: 'sanguo', dynastyName: '秦末·楚', initial: 'X', title: '西楚霸王', bio: '名籍，字羽。力能扛鼎，才气过人。破釜沉舟，百二秦关终属楚；垓下被围，乌江自刎。', tags: ['军事', '悲情英雄'], color: '#8B0000', avatar: '' },
  { figureId: 'caocao', figureName: '曹操', dynasty: 'sanguo', dynastyName: '东汉末', initial: 'C', title: '魏武帝', bio: '字孟德，小字阿瞒。挟天子以令诸侯，灭吕布，破袁绍，统一北方。政治家、军事家、诗人。', tags: ['政治', '军事', '文学'], color: '#2F4F4F', avatar: '' },
  { figureId: 'mulan', figureName: '花木兰', dynasty: 'sanguo', dynastyName: '南北朝', initial: 'H', title: '巾帼英雄', bio: '代父从军，女扮男装，征战十二载，屡立奇功。归来不愿尚书郎，愿驰千里足，送儿还故乡。', tags: ['孝义', '军事'], color: '#CD5C5C', avatar: '' },
  // DNA 测试结果关联人物（新增 8 位）
  { figureId: 'lishimin', figureName: '李世民', dynasty: 'tang', dynastyName: '唐', initial: 'L', title: '唐太宗', bio: '唐高祖李渊次子。少年从军，雁门关救驾。玄武门之变后登基，年号贞观。在位期间，任用魏徵、房玄龄、杜如晦，开创贞观之治，被尊为"天可汗"。', tags: ['政治', '军事', '盛世'], color: '#C9A24D', avatar: '' },
  { figureId: 'zhaokuangyin', figureName: '赵匡胤', dynasty: 'song', dynastyName: '北宋', initial: 'Z', title: '宋太祖', bio: '字元朗，涿郡人。后周殿前都点检，陈桥兵变被黄袍加身，建立宋朝。在位期间杯酒释兵权，加强中央集权，重文抑武，奠定宋代文治基础。', tags: ['政治', '军事'], color: '#228B22', avatar: '' },
  { figureId: 'dufu', figureName: '杜甫', dynasty: 'tang', dynastyName: '唐', initial: 'D', title: '诗圣', bio: '字子美，自号少陵野老，唐代伟大的现实主义诗人。与李白并称"李杜"。其诗被称为"诗史"，反映唐朝由盛转衰的历史。', tags: ['诗歌', '现实', '忧国'], color: '#654321', avatar: '' },
  { figureId: 'liqingzhao', figureName: '李清照', dynasty: 'song', dynastyName: '南宋', initial: 'L', title: '易安居士', bio: '号易安居士，齐州章丘人。宋代女词人，婉约词派代表，有"千古第一才女"之称。与丈夫赵明诚共撰《金石录》。', tags: ['词', '婉约', '才女'], color: '#C71585', avatar: '' },
  { figureId: 'guanyu', figureName: '关羽', dynasty: 'sanguo', dynastyName: '三国·蜀', initial: 'G', title: '关圣帝君', bio: '字云长，河东解良人。蜀汉名将，与刘备、张飞桃园结义。温酒斩华雄，斩颜良诛文丑，过五关斩六将，水淹七军威震华夏。后世尊为"武圣"。', tags: ['军事', '忠义', '武圣'], color: '#B22222', avatar: '' },
  { figureId: 'hanxin', figureName: '韩信', dynasty: 'han', dynastyName: '西汉', initial: 'H', title: '淮阴侯', bio: '淮阴人。西汉开国功臣，与张良、萧何并称"汉初三杰"。初投项羽，后归刘邦。平定齐、赵、魏，垓下灭项羽。后遭刘邦猜忌，被吕后诛杀。', tags: ['军事', '兵仙'], color: '#2F4F4F', avatar: '' },
  { figureId: 'weiqing', figureName: '卫青', dynasty: 'han', dynastyName: '西汉', initial: 'W', title: '长平侯', bio: '字仲卿，河东平阳人。本平阳公主家奴，后因姊卫子夫得宠而入宫。汉武帝时七征匈奴，七战七胜，封长平侯。', tags: ['军事', '常胜'], color: '#1E90FF', avatar: '' },
  { figureId: 'huoqubing', figureName: '霍去病', dynasty: 'han', dynastyName: '西汉', initial: 'H', title: '冠军侯', bio: '河东平阳人，卫青外甥。善骑射，用兵神速。十七岁领兵作战，封冠军侯。六击匈奴，封狼居胥。元狩六年病逝，年仅二十四。', tags: ['军事', '少年英雄'], color: '#FF8C00', avatar: '' },
  // DNA 新测试关联人物（谋士、史家、乱世英雄）
  { figureId: 'zhangliang', figureName: '张良', dynasty: 'han', dynastyName: '西汉', initial: 'Z', title: '留侯', bio: '字子房，韩国贵族后裔。汉初三杰之一，以谋略著称。助刘邦灭秦破楚，功成后明哲保身，从赤松子游。', tags: ['谋略', '政治'], color: '#6A5B8A', avatar: '' },
  { figureId: 'xiaohe', figureName: '萧何', dynasty: 'han', dynastyName: '西汉', initial: 'X', title: '酂文终侯', bio: '沛县人。汉初三杰之一，镇守关中，定律令，荐韩信，为汉朝建立提供制度与后勤支撑。', tags: ['政治', '制度'], color: '#586B4F', avatar: '' },
  { figureId: 'simayi', figureName: '司马懿', dynasty: 'sanguo', dynastyName: '三国·魏', initial: 'S', title: '晋宣帝', bio: '字仲达，河内温人。三国魏国重臣、军事家、政治家。长期隐忍经营，晚年发动高平陵之变，为司马氏代魏奠定基础。', tags: ['政治', '军事', '隐忍'], color: '#3F4654', avatar: '' },
  { figureId: 'guojia', figureName: '郭嘉', dynasty: 'sanguo', dynastyName: '东汉末', initial: 'G', title: '奉孝', bio: '字奉孝，颍川人。曹操重要谋士，以洞察局势、判断人物著称，对曹操统一北方贡献很大，英年早逝。', tags: ['谋略', '洞察'], color: '#6B4F7A', avatar: '' },
  { figureId: 'banggu', figureName: '班固', dynasty: 'han', dynastyName: '东汉', initial: 'B', title: '兰台令史', bio: '字孟坚，扶风安陵人。东汉史学家、文学家，撰《汉书》，开创纪传体断代史体例。', tags: ['史学', '文学'], color: '#735C42', avatar: '' },
  { figureId: 'simaguang', figureName: '司马光', dynasty: 'song', dynastyName: '北宋', initial: 'S', title: '温国文正公', bio: '字君实，陕州夏县人。北宋政治家、史学家，主持编纂《资治通鉴》。', tags: ['史学', '政治'], color: '#4F5E6D', avatar: '' },
  { figureId: 'chenshou', figureName: '陈寿', dynasty: 'jin', dynastyName: '西晋', initial: 'C', title: '史官', bio: '字承祚，安汉人。西晋史学家，著《三国志》，为研究三国历史的重要史籍。', tags: ['史学'], color: '#5C5A4A', avatar: '' },
  { figureId: 'liuzhiji', figureName: '刘知几', dynasty: 'tang', dynastyName: '唐', initial: 'L', title: '史通作者', bio: '字子玄，彭城人。唐代史学家，著《史通》，是中国古代重要的史学理论著作。', tags: ['史学', '理论'], color: '#665A73', avatar: '' },
  { figureId: 'duyou', figureName: '杜佑', dynasty: 'tang', dynastyName: '唐', initial: 'D', title: '通典作者', bio: '字君卿，京兆万年人。唐代政治家、史学家，著《通典》，开创典章制度通史的重要传统。', tags: ['史学', '制度'], color: '#596B5C', avatar: '' },
  { figureId: 'liubei', figureName: '刘备', dynasty: 'sanguo', dynastyName: '三国·蜀', initial: 'L', title: '昭烈帝', bio: '字玄德，涿郡涿县人。蜀汉开国皇帝。以仁义和用人著称，与关羽、张飞桃园结义，三顾茅庐请诸葛亮。', tags: ['政治', '仁义'], color: '#356B45', avatar: '' },
  { figureId: 'sunquan', figureName: '孙权', dynasty: 'sanguo', dynastyName: '三国·吴', initial: 'S', title: '吴大帝', bio: '字仲谋，吴郡富春人。三国吴国建立者。承父兄基业，联合刘备赢得赤壁之战，长期经营江东。', tags: ['政治', '制衡'], color: '#3D6F7A', avatar: '' },
  { figureId: 'yuanshao', figureName: '袁绍', dynasty: 'donghan', dynastyName: '东汉末', initial: 'Y', title: '大将军', bio: '字本初，汝南汝阳人。东汉末群雄之一，出身汝南袁氏，曾据河北，与曹操官渡决战失利。', tags: ['政治', '门阀'], color: '#7A6142', avatar: '' },
  { figureId: 'chensheng', figureName: '陈胜', dynasty: 'qin', dynastyName: '秦末', initial: 'C', title: '张楚王', bio: '字涉，阳城人。秦末农民起义领袖，与吴广发动大泽乡起义，建立张楚政权。', tags: ['起义', '英雄'], color: '#7A4A2F', avatar: '' }
]

// ============================================================
// 典籍种子
// ============================================================
const BOOK_SEED = [
  { _id: 'shiji', bookId: 'shiji', title: '史记', author: '司马迁', dynasty: 'han', dynastyName: '西汉', chapters: 130, category: '史书', desc: '史家之绝唱，无韵之离骚', figures: ['simaqian', 'xiangyu', 'caocao'] },
  { _id: 'hanshu', bookId: 'hanshu', title: '汉书', author: '班固', dynasty: 'han', dynastyName: '东汉', chapters: 100, category: '史书', desc: '第一部纪传体断代史', figures: ['liubang', 'liuche'] },
  { _id: 'sanguozhi', bookId: 'sanguozhi', title: '三国志', author: '陈寿', dynasty: 'sanguo', dynastyName: '西晋', chapters: 65, category: '史书', desc: '三国时代的权威记载', figures: ['zhugeliang', 'caocao'] },
  { _id: 'zizhitongjian', bookId: 'zizhitongjian', title: '资治通鉴', author: '司马光', dynasty: 'song', dynastyName: '北宋', chapters: 294, category: '史书', desc: '鉴前世之兴衰，考当今之得失', figures: ['wuzetian', 'sushi'] },
  { _id: 'xintangshu', bookId: 'xintangshu', title: '新唐书', author: '欧阳修', dynasty: 'song', dynastyName: '北宋', chapters: 225, category: '史书', desc: '唐代历史的系统梳理', figures: ['wuzetian', 'libai', 'baijuyi'] },
  { _id: 'mingshi', bookId: 'mingshi', title: '明史', author: '张廷玉等', dynasty: 'qing', dynastyName: '清', chapters: 332, category: '史书', desc: '明朝近三百年全史', figures: ['zhuyuanzhang', 'zhenghe'] }
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

// ============================================================
// 视频号种子：6 位古人开通视频号
// ============================================================
const VIDEO_CHANNEL_SEED = [
  { figureId: 'fig-libai', figureName: '李白', figureTitle: '诗仙', avatar: '', dynasty: 'tang', dynastyName: '盛唐', bio: '斗酒诗百篇，剑气纵横三万里。' },
  { figureId: 'fig-sushi', figureName: '苏轼', figureTitle: '东坡居士', avatar: '', dynasty: 'song', dynastyName: '北宋', bio: '一蓑烟雨任平生，人间有味是清欢。' },
  { figureId: 'fig-zhugeliang', figureName: '诸葛亮', figureTitle: '武乡侯', avatar: '', dynasty: 'sanguo', dynastyName: '三国·蜀', bio: '鞠躬尽瘁，死而后已。' },
  { figureId: 'fig-liubang', figureName: '刘邦', figureTitle: '汉高祖', avatar: '', dynasty: 'han', dynastyName: '西汉', bio: '大风起兮云飞扬，威加海内兮归故乡。' },
  { figureId: 'fig-wuzetian', figureName: '武则天', figureTitle: '则天大圣皇帝', avatar: '', dynasty: 'tang', dynastyName: '唐·武周', bio: '巾帼不让须眉，一代女皇。' },
  { figureId: 'fig-simqian', figureName: '司马迁', figureTitle: '太史公', avatar: '', dynasty: 'han', dynastyName: '西汉', bio: '史家之绝唱，无韵之离骚。' }
]

// ============================================================
// 视频种子：每个视频号 2-3 条示例视频
// 视频来源：Archive.org (Public Domain) + Mixkit (免费可商用)
// 转存流程：seedVideos 写入外部URL → 调用 transferVideos 云函数下载并上传到云存储
// 一键操作：调用 initDB { action: 'seedAndTransfer' } 自动完成播种+转存
// ============================================================
const VIDEO_SEED = [
  // 李白
  { figureId: 'fig-libai', title: '将进酒', description: '君不见黄河之水天上来，奔流到海不复回！', historicalEvent: '将进酒', tags: ['唐诗', '酒', '豪放'], duration: 45,
    videoUrl: 'https://assets.mixkit.co/videos/20806/20806-720.mp4',
    coverUrl: 'https://assets.mixkit.co/videos/20806/20806-thumb-720-0.jpg' },
  { figureId: 'fig-libai', title: '望庐山瀑布', description: '飞流直下三千尺，疑是银河落九天。', historicalEvent: '游庐山', tags: ['唐诗', '山水'], duration: 30,
    videoUrl: 'https://assets.mixkit.co/videos/11123/11123-720.mp4',
    coverUrl: 'https://assets.mixkit.co/videos/11123/11123-thumb-360-0.jpg' },
  { figureId: 'fig-libai', title: '赠汪伦', description: '桃花潭水深千尺，不及汪伦送我情。', historicalEvent: '赠汪伦', tags: ['唐诗', '友情'], duration: 25,
    videoUrl: 'https://assets.mixkit.co/videos/19011/19011-720.mp4',
    coverUrl: 'https://assets.mixkit.co/videos/19011/19011-thumb-360-0.jpg' },
  // 苏轼
  { figureId: 'fig-sushi', title: '赤壁怀古', description: '大江东去，浪淘尽，千古风流人物。', historicalEvent: '念奴娇·赤壁怀古', tags: ['宋词', '豪放'], duration: 40,
    videoUrl: 'https://assets.mixkit.co/videos/28663/28663-720.mp4',
    coverUrl: 'https://assets.mixkit.co/videos/28663/28663-thumb-360-0.jpg' },
  { figureId: 'fig-sushi', title: '东坡肉秘方', description: '黄州好猪肉，价贱如泥土。慢着火，少着水，火候足时它自美。', historicalEvent: '东坡肉', tags: ['美食', '生活'], duration: 35,
    videoUrl: 'https://assets.mixkit.co/active_storage/video_items/100500/1725309516/100500-video-360.mp4',
    coverUrl: 'https://assets.mixkit.co/active_storage/video_items/100500/1725309516/100500-video-thumb-360-0.jpg' },
  // 诸葛亮
  { figureId: 'fig-zhugeliang', title: '出师表', description: '臣本布衣，躬耕于南阳，苟全性命于乱世...', historicalEvent: '出师表', tags: ['三国', '忠义'], duration: 60,
    videoUrl: 'https://assets.mixkit.co/videos/31010/31010-720.mp4',
    coverUrl: 'https://assets.mixkit.co/videos/31010/31010-thumb-720-0.jpg' },
  { figureId: 'fig-zhugeliang', title: '空城计', description: '瑶琴三尺胜雄师，诸葛西城退敌时。', historicalEvent: '空城计', tags: ['三国', '谋略'], duration: 38,
    videoUrl: 'https://assets.mixkit.co/active_storage/video_items/100498/1725309129/100498-video-360.mp4',
    coverUrl: 'https://assets.mixkit.co/active_storage/video_items/100498/1725309129/100498-video-thumb-360-0.jpg' },
  // 刘邦
  { figureId: 'fig-liubang', title: '大风歌', description: '大风起兮云飞扬，威加海内兮归故乡，安得猛士兮守四方！', historicalEvent: '大风歌', tags: ['汉朝', '诗歌'], duration: 28,
    videoUrl: 'https://archive.org/download/ChinaCli1935/ChinaCli1935_512kb.mp4',
    coverUrl: 'https://archive.org/download/ChinaCli1935/__ia_thumb.jpg' },
  { figureId: 'fig-liubang', title: '鸿门宴惊魂', description: '项庄舞剑，意在沛公。今日之险，终生难忘。', historicalEvent: '鸿门宴', tags: ['汉朝', '历史'], duration: 50,
    videoUrl: 'https://archive.org/download/6ca-65f-16-e-7b-5-4d-2b-824d-be-4f-1cef-63e-0/6ca65f16-e7b5-4d2b-824d-be4f1cef63e0.mp4',
    coverUrl: 'https://archive.org/download/6ca-65f-16-e-7b-5-4d-2b-824d-be-4f-1cef-63e-0/__ia_thumb.jpg' },
  // 武则天
  { figureId: 'fig-wuzetian', title: '无字碑', description: '千秋功过，留待后人评说。', historicalEvent: '无字碑', tags: ['唐朝', '女皇'], duration: 32,
    videoUrl: 'https://assets.mixkit.co/videos/4108/4108-720.mp4',
    coverUrl: 'https://assets.mixkit.co/videos/4108/4108-thumb-360-0.jpg' },
  // 司马迁
  { figureId: 'fig-simqian', title: '史记自序', description: '究天人之际，通古今之变，成一家之言。', historicalEvent: '史记', tags: ['史学', '文学'], duration: 55,
    videoUrl: 'https://assets.mixkit.co/videos/20806/20806-720.mp4',
    coverUrl: 'https://assets.mixkit.co/videos/20806/20806-thumb-720-0.jpg' }
]

// ============================================================
// AI评论种子
// ============================================================
const VIDEO_COMMENT_SEED = [
  // 李白《将进酒》
  { videoIdx: 0, fromFigureId: 'fig-dufu', fromFigureName: '杜甫', fromFigureTitle: '诗圣', fromDynasty: 'tang', content: '白也诗无敌，飘然思不群！' },
  { videoIdx: 0, fromFigureId: 'fig-baijuyi', fromFigureName: '白居易', fromFigureTitle: '诗魔', fromDynasty: 'tang', content: '酒入豪肠，七分酿成了月光。' },
  // 李白《赠汪伦》
  { videoIdx: 2, fromFigureId: 'fig-dufu', fromFigureName: '杜甫', fromFigureTitle: '诗圣', fromDynasty: 'tang', content: '何时一樽酒，重与细论文？' },
  // 苏轼《赤壁怀古》
  { videoIdx: 3, fromFigureId: 'fig-xin-qiji', fromFigureName: '辛弃疾', fromFigureTitle: '词中之龙', fromDynasty: 'song', content: '东坡真乃豪放派鼻祖也！' },
  // 诸葛亮《出师表》
  { videoIdx: 5, fromFigureId: 'fig-yuefei', fromFigureName: '岳飞', fromFigureTitle: '岳武穆', fromDynasty: 'song', content: '读《出师表》不下泪者，其人必不忠。' },
  { videoIdx: 5, fromFigureId: 'fig-wuzetian', fromFigureName: '武则天', fromFigureTitle: '则天大圣皇帝', fromDynasty: 'tang', content: '鞠躬尽瘁，千古忠臣。' },
  // 刘邦《大风歌》
  { videoIdx: 7, fromFigureId: 'fig-xiangyu', fromFigureName: '项羽', fromFigureTitle: '西楚霸王', fromDynasty: 'sanguo', content: '沛公...此景竟让我想起当年。' }
]

exports.main = async (event, context) => {
  const { action = 'init' } = event
  const data = normalizeEventData(event)
  try {
    switch (action) {
      case 'init': return await initAll(data)
      case 'resetDB': return await resetDB(data)
      case 'checkStatus': return await checkStatus()
      case 'seedFigures': return await seedFigures()
      case 'seedBooks': return await seedBooks()
      case 'seedMemorials': return await seedMemorials()
      case 'seedAchievements': return await seedAchievements()
      case 'seedVideoChannels': return await seedVideoChannels()
      case 'seedVideos': return await seedVideos()
      case 'seedVideoComments': return await seedVideoComments()
      case 'fixVideoUrls': return await fixVideoUrls()
      case 'seedAndTransfer': return await seedAndTransfer(data)
      case 'fixAndTransfer': return await fixAndTransfer(data)
      default: return { code: -1, message: '未知 action: ' + action }
    }
  } catch (e) {
    console.error('initDB err', e)
    return { code: -1, message: e.message }
  }
}

function normalizeEventData(event) {
  const { action, data, ...rest } = event || {}
  return data && typeof data === 'object' ? { ...rest, ...data } : rest
}

async function initAll(data) {
  const { drop = false, seed = true } = data
  const created = []
  const failed = []

  for (const c of COLLECTIONS) {
    try {
      if (drop) {
        try {
          await db.collection(c).where({ _id: /./ }).remove()
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

  if (!seed) {
    return { code: 0, message: '初始化完成', data: { created, failed, seed: null } }
  }

  const seedResult = {}
  const seedTasks = [
    { key: 'memorials', fn: seedMemorials },
    { key: 'achievements', fn: seedAchievements },
    { key: 'videoChannels', fn: seedVideoChannels },
    { key: 'videos', fn: seedVideos },
    { key: 'videoComments', fn: seedVideoComments }
  ]

  for (const task of seedTasks) {
    try {
      seedResult[task.key] = await task.fn()
    } catch (e) {
      seedResult[task.key] = { ok: 0, fail: -1, error: e.message }
    }
  }

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
  return { ok: 0, fail: 0, skipped: true, reason: '静态人物由 scripts/data-sync/migrate_cloudbase_rebuild.js 管理' }
}

async function seedBooks() {
  return { ok: 0, fail: 0, skipped: true, reason: '静态典籍由 scripts/data-sync/migrate_cloudbase_rebuild.js 管理' }
}

async function seedMemorials() {
  const count = await db.collection('memorials').count()
  if (count.total > 0) {
    return { ok: 0, fail: 0, skipped: true, reason: '已有数据，跳过' }
  }
  let ok = 0, fail = 0
  for (const m of MEMORIAL_SEED) {
    try {
      await db.collection('memorials').add({ data: { _id: m._id, ...m } })
      ok++
    } catch (e) { fail++ }
  }
  return { ok, fail }
}

async function seedAchievements() {
  const count = await db.collection('achievements').count()
  if (count.total > 0) {
    return { ok: 0, fail: 0, skipped: true, reason: '已有数据，跳过' }
  }
  let ok = 0, fail = 0
  for (const a of ACHIEVEMENT_SEED) {
    try {
      await db.collection('achievements').add({ data: { _id: a._id, ...a } })
      ok++
    } catch (e) { fail++ }
  }
  return { ok, fail }
}

async function seedVideoChannels() {
  const count = await db.collection('video_channels').count()
  if (count.total > 0) {
    return { ok: 0, fail: 0, skipped: true, reason: '已有数据，跳过' }
  }
  let ok = 0, fail = 0
  for (const c of VIDEO_CHANNEL_SEED) {
    try {
      const res = await db.collection('video_channels').add({
        data: {
          ...c,
          followerCount: 0,
          videoCount: 0,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
      ok++
    } catch (e) {
      console.warn('seedVideoChannels err:', e)
      fail++
    }
  }
  return { ok, fail }
}

async function seedVideos() {
  const count = await db.collection('videos').count()
  if (count.total > 0) {
    return { ok: 0, fail: 0, skipped: true, reason: '已有数据，跳过' }
  }
  let ok = 0, fail = 0
  const channelMap = {}
  try {
    const channels = await db.collection('video_channels').get()
    channels.data.forEach(c => { channelMap[c.figureId] = c })
  } catch (e) {
    return { ok: 0, fail: VIDEO_SEED.length, error: e.message }
  }

  for (let i = 0; i < VIDEO_SEED.length; i++) {
    const v = VIDEO_SEED[i]
    const channel = channelMap[v.figureId]
    if (!channel) { fail++; continue }
    try {
      await db.collection('videos').add({
        data: {
          channelId: channel._id,
          figureId: v.figureId,
          figureName: channel.figureName || '',
          figureTitle: channel.figureTitle || '',
          avatar: channel.avatar || '',
          dynasty: channel.dynasty || '',
          title: v.title,
          description: v.description,
          coverUrl: v.coverUrl || '',
          videoUrl: v.videoUrl || '',
          duration: v.duration || 30,
          historicalEvent: v.historicalEvent || '',
          tags: v.tags || [],
          likeCount: Math.floor(Math.random() * 5000) + 100,
          viewCount: Math.floor(Math.random() * 50000) + 1000,
          status: 'published',
          createdAt: db.serverDate()
        }
      })
      try {
        await db.collection('video_channels').doc(channel._id).update({
          data: { videoCount: _.inc(1) }
        })
      } catch (_) {}
      ok++
    } catch (e) {
      console.warn('seedVideos err:', e)
      fail++
    }
  }
  return { ok, fail }
}

async function seedVideoComments() {
  const count = await db.collection('video_comments').count()
  if (count.total > 0) {
    return { ok: 0, fail: 0, skipped: true, reason: '已有数据，跳过' }
  }
  let ok = 0, fail = 0
  try {
    const videos = await db.collection('videos').orderBy('createdAt', 'asc').get()
    const videoList = videos.data

    for (const c of VIDEO_COMMENT_SEED) {
      const video = videoList[c.videoIdx]
      if (!video) { fail++; continue }
      try {
        await db.collection('video_comments').add({
          data: {
            videoId: video._id,
            fromFigureId: c.fromFigureId,
            fromFigureName: c.fromFigureName,
            fromFigureTitle: c.fromFigureTitle,
            fromAvatar: '',
            fromDynasty: c.fromDynasty,
            toFigureId: video.figureId,
            toFigureName: video.figureName,
            content: c.content,
            createdAt: db.serverDate()
          }
        })
        ok++
      } catch (e) {
        console.warn('seedVideoComments err:', e)
        fail++
      }
    }
  } catch (e) {
    return { ok: 0, fail: VIDEO_COMMENT_SEED.length, error: e.message }
  }
  return { ok, fail }
}

async function resetDB(data) {
  const keepFiguresAchievements = data.keepSeed !== false
  const removeCols = keepFiguresAchievements
    ? COLLECTIONS.filter(c => !['achievements', 'memorials'].includes(c))
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

// ============================================================
// 存量数据修复：为已有空 videoUrl/coverUrl 的视频记录回填真实 URL
// ============================================================
async function fixVideoUrls() {
  // 按 figureId + title 匹配 VIDEO_SEED，回填 videoUrl 和 coverUrl
  const seedMap = {}
  VIDEO_SEED.forEach(v => {
    seedMap[v.figureId + '_' + v.title] = v
  })

  let fixed = 0, skipped = 0, failed = 0
  try {
    const res = await db.collection('videos')
      .where({ status: 'published' })
      .limit(100)
      .get()

    for (const video of res.data) {
      // 已有有效 URL 的跳过（含 cloud:// 和 http://）
      if (video.videoUrl && (video.videoUrl.startsWith('http') || video.videoUrl.startsWith('cloud://'))) {
        skipped++
        continue
      }

      const key = video.figureId + '_' + video.title
      const seed = seedMap[key]
      if (!seed) {
        skipped++
        continue
      }

      try {
        await db.collection('videos').doc(video._id).update({
          data: {
            videoUrl: seed.videoUrl,
            coverUrl: seed.coverUrl
          }
        })
        fixed++
      } catch (e) {
        console.warn('fixVideoUrls update err:', video._id, e)
        failed++
      }
    }
  } catch (e) {
    return { code: -1, message: e.message, data: null }
  }

  return {
    code: 0,
    message: `修复完成：${fixed} 条已更新，${skipped} 条跳过，${failed} 条失败`,
    data: { fixed, skipped, failed }
  }
}

// ============================================================
// 一键播种 + 转存：先写入种子数据（外部URL），再调用 transferVideos 转存到云存储
// ============================================================
async function seedAndTransfer(data) {
  const log = []

  // 1. 播种视频号
  try {
    const chRes = await seedVideoChannels()
    log.push('视频号: ' + chRes.message)
  } catch (e) {
    log.push('视频号失败: ' + e.message)
  }

  // 2. 播种视频
  try {
    const vRes = await seedVideos()
    log.push('视频: ' + vRes.message)
  } catch (e) {
    log.push('视频失败: ' + e.message)
  }

  // 3. 播种评论
  try {
    const cRes = await seedVideoComments()
    log.push('评论: ' + cRes.message)
  } catch (e) {
    log.push('评论失败: ' + e.message)
  }

  // 4. 调用 transferVideos 分批转存到云存储
  try {
    const tRes = await cloud.callFunction({ name: 'transferVideos', data: { action: 'transferBatch', batchSize: 3 } })
    const tData = tRes.result || {}
    log.push('转存: ' + (tData.message || JSON.stringify(tData)))
    if (tData.data && tData.data.remaining > 0) {
      log.push(`仍有 ${tData.data.remaining} 条待转存，请再次调用 transferVideos`)
    }
  } catch (e) {
    log.push('转存失败（需手动部署 transferVideos 云函数后重试）: ' + e.message)
  }

  return {
    code: 0,
    message: log.join('；'),
    data: { log }
  }
}

// ============================================================
// 修复 + 转存：先修复空URL（回填外部URL），再转存到云存储
// 适用于：已有视频数据但 videoUrl 为空或无效的场景
// ============================================================
async function fixAndTransfer(data) {
  const log = []

  // 1. 修复空 videoUrl
  try {
    const fRes = await fixVideoUrls()
    log.push('修复URL: ' + fRes.message)
  } catch (e) {
    log.push('修复URL失败: ' + e.message)
  }

  // 2. 分批转存到云存储
  try {
    const tRes = await cloud.callFunction({ name: 'transferVideos', data: { action: 'transferBatch', batchSize: 3 } })
    const tData = tRes.result || {}
    log.push('转存: ' + (tData.message || JSON.stringify(tData)))
    if (tData.data && tData.data.remaining > 0) {
      log.push(`仍有 ${tData.data.remaining} 条待转存，请再次调用 transferVideos`)
    }
  } catch (e) {
    log.push('转存失败（需部署 transferVideos 云函数）: ' + e.message)
  }

  return {
    code: 0,
    message: log.join('；'),
    data: { log }
  }
}
