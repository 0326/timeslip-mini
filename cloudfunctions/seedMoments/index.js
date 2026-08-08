const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const { resolveIdentity, ownerMatch, attachOwnerFields } = require('./_identityHelper')
const db = cloud.database()
const _ = db.command

const IMG = {
  mountain: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600',
  moon: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600',
  forest: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=600',
  food: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600',
  architecture: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=600',
  snow: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
  sea: 'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=600',
  flower: 'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=600',
  hills: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600',
  calligraphy: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600',
  river: 'https://images.unsplash.com/photo-1476673160081-cf065607f449?w=600',
  petals: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600',
  leaves: 'https://images.unsplash.com/photo-1509223197845-458d87318791?w=600',
  cottage: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=600',
  sunset: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600',
  desert: 'https://images.unsplash.com/photo-1545048702-79362596cdc9?w=600'
}

const MOMENT_SEED = [
  {
    seedKey: 'libai1',
    figureId: 'fig-libai',
    name: '李白',
    figureTitle: '诗仙 · 供奉翰林',
    dynasty: '唐',
    avatar: '',
    content: '今天游了趟庐山，瀑布真壮观，作诗一首：「日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。」大家觉得怎么样？',
    images: [
      IMG.mountain,
      IMG.moon,
      IMG.forest,
      IMG.architecture,
      IMG.snow,
      IMG.sea,
      IMG.flower,
      IMG.hills,
      IMG.calligraphy
    ],
    historicalEvent: '作品出处：《望庐山瀑布》',
    historicalDate: '盛唐 · 开元年间',
    likes: [
      { openid: 'seed_dufu', name: '杜甫', figureId: 'fig-dufu' },
      { openid: 'seed_wangwei', name: '王维', figureId: 'fig-wangwei' },
      { openid: 'seed_menghaoran', name: '孟浩然', figureId: 'fig-menghaoran' },
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' },
      { openid: 'seed_liqingzhao', name: '李清照', figureId: 'fig-liqingzhao' },
      { openid: 'seed_xinqiji', name: '辛弃疾', figureId: 'fig-xinqiji' },
      { openid: 'seed_huangtingjian', name: '黄庭坚', figureId: 'fig-huangtingjian' },
      { openid: 'seed_baijuyi', name: '白居易', figureId: 'fig-baijuyi' },
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' },
      { openid: 'seed_wuzetian', name: '武则天', figureId: 'fig-wuzetian' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' },
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' },
      { openid: 'seed_liubei', name: '刘备', figureId: 'fig-liubei' },
      { openid: 'seed_guanyu', name: '关羽', figureId: 'fig-guanyu' }
    ],
    createdAtOffset: -0.1
  },
  {
    seedKey: 'libai2',
    figureId: 'fig-libai',
    name: '李白',
    figureTitle: '诗仙 · 供奉翰林',
    dynasty: '唐',
    avatar: '',
    content: '花间一壶酒，独酌无相亲。举杯邀明月，对影成三人。月既不解饮，影徒随我身。暂伴月将影，行乐须及春。今晚月色真美，可惜无人共饮，只好拉上月亮和影子凑一桌了。',
    images: [
      IMG.moon,
      IMG.flower
    ],
    historicalEvent: '作品出处：《月下独酌四首·其一》',
    historicalDate: '盛唐 · 长安',
    likes: [
      { openid: 'seed_dufu', name: '杜甫', figureId: 'fig-dufu' },
      { openid: 'seed_wangwei', name: '王维', figureId: 'fig-wangwei' },
      { openid: 'seed_menghaoran', name: '孟浩然', figureId: 'fig-menghaoran' }
    ],
    createdAtOffset: -0.7
  },
  {
    seedKey: 'libai3',
    figureId: 'fig-libai',
    name: '李白',
    figureTitle: '诗仙 · 供奉翰林',
    dynasty: '唐',
    avatar: '',
    content: '君不见黄河之水天上来，奔流到海不复回。君不见高堂明镜悲白发，朝如青丝暮成雪。人生得意须尽欢，莫使金樽空对月。天生我材必有用，千金散尽还复来！今晚与岑夫子、丹丘生痛饮三百杯，不醉不归！',
    images: [
      IMG.river,
      IMG.sea,
      IMG.sunset
    ],
    historicalEvent: '作品出处：《将进酒》',
    historicalDate: '盛唐 · 嵩山',
    likes: [
      { openid: 'seed_dufu', name: '杜甫', figureId: 'fig-dufu' },
      { openid: 'seed_wangwei', name: '王维', figureId: 'fig-wangwei' },
      { openid: 'seed_menghaoran', name: '孟浩然', figureId: 'fig-menghaoran' },
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' },
      { openid: 'seed_huangtingjian', name: '黄庭坚', figureId: 'fig-huangtingjian' }
    ],
    createdAtOffset: -1.3
  },
  {
    seedKey: 'libai4',
    figureId: 'fig-libai',
    name: '李白',
    figureTitle: '诗仙 · 供奉翰林',
    dynasty: '唐',
    avatar: '',
    content: '朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。终于遇赦，心情大好！江上行舟，快哉快哉！',
    images: [
      IMG.river,
      IMG.mountain
    ],
    historicalEvent: '作品出处：《早发白帝城》',
    historicalDate: '盛唐 · 乾元二年',
    likes: [
      { openid: 'seed_dufu', name: '杜甫', figureId: 'fig-dufu' },
      { openid: 'seed_menghaoran', name: '孟浩然', figureId: 'fig-menghaoran' }
    ],
    createdAtOffset: -1.9
  },
  {
    seedKey: 'dufu1',
    figureId: 'fig-dufu',
    name: '杜甫',
    figureTitle: '诗圣 · 检校工部员外郎',
    dynasty: '唐',
    avatar: '',
    content: '两个黄鹂鸣翠柳，一行白鹭上青天。窗含西岭千秋雪，门泊东吴万里船。草堂春色正好，落笔成句，与诸君共赏。',
    images: [
      IMG.cottage,
      IMG.river,
      IMG.snow
    ],
    historicalEvent: '作品出处：《绝句四首·其三》',
    historicalDate: '中唐 · 成都草堂',
    likes: [
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' },
      { openid: 'seed_wangwei', name: '王维', figureId: 'fig-wangwei' },
      { openid: 'seed_baijuyi', name: '白居易', figureId: 'fig-baijuyi' }
    ],
    createdAtOffset: -2.5
  },
  {
    seedKey: 'dufu2',
    figureId: 'fig-dufu',
    name: '杜甫',
    figureTitle: '诗圣 · 检校工部员外郎',
    dynasty: '唐',
    avatar: '',
    content: '安得广厦千万间，大庇天下寒士俱欢颜！风雨不动安如山。呜呼！何时眼前突兀见此屋，吾庐独破受冻死亦足！八月秋高风怒号，卷我屋上三重茅。茅屋破了，心却更宽广了。',
    images: [
      IMG.cottage,
      IMG.leaves
    ],
    historicalEvent: '作品出处：《茅屋为秋风所破歌》',
    historicalDate: '中唐 · 成都草堂',
    likes: [
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' },
      { openid: 'seed_baijuyi', name: '白居易', figureId: 'fig-baijuyi' },
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' }
    ],
    createdAtOffset: -3.1
  },
  {
    seedKey: 'dufu3',
    figureId: 'fig-dufu',
    name: '杜甫',
    figureTitle: '诗圣 · 检校工部员外郎',
    dynasty: '唐',
    avatar: '',
    content: '国破山河在，城春草木深。感时花溅泪，恨别鸟惊心。烽火连三月，家书抵万金。白头搔更短，浑欲不胜簪。长安沦陷，满目疮痍，唯愿早日平定叛乱，百姓安居。',
    images: [
      IMG.flower,
      IMG.leaves
    ],
    historicalEvent: '作品出处：《春望》',
    historicalDate: '中唐 · 安史之乱',
    likes: [
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' },
      { openid: 'seed_wangwei', name: '王维', figureId: 'fig-wangwei' }
    ],
    createdAtOffset: -3.7
  },
  {
    seedKey: 'baijuyi1',
    figureId: 'fig-baijuyi',
    name: '白居易',
    figureTitle: '香山居士 · 左拾遗',
    dynasty: '唐',
    avatar: '',
    content: '在天愿作比翼鸟，在地愿为连理枝。天长地久有时尽，此恨绵绵无绝期。重读明皇与贵妃旧事，感慨万千，作《长恨歌》一篇，与诸君共叹。',
    images: [
      IMG.flower,
      IMG.petals,
      IMG.architecture
    ],
    historicalEvent: '作品出处：《长恨歌》',
    historicalDate: '中唐 · 元和年间',
    likes: [
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' },
      { openid: 'seed_dufu', name: '杜甫', figureId: 'fig-dufu' },
      { openid: 'seed_liqingzhao', name: '李清照', figureId: 'fig-liqingzhao' }
    ],
    createdAtOffset: -4.3
  },
  {
    seedKey: 'baijuyi2',
    figureId: 'fig-baijuyi',
    name: '白居易',
    figureTitle: '香山居士 · 左拾遗',
    dynasty: '唐',
    avatar: '',
    content: '可怜身上衣正单，心忧炭贱愿天寒。夜来城外一尺雪，晓驾炭车辗冰辙。市南门外泥中歇，翩翩两骑来是谁？黄衣使者白衫儿，手把文书口称敕。新乐府又成一篇，写尽卖炭翁之苦。',
    images: [
      IMG.snow
    ],
    historicalEvent: '作品出处：《卖炭翁》',
    historicalDate: '中唐 · 元和四年',
    likes: [
      { openid: 'seed_dufu', name: '杜甫', figureId: 'fig-dufu' },
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' }
    ],
    createdAtOffset: -4.9
  },
  {
    seedKey: 'wuzetian1',
    figureId: 'fig-wuzetian',
    name: '武则天',
    figureTitle: '圣神皇帝 · 改唐为周',
    dynasty: '唐',
    avatar: '',
    content: '今日亲策天下士，不拘一格选人才。科举殿试自此始，武举亦将开设。朕要的，是能为社稷撑起一片天的人才，不论出身门第。',
    images: [
      IMG.architecture,
      IMG.calligraphy
    ],
    historicalEvent: '历史事件：武则天开创殿试与武举',
    historicalDate: '唐 · 载初元年',
    likes: [
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' },
      { openid: 'seed_liuche', name: '刘彻', figureId: 'fig-liuche' },
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' }
    ],
    createdAtOffset: -5.5
  },
  {
    seedKey: 'wuzetian2',
    figureId: 'fig-wuzetian',
    name: '武则天',
    figureTitle: '圣神皇帝 · 改唐为周',
    dynasty: '唐',
    avatar: '',
    content: '功过是非，留待后人评说。朕一生行事，何须碑文自述？立无字碑于此，千秋万代，任人评说。',
    images: [
      IMG.architecture
    ],
    historicalEvent: '历史事件：乾陵无字碑',
    historicalDate: '唐 · 神龙元年',
    likes: [
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' }
    ],
    createdAtOffset: -6.1
  },
  {
    seedKey: 'lishimin1',
    figureId: 'fig-lishimin',
    name: '李世民',
    figureTitle: '唐太宗 · 天可汗',
    dynasty: '唐',
    avatar: '',
    content: '以铜为镜，可正衣冠；以史为镜，可知兴替；以人为镜，可明得失。朕常保此三镜，以防己过。今四海渐平，仓廪渐实，当与群臣共守贞观之治。',
    images: [
      IMG.architecture,
      IMG.calligraphy
    ],
    historicalEvent: '历史事件：贞观之治',
    historicalDate: '唐 · 贞观年间',
    likes: [
      { openid: 'seed_wuzetian', name: '武则天', figureId: 'fig-wuzetian' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' },
      { openid: 'seed_liubei', name: '刘备', figureId: 'fig-liubei' },
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' },
      { openid: 'seed_hanxin', name: '韩信', figureId: 'fig-hanxin' }
    ],
    createdAtOffset: -6.7
  },
  {
    seedKey: 'lishimin2',
    figureId: 'fig-lishimin',
    name: '李世民',
    figureTitle: '唐太宗 · 天可汗',
    dynasty: '唐',
    avatar: '',
    content: '以人为镜，可明得失。今魏徵殁，朕亡一镜矣！玄成生前屡屡犯颜直谏，朕虽时有不悦，然深知其所言皆是。痛哉！痛哉！',
    images: [],
    historicalEvent: '历史事件：魏徵病逝',
    historicalDate: '唐 · 贞观十七年',
    likes: [
      { openid: 'seed_wuzetian', name: '武则天', figureId: 'fig-wuzetian' },
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' }
    ],
    createdAtOffset: -7.3
  },
  {
    seedKey: 'sushi1',
    figureId: 'fig-sushi',
    name: '苏轼',
    figureTitle: '东坡居士 · 龙图阁学士',
    dynasty: '宋',
    avatar: '',
    content: '黄州好猪肉，价贱如泥土。贵者不肯吃，贫者不解煮。慢着火，少着水，火候足时它自美。每日早来打一碗，饱得自家君莫管。谪居黄州，倒也自得其乐，这东坡肉我给满分！',
    images: [
      IMG.food
    ],
    historicalEvent: '作品出处：《猪肉颂》',
    historicalDate: '北宋 · 黄州谪居',
    likes: [
      { openid: 'seed_liqingzhao', name: '李清照', figureId: 'fig-liqingzhao' },
      { openid: 'seed_huangtingjian', name: '黄庭坚', figureId: 'fig-huangtingjian' },
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' }
    ],
    createdAtOffset: -7.9
  },
  {
    seedKey: 'sushi2',
    figureId: 'fig-sushi',
    name: '苏轼',
    figureTitle: '东坡居士 · 龙图阁学士',
    dynasty: '宋',
    avatar: '',
    content: '明月几时有？把酒问青天。不知天上宫阙，今夕是何年。人有悲欢离合，月有阴晴圆缺，此事古难全。但愿人长久，千里共婵娟。丙辰中秋，欢饮达旦，大醉，作此篇，兼怀子由。',
    images: [
      IMG.moon,
      IMG.sunset
    ],
    historicalEvent: '作品出处：《水调歌头·明月几时有》',
    historicalDate: '北宋 · 熙宁九年',
    likes: [
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' },
      { openid: 'seed_dufu', name: '杜甫', figureId: 'fig-dufu' },
      { openid: 'seed_wangwei', name: '王维', figureId: 'fig-wangwei' },
      { openid: 'seed_liqingzhao', name: '李清照', figureId: 'fig-liqingzhao' },
      { openid: 'seed_xinqiji', name: '辛弃疾', figureId: 'fig-xinqiji' },
      { openid: 'seed_huangtingjian', name: '黄庭坚', figureId: 'fig-huangtingjian' },
      { openid: 'seed_baijuyi', name: '白居易', figureId: 'fig-baijuyi' },
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' },
      { openid: 'seed_wuzetian', name: '武则天', figureId: 'fig-wuzetian' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' },
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' },
      { openid: 'seed_liubei', name: '刘备', figureId: 'fig-liubei' },
      { openid: 'seed_guanyu', name: '关羽', figureId: 'fig-guanyu' }
    ],
    createdAtOffset: -8.5
  },
  {
    seedKey: 'sushi3',
    figureId: 'fig-sushi',
    name: '苏轼',
    figureTitle: '东坡居士 · 龙图阁学士',
    dynasty: '宋',
    avatar: '',
    content: '大江东去，浪淘尽，千古风流人物。故垒西边，人道是，三国周郎赤壁。江山如画，一时多少豪杰。人生如梦，一尊还酹江月。谪居黄州，游赤壁矶，怀古伤今，感慨万千。',
    images: [
      IMG.river,
      IMG.mountain,
      IMG.sunset
    ],
    historicalEvent: '作品出处：《念奴娇·赤壁怀古》',
    historicalDate: '北宋 · 黄州',
    likes: [
      { openid: 'seed_liqingzhao', name: '李清照', figureId: 'fig-liqingzhao' },
      { openid: 'seed_huangtingjian', name: '黄庭坚', figureId: 'fig-huangtingjian' },
      { openid: 'seed_xinqiji', name: '辛弃疾', figureId: 'fig-xinqiji' }
    ],
    createdAtOffset: -9.1
  },
  {
    seedKey: 'sushi4',
    figureId: 'fig-sushi',
    name: '苏轼',
    figureTitle: '东坡居士 · 龙图阁学士',
    dynasty: '宋',
    avatar: '',
    content: '莫听穿林打叶声，何妨吟啸且徐行。竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。回首向来萧瑟处，归去，也无风雨也无晴。沙湖道中遇雨，同行皆狼狈，余独不觉。',
    images: [
      IMG.forest,
      IMG.leaves
    ],
    historicalEvent: '作品出处：《定风波·莫听穿林打叶声》',
    historicalDate: '北宋 · 黄州',
    likes: [
      { openid: 'seed_liqingzhao', name: '李清照', figureId: 'fig-liqingzhao' },
      { openid: 'seed_huangtingjian', name: '黄庭坚', figureId: 'fig-huangtingjian' }
    ],
    createdAtOffset: -9.7
  },
  {
    seedKey: 'liqingzhao1',
    figureId: 'fig-liqingzhao',
    name: '李清照',
    figureTitle: '易安居士 · 婉约宗主',
    dynasty: '宋',
    avatar: '',
    content: '昨夜雨疏风骤，浓睡不消残酒。试问卷帘人，却道海棠依旧。知否？知否？应是绿肥红瘦。春末小饮，醒来看花，记下一笔。',
    images: [
      IMG.petals,
      IMG.flower,
      IMG.leaves
    ],
    historicalEvent: '作品出处：《如梦令·昨夜雨疏风骤》',
    historicalDate: '北宋末年 · 汴京',
    likes: [
      { openid: 'seed_xinqiji', name: '辛弃疾', figureId: 'fig-xinqiji' },
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' },
      { openid: 'seed_huangtingjian', name: '黄庭坚', figureId: 'fig-huangtingjian' }
    ],
    createdAtOffset: -10.3
  },
  {
    seedKey: 'liqingzhao2',
    figureId: 'fig-liqingzhao',
    name: '李清照',
    figureTitle: '易安居士 · 婉约宗主',
    dynasty: '宋',
    avatar: '',
    content: '寻寻觅觅，冷冷清清，凄凄惨惨戚戚。乍暖还寒时候，最难将息。三杯两盏淡酒，怎敌他、晚来风急！雁过也，正伤心，却是旧时相识。这次第，怎一个愁字了得！',
    images: [
      IMG.leaves,
      IMG.sunset,
      IMG.petals
    ],
    historicalEvent: '作品出处：《声声慢·寻寻觅觅》',
    historicalDate: '南宋 · 建炎年间',
    likes: [
      { openid: 'seed_xinqiji', name: '辛弃疾', figureId: 'fig-xinqiji' },
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' }
    ],
    createdAtOffset: -10.9
  },
  {
    seedKey: 'yuefei1',
    figureId: 'fig-yuefei',
    name: '岳飞',
    figureTitle: '岳武穆 · 荆湖北路帅司',
    dynasty: '宋',
    avatar: '',
    content: '怒发冲冠，凭栏处、潇潇雨歇。抬望眼，仰天长啸，壮怀激烈。三十功名尘与土，八千里路云和月。莫等闲，白了少年头，空悲切！靖康耻，犹未雪；臣子恨，何时灭！待从头、收拾旧山河，朝天阙。',
    images: [],
    historicalEvent: '作品出处：《满江红·怒发冲冠》',
    historicalDate: '南宋 · 抗金前线',
    likes: [
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' },
      { openid: 'seed_dufu', name: '杜甫', figureId: 'fig-dufu' },
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' },
      { openid: 'seed_liqingzhao', name: '李清照', figureId: 'fig-liqingzhao' },
      { openid: 'seed_xinqiji', name: '辛弃疾', figureId: 'fig-xinqiji' },
      { openid: 'seed_huangtingjian', name: '黄庭坚', figureId: 'fig-huangtingjian' },
      { openid: 'seed_baijuyi', name: '白居易', figureId: 'fig-baijuyi' },
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' },
      { openid: 'seed_wuzetian', name: '武则天', figureId: 'fig-wuzetian' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' },
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' },
      { openid: 'seed_liubei', name: '刘备', figureId: 'fig-liubei' }
    ],
    createdAtOffset: -11.5
  },
  {
    seedKey: 'yuefei2',
    figureId: 'fig-yuefei',
    name: '岳飞',
    figureTitle: '岳武穆 · 荆湖北路帅司',
    dynasty: '宋',
    avatar: '',
    content: '直抵黄龙府，与诸君痛饮尔！朱仙镇大捷，金人北遁。待收复中原，再与将士痛饮黄龙！',
    images: [
      IMG.snow,
      IMG.mountain
    ],
    historicalEvent: '历史事件：朱仙镇大捷',
    historicalDate: '南宋 · 绍兴十年',
    likes: [
      { openid: 'seed_xinqiji', name: '辛弃疾', figureId: 'fig-xinqiji' },
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' }
    ],
    createdAtOffset: -12.1
  },
  {
    seedKey: 'zhaokuangyin1',
    figureId: 'fig-zhaokuangyin',
    name: '赵匡胤',
    figureTitle: '宋太祖 · 开国皇帝',
    dynasty: '宋',
    avatar: '',
    content: '人生如白驹过隙，所为好富贵，不过欲多积金钱，厚自娱乐，使子孙无贫乏耳。卿等何不释去兵权，出守大藩，择便好田宅市之，为子孙立永远不可动之业。今日与诸将宴饮，一杯清酒，换了兵权。',
    images: [
      IMG.food,
      IMG.architecture
    ],
    historicalEvent: '历史事件：杯酒释兵权',
    historicalDate: '北宋 · 建隆二年',
    likes: [
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' },
      { openid: 'seed_liubei', name: '刘备', figureId: 'fig-liubei' }
    ],
    createdAtOffset: -12.7
  },
  {
    seedKey: 'simaguang1',
    figureId: 'fig-simaguang',
    name: '司马光',
    figureTitle: '温国公 · 资政殿学士',
    dynasty: '宋',
    avatar: '',
    content: '鉴前世之兴衰，考当今之得失。穷究治乱之迹，成《资治通鉴》二百九十四卷，上起战国，下终五代，凡一千三百六十二年。伏望陛下赐览，以资政理。',
    images: [
      IMG.calligraphy
    ],
    historicalEvent: '作品出处：《资治通鉴》',
    historicalDate: '北宋 · 元丰七年',
    likes: [
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' },
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' }
    ],
    createdAtOffset: -13.3
  },
  {
    seedKey: 'liubang1',
    figureId: 'fig-liubang',
    name: '刘邦',
    figureTitle: '汉高祖 · 沛公',
    dynasty: '汉',
    avatar: '',
    content: '大风起兮云飞扬，威加海内兮归故乡，安得猛士兮守四方！今日还乡，宴父老子弟，酒酣击筑而歌。纵得天下，仍忧守成无人。',
    images: [
      IMG.mountain,
      IMG.sunset
    ],
    historicalEvent: '作品出处：《大风歌》',
    historicalDate: '汉 · 高祖十二年',
    likes: [
      { openid: 'seed_hanxin', name: '韩信', figureId: 'fig-hanxin' },
      { openid: 'seed_zhangliang', name: '张良', figureId: 'fig-zhangliang' },
      { openid: 'seed_xiaohe', name: '萧何', figureId: 'fig-xiaohe' },
      { openid: 'seed_liuche', name: '刘彻', figureId: 'fig-liuche' }
    ],
    createdAtOffset: -13.9
  },
  {
    seedKey: 'liuche1',
    figureId: 'fig-liuche',
    name: '刘彻',
    figureTitle: '汉武帝 · 建元改元',
    dynasty: '汉',
    avatar: '',
    content: '盖有非常之功，必待非常之人。故马或奔踶而致千里，士或有负俗之累而立功名。夫泛驾之马，跅弛之士，亦在御之而已。朕今下诏求贤，不拘一格，凡有非常之才，皆可上书自荐。',
    images: [
      IMG.calligraphy,
      IMG.architecture
    ],
    historicalEvent: '历史事件：汉武帝下求贤诏',
    historicalDate: '汉 · 元封五年',
    likes: [
      { openid: 'seed_huoqubing', name: '霍去病', figureId: 'fig-huoqubing' },
      { openid: 'seed_weiqing', name: '卫青', figureId: 'fig-weiqing' },
      { openid: 'seed_simaqian', name: '司马迁', figureId: 'fig-simaqian' },
      { openid: 'seed_zhangliang', name: '张良', figureId: 'fig-zhangliang' }
    ],
    createdAtOffset: -14.5
  },
  {
    seedKey: 'simaqian1',
    figureId: 'fig-simaqian',
    name: '司马迁',
    figureTitle: '太史公 · 中书令',
    dynasty: '汉',
    avatar: '',
    content: '究天人之际，通古今之变，成一家之言。网罗天下放失旧闻，考之行事，稽其成败兴坏之理。虽遭腐刑，忍辱负重，终成《太史公书》一百三十篇，藏之名山，副在京师，俟后世圣人君子。',
    images: [
      IMG.calligraphy,
      IMG.architecture
    ],
    historicalEvent: '作品出处：《史记·太史公自序》',
    historicalDate: '汉 · 太始年间',
    likes: [
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' },
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' }
    ],
    createdAtOffset: -15.1
  },
  {
    seedKey: 'hanxin1',
    figureId: 'fig-hanxin',
    name: '韩信',
    figureTitle: '淮阴侯 · 大将军',
    dynasty: '汉',
    avatar: '',
    content: '陷之死地而后生，置之亡地而后存。井陉之战，背水列阵，置之死地，士卒死战，遂破赵军二十万。兵法之妙，存乎一心。',
    images: [
      IMG.mountain,
      IMG.river
    ],
    historicalEvent: '历史事件：井陉之战',
    historicalDate: '汉 · 高祖三年',
    likes: [
      { openid: 'seed_liubang', name: '刘邦', figureId: 'fig-liubang' },
      { openid: 'seed_zhangliang', name: '张良', figureId: 'fig-zhangliang' },
      { openid: 'seed_xiaohe', name: '萧何', figureId: 'fig-xiaohe' }
    ],
    createdAtOffset: -15.7
  },
  {
    seedKey: 'huoqubing1',
    figureId: 'fig-huoqubing',
    name: '霍去病',
    figureTitle: '冠军侯 · 骠骑将军',
    dynasty: '汉',
    avatar: '',
    content: '匈奴未灭，何以家为！今率轻骑深入大漠两千余里，封狼居胥，禅于姑衍，登临瀚海。匈奴远遁，漠南无王庭。陛下赐第长安，去病辞之。',
    images: [
      IMG.desert,
      IMG.mountain,
      IMG.snow
    ],
    historicalEvent: '历史事件：封狼居胥',
    historicalDate: '汉 · 元狩四年',
    likes: [
      { openid: 'seed_liuche', name: '刘彻', figureId: 'fig-liuche' },
      { openid: 'seed_weiqing', name: '卫青', figureId: 'fig-weiqing' },
      { openid: 'seed_liubang', name: '刘邦', figureId: 'fig-liubang' }
    ],
    createdAtOffset: -16.3
  },
  {
    seedKey: 'weiqing1',
    figureId: 'fig-weiqing',
    name: '卫青',
    figureTitle: '长平侯 · 大将军',
    dynasty: '汉',
    avatar: '',
    content: '臣本平阳家奴，蒙陛下不弃，七征匈奴，未尝败绩。龙城大捷，收复河南地，漠北决战，匈奴单于遁逃。然臣功不及士卒效力，不敢独居其功。',
    images: [
      IMG.desert,
      IMG.mountain
    ],
    historicalEvent: '历史事件：卫青七征匈奴',
    historicalDate: '汉 · 元朔至元狩年间',
    likes: [
      { openid: 'seed_liuche', name: '刘彻', figureId: 'fig-liuche' },
      { openid: 'seed_huoqubing', name: '霍去病', figureId: 'fig-huoqubing' },
      { openid: 'seed_liubang', name: '刘邦', figureId: 'fig-liubang' }
    ],
    createdAtOffset: -16.9
  },
  {
    seedKey: 'zhangliang1',
    figureId: 'fig-zhangliang',
    name: '张良',
    figureTitle: '留侯 · 帝师',
    dynasty: '汉',
    avatar: '',
    content: '运筹帷幄之中，决胜千里之外。吾家世相韩，韩灭，弟死不葬，悉以家财求客刺秦。后佐高祖定天下，封留侯。今功成身退，欲从赤松子游。',
    images: [],
    historicalEvent: '历史事件：张良佐汉',
    historicalDate: '汉 · 高祖年间',
    likes: [
      { openid: 'seed_liubang', name: '刘邦', figureId: 'fig-liubang' },
      { openid: 'seed_xiaohe', name: '萧何', figureId: 'fig-xiaohe' },
      { openid: 'seed_hanxin', name: '韩信', figureId: 'fig-hanxin' }
    ],
    createdAtOffset: -17.5
  },
  {
    seedKey: 'xiaohe1',
    figureId: 'fig-xiaohe',
    name: '萧何',
    figureTitle: '酂侯 · 相国',
    dynasty: '汉',
    avatar: '',
    content: '镇国家，抚百姓，给馈饷不绝粮道。关中之事，吾一力担之。前方征战，后方粮草不断，方有今日之汉。月下追韩信，举荐于陛下，此生无悔。',
    images: [
      IMG.architecture,
      IMG.hills
    ],
    historicalEvent: '历史事件：萧何镇关中',
    historicalDate: '汉 · 楚汉相争',
    likes: [
      { openid: 'seed_liubang', name: '刘邦', figureId: 'fig-liubang' },
      { openid: 'seed_zhangliang', name: '张良', figureId: 'fig-zhangliang' },
      { openid: 'seed_hanxin', name: '韩信', figureId: 'fig-hanxin' }
    ],
    createdAtOffset: -18.1
  },
  {
    seedKey: 'banggu1',
    figureId: 'fig-banggu',
    name: '班固',
    figureTitle: '班孟坚 · 兰台令史',
    dynasty: '汉',
    avatar: '',
    content: '断代为史，继往开来。撰《汉书》百篇，起高祖，终王莽，纪十二帝，凡二百三十年。体例一承太史公而有所创新，断代为史，遂成后世正史之范。',
    images: [
      IMG.calligraphy
    ],
    historicalEvent: '作品出处：《汉书》',
    historicalDate: '汉 · 建初年间',
    likes: [
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' },
      { openid: 'seed_simaqian', name: '司马迁', figureId: 'fig-simaqian' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' }
    ],
    createdAtOffset: -18.7
  },
  {
    seedKey: 'zhugeliang1',
    figureId: 'fig-zhugeliang',
    name: '诸葛亮',
    figureTitle: '诸葛武侯 · 丞相',
    dynasty: '三国',
    avatar: '',
    content: '鞠躬尽瘁，死而后已。先帝创业未半而中道崩殂，今天下三分，益州疲弊，此诚危急存亡之秋也。臣受命以来，夙夜忧叹，恐托付不效。今率军北驻汉中，临表涕零，不知所言。',
    images: [
      IMG.calligraphy,
      IMG.mountain
    ],
    historicalEvent: '作品出处：《前出师表》',
    historicalDate: '三国 · 蜀汉建兴五年',
    likes: [
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' },
      { openid: 'seed_dufu', name: '杜甫', figureId: 'fig-dufu' },
      { openid: 'seed_wangwei', name: '王维', figureId: 'fig-wangwei' },
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' },
      { openid: 'seed_liqingzhao', name: '李清照', figureId: 'fig-liqingzhao' },
      { openid: 'seed_xinqiji', name: '辛弃疾', figureId: 'fig-xinqiji' },
      { openid: 'seed_huangtingjian', name: '黄庭坚', figureId: 'fig-huangtingjian' },
      { openid: 'seed_baijuyi', name: '白居易', figureId: 'fig-baijuyi' },
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' },
      { openid: 'seed_wuzetian', name: '武则天', figureId: 'fig-wuzetian' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' },
      { openid: 'seed_liubei', name: '刘备', figureId: 'fig-liubei' },
      { openid: 'seed_guanyu', name: '关羽', figureId: 'fig-guanyu' },
      { openid: 'seed_hanxin', name: '韩信', figureId: 'fig-hanxin' },
      { openid: 'seed_zhangliang', name: '张良', figureId: 'fig-zhangliang' }
    ],
    createdAtOffset: -19.3
  },
  {
    seedKey: 'zhugeliang2',
    figureId: 'fig-zhugeliang',
    name: '诸葛亮',
    figureTitle: '诸葛武侯 · 丞相',
    dynasty: '三国',
    avatar: '',
    content: '君子之行，静以修身，俭以养德。非淡泊无以明志，非宁静无以致远。夫学须静也，才须学也。写给八岁儿子的一封信，愿瞻儿此生修身立德，勿坠丞相府门风。',
    images: [
      IMG.calligraphy
    ],
    historicalEvent: '作品出处：《诫子书》',
    historicalDate: '三国 · 蜀汉',
    likes: [
      { openid: 'seed_liubei', name: '刘备', figureId: 'fig-liubei' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' },
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' }
    ],
    createdAtOffset: -19.9
  },
  {
    seedKey: 'caocao1',
    figureId: 'fig-caocao',
    name: '曹操',
    figureTitle: '魏武帝 · 丞相',
    dynasty: '三国',
    avatar: '',
    content: '对酒当歌，人生几何！譬如朝露，去日苦多。慨当以慷，忧思难忘。何以解忧？唯有杜康。青青子衿，悠悠我心。但为君故，沉吟至今。月明星稀，乌鹊南飞。绕树三匝，何枝可依？山不厌高，海不厌深。周公吐哺，天下归心。',
    images: [
      IMG.moon,
      IMG.sea
    ],
    historicalEvent: '作品出处：《短歌行》',
    historicalDate: '东汉末 · 建安年间',
    likes: [
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' },
      { openid: 'seed_dufu', name: '杜甫', figureId: 'fig-dufu' },
      { openid: 'seed_wangwei', name: '王维', figureId: 'fig-wangwei' },
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' },
      { openid: 'seed_liqingzhao', name: '李清照', figureId: 'fig-liqingzhao' },
      { openid: 'seed_xinqiji', name: '辛弃疾', figureId: 'fig-xinqiji' },
      { openid: 'seed_baijuyi', name: '白居易', figureId: 'fig-baijuyi' },
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' },
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' },
      { openid: 'seed_liubei', name: '刘备', figureId: 'fig-liubei' },
      { openid: 'seed_guanyu', name: '关羽', figureId: 'fig-guanyu' },
      { openid: 'seed_hanxin', name: '韩信', figureId: 'fig-hanxin' }
    ],
    createdAtOffset: -20.5
  },
  {
    seedKey: 'caocao2',
    figureId: 'fig-caocao',
    name: '曹操',
    figureTitle: '魏武帝 · 丞相',
    dynasty: '三国',
    avatar: '',
    content: '东临碣石，以观沧海。水何澹澹，山岛竦峙。树木丛生，百草丰茂。秋风萧瑟，洪波涌起。日月之行，若出其中；星汉灿烂，若出其里。幸甚至哉，歌以咏志。北征乌桓途中，登碣石山望海，胸怀天下。',
    images: [
      IMG.sea,
      IMG.sunset,
      IMG.mountain
    ],
    historicalEvent: '作品出处：《观沧海》',
    historicalDate: '东汉末 · 建安十二年',
    likes: [
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' },
      { openid: 'seed_liubei', name: '刘备', figureId: 'fig-liubei' },
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' }
    ],
    createdAtOffset: -21.1
  },
  {
    seedKey: 'caocao3',
    figureId: 'fig-caocao',
    name: '曹操',
    figureTitle: '魏武帝 · 丞相',
    dynasty: '三国',
    avatar: '',
    content: '神龟虽寿，犹有竟时。腾蛇乘雾，终为土灰。老骥伏枥，志在千里。烈士暮年，壮心不已。盈缩之期，不但在天；养怡之福，可得永年。吾虽年迈，平定天下之志未衰！',
    images: [
      IMG.sunset,
      IMG.mountain
    ],
    historicalEvent: '作品出处：《龟虽寿》',
    historicalDate: '东汉末 · 建安十二年',
    likes: [
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' },
      { openid: 'seed_liubei', name: '刘备', figureId: 'fig-liubei' }
    ],
    createdAtOffset: -21.7
  },
  {
    seedKey: 'guanyu1',
    figureId: 'fig-guanyu',
    name: '关羽',
    figureTitle: '关云长 · 前将军',
    dynasty: '三国',
    avatar: '',
    content: '吾来日独驾小舟，单刀赴会，看鲁肃能奈我何！湘水划界之事，吾自往鲁肃营中议之。刀在人在，何惧之有！',
    images: [
      IMG.river
    ],
    historicalEvent: '历史事件：单刀赴会',
    historicalDate: '三国 · 建安二十年',
    likes: [
      { openid: 'seed_liubei', name: '刘备', figureId: 'fig-liubei' },
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' }
    ],
    createdAtOffset: -22.3
  },
  {
    seedKey: 'liubei1',
    figureId: 'fig-liubei',
    name: '刘备',
    figureTitle: '汉昭烈帝 · 汉中王',
    dynasty: '三国',
    avatar: '',
    content: '孤之有孔明，犹鱼之有水也。三顾茅庐，方得卧龙。得孔明后，孤方知何为如虎添翼。愿与孔明共图大业，匡扶汉室。',
    images: [
      IMG.cottage,
      IMG.forest
    ],
    historicalEvent: '历史事件：三顾茅庐',
    historicalDate: '三国 · 建安十二年',
    likes: [
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' },
      { openid: 'seed_guanyu', name: '关羽', figureId: 'fig-guanyu' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' }
    ],
    createdAtOffset: -22.9
  },
  {
    seedKey: 'sunquan1',
    figureId: 'fig-sunquan',
    name: '孙权',
    figureTitle: '吴大帝 · 讨虏将军',
    dynasty: '三国',
    avatar: '',
    content: '孤与老贼势不两立！卿言当击，甚合孤意。拔剑斫案，再有言降者，与此案同！周公瑾已率水军西上，与刘备并力，共破曹贼于赤壁！',
    images: [
      IMG.river,
      IMG.sea
    ],
    historicalEvent: '历史事件：赤壁之战',
    historicalDate: '三国 · 建安十三年',
    likes: [
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' },
      { openid: 'seed_zhugeliang', name: '诸葛亮', figureId: 'fig-zhugeliang' },
      { openid: 'seed_liubei', name: '刘备', figureId: 'fig-liubei' }
    ],
    createdAtOffset: -23.5
  },
  {
    seedKey: 'simayi1',
    figureId: 'fig-simayi',
    name: '司马懿',
    figureTitle: '宣皇帝 · 太傅',
    dynasty: '三国',
    avatar: '',
    content: '忍人之所不能忍，方成人之所不能成。受巾帻妇人之辱，吾亦笑纳。五丈原对峙，坚壁不出，待其自毙。智者贵在乘时，时未至，唯有忍。',
    images: [],
    historicalEvent: '历史事件：五丈原之战',
    historicalDate: '三国 · 魏青龙二年',
    likes: [],
    createdAtOffset: -24.1
  },
  {
    seedKey: 'guojia1',
    figureId: 'fig-guojia',
    name: '郭嘉',
    figureTitle: '郭奉孝 · 军师祭酒',
    dynasty: '三国',
    avatar: '',
    content: '公有十胜，绍有十败，虽强弱悬殊，然胜负已分。道、义、治、度、谋、德、仁、明、文、武，公皆胜之。奉孝虽病，犹愿为公画策，平定北方。',
    images: [],
    historicalEvent: '历史事件：郭嘉十胜十败论',
    historicalDate: '三国 · 建安二年',
    likes: [],
    createdAtOffset: -24.7
  },
  {
    seedKey: 'zhuyuanzhang1',
    figureId: 'fig-zhuyuanzhang',
    name: '朱元璋',
    figureTitle: '明太祖 · 洪武帝',
    dynasty: '明',
    avatar: '',
    content: '驱逐胡虏，恢复中华，立纲陈纪，救济斯民。北伐檄文已下，徐达为征虏大将军，常遇春为副，率军二十五万北进。元祚将尽，大明当立！',
    images: [
      IMG.mountain,
      IMG.architecture
    ],
    historicalEvent: '历史事件：徐达北伐',
    historicalDate: '明 · 洪武元年',
    likes: [
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' },
      { openid: 'seed_liubang', name: '刘邦', figureId: 'fig-liubang' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' }
    ],
    createdAtOffset: -25.3
  },
  {
    seedKey: 'zhenghe1',
    figureId: 'fig-zhenghe',
    name: '郑和',
    figureTitle: '三保太监 · 钦差总兵',
    dynasty: '明',
    avatar: '',
    content: '宝船六十二艘，将士二万七千余人，遍历三十余国。率船队自苏州刘家港出海，远至忽鲁谟斯、阿丹、木骨都束。宣扬大明威德，互通有无，四海一家。',
    images: [
      IMG.sea,
      IMG.sunset
    ],
    historicalEvent: '历史事件：郑和下西洋',
    historicalDate: '明 · 永乐三年',
    likes: [
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' },
      { openid: 'seed_liuche', name: '刘彻', figureId: 'fig-liuche' }
    ],
    createdAtOffset: -25.9
  },
  {
    seedKey: 'kongzi1',
    figureId: 'fig-kongzi',
    name: '孔子',
    figureTitle: '至圣先师 · 万世师表',
    dynasty: '春秋',
    avatar: '',
    content: '自行束脩以上，吾未尝无诲焉。有教无类，因材施教。弟子三千，贤者七十二。颜回好学，子贡善辩，子路勇敢，各因其性而导之。',
    images: [
      IMG.calligraphy,
      IMG.architecture
    ],
    historicalEvent: '历史事件：孔子创办私学',
    historicalDate: '春秋 · 鲁国',
    likes: [
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' },
      { openid: 'seed_dufu', name: '杜甫', figureId: 'fig-dufu' },
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' },
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' }
    ],
    createdAtOffset: -26.5
  },
  {
    seedKey: 'chensheng1',
    figureId: 'fig-chensheng',
    name: '陈胜',
    figureTitle: '陈涉 · 张楚王',
    dynasty: '秦',
    avatar: '',
    content: '且壮士不死即已，死即举大名耳，王侯将相宁有种乎！大泽乡揭竿而起，天下响应。秦失其鹿，天下共逐之！',
    images: [],
    historicalEvent: '历史事件：大泽乡起义',
    historicalDate: '秦 · 二世元年',
    likes: [
      { openid: 'seed_liubang', name: '刘邦', figureId: 'fig-liubang' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' }
    ],
    createdAtOffset: -27.1
  },
  {
    seedKey: 'xiangyu1',
    figureId: 'fig-xiangyu',
    name: '项羽',
    figureTitle: '西楚霸王 · 重瞳',
    dynasty: '秦',
    avatar: '',
    content: '力拔山兮气盖世，时不利兮骓不逝。骓不逝兮可奈何，虞兮虞兮奈若何！垓下被围，四面楚歌，与虞姬诀别。天亡我，非战之罪！',
    images: [
      IMG.sunset,
      IMG.snow
    ],
    historicalEvent: '作品出处：《垓下歌》',
    historicalDate: '秦末 · 垓下',
    likes: [
      { openid: 'seed_liubang', name: '刘邦', figureId: 'fig-liubang' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' }
    ],
    createdAtOffset: -27.7
  },
  {
    seedKey: 'mulan1',
    figureId: 'fig-mulan',
    name: '花木兰',
    figureTitle: '巾帼英雄 · 代父从军',
    dynasty: '南北朝',
    avatar: '',
    content: '万里赴戎机，关山度若飞。朔气传金柝，寒光照铁衣。将军百战死，壮士十年归。卷卷军书皆有其名，阿爷年迈无长兄，木兰愿为市鞍马，从此替爷征。',
    images: [
      IMG.snow,
      IMG.mountain,
      IMG.forest
    ],
    historicalEvent: '作品出处：《木兰诗》',
    historicalDate: '南北朝 · 北朝民歌',
    likes: [
      { openid: 'seed_liqingzhao', name: '李清照', figureId: 'fig-liqingzhao' },
      { openid: 'seed_wuzetian', name: '武则天', figureId: 'fig-wuzetian' },
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' }
    ],
    createdAtOffset: -28.3
  },
  {
    seedKey: 'chenshou1',
    figureId: 'fig-chenshou',
    name: '陈寿',
    figureTitle: '陈承祚 · 著作郎',
    dynasty: '晋',
    avatar: '',
    content: '明乎得失之迹，存王道之正。撰《三国志》六十五篇，魏、蜀、吴三书并列。辞简而事备，善恶自见。虽时人有疑魏蜀正闰之争，然秉笔直书，不敢阿私。',
    images: [
      IMG.calligraphy
    ],
    historicalEvent: '作品出处：《三国志》',
    historicalDate: '晋 · 太康年间',
    likes: [
      { openid: 'seed_sushi', name: '苏轼', figureId: 'fig-sushi' },
      { openid: 'seed_simaqian', name: '司马迁', figureId: 'fig-simaqian' },
      { openid: 'seed_caocao', name: '曹操', figureId: 'fig-caocao' }
    ],
    createdAtOffset: -28.9
  },
  {
    seedKey: 'huangdi1',
    figureId: 'fig-huangdi',
    name: '黄帝',
    figureTitle: '轩辕氏 · 华夏始祖',
    dynasty: '上古',
    avatar: '',
    content: '播百谷草木，创医药历法。涿鹿一战定乾坤，擒杀蚩尤，诸侯宾从。华夏自此为一统。命仓颉造字，伶伦作律，嫘祖养蚕，文明始开。',
    images: [
      IMG.mountain,
      IMG.hills
    ],
    historicalEvent: '历史事件：涿鹿之战',
    historicalDate: '上古 · 黄帝时代',
    likes: [
      { openid: 'seed_libai', name: '李白', figureId: 'fig-libai' },
      { openid: 'seed_lishimin', name: '李世民', figureId: 'fig-lishimin' },
      { openid: 'seed_liubang', name: '刘邦', figureId: 'fig-liubang' }
    ],
    createdAtOffset: -29.5
  }
]

const COMMENT_SEED = {
  libai1: [
    {
      content: '太白此诗，气势如虹！"飞流直下三千尺，疑是银河落九天"真乃千古名句。',
      name: '杜甫',
      figureId: 'fig-dufu',
      figureTitle: '诗圣 · 检校工部员外郎',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 12
    },
    {
      content: '多谢子美兄谬赞！兄台「三吏三别」方为诗史也。',
      name: '李白',
      figureId: 'fig-libai',
      figureTitle: '诗仙 · 供奉翰林',
      dynasty: '唐',
      avatar: '',
      replyTo: 'seed_dufu',
      replyName: '杜甫',
      hoursAgo: 10
    },
    {
      content: '此景、此情、此诗，入画也！当以泼墨山水配之。',
      name: '王维',
      figureId: 'fig-wangwei',
      figureTitle: '诗佛 · 尚书右丞',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 8
    }
  ],
  libai3: [
    {
      content: '太白兄「天生我材必有用，千金散尽还复来」，豪气干云！读之令人胸襟大开。',
      name: '杜甫',
      figureId: 'fig-dufu',
      figureTitle: '诗圣 · 检校工部员外郎',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 6
    },
    {
      content: '将进酒一诗，我每读必浮一大白！「人生得意须尽欢」——太白兄诚我辈酒友也。',
      name: '苏轼',
      figureId: 'fig-sushi',
      figureTitle: '东坡居士 · 龙图阁学士',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 4
    }
  ],
  dufu2: [
    {
      content: '子美「安得广厦千万间，大庇天下寒士俱欢颜」——仁者之心，令人动容。吾辈诗人，当如是！',
      name: '李白',
      figureId: 'fig-libai',
      figureTitle: '诗仙 · 供奉翰林',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 20
    },
    {
      content: '乐府之精神，正在于此。子美兄心怀天下，新乐府运动受兄影响深远。',
      name: '白居易',
      figureId: 'fig-baijuyi',
      figureTitle: '香山居士 · 左拾遗',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 16
    }
  ],
  baijuyi1: [
    {
      content: '"在天愿作比翼鸟，在地愿为连理枝"——乐天兄此句，道尽人间至情。易安读之泪下。',
      name: '李清照',
      figureId: 'fig-liqingzhao',
      figureTitle: '易安居士 · 婉约宗主',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 30
    },
    {
      content: '乐天兄《长恨歌》一气呵成，叙事抒情交融，吾《长恨歌》读百遍而不厌。',
      name: '苏轼',
      figureId: 'fig-sushi',
      figureTitle: '东坡居士 · 龙图阁学士',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 24
    }
  ],
  sushi1: [
    {
      content: '东坡先生的猪肉颂，真乃人间烟火也。慢着火少着水，妙哉妙哉！下次黄州聚首，定当讨教一碗。',
      name: '李清照',
      figureId: 'fig-liqingzhao',
      figureTitle: '易安居士 · 婉约宗主',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 4
    },
    {
      content: '哈哈，易安妹子若是来，我亲自下厨。除了猪肉，我这还有东坡羹、东坡肘子，管够！',
      name: '苏轼',
      figureId: 'fig-sushi',
      figureTitle: '东坡居士 · 龙图阁学士',
      dynasty: '宋',
      avatar: '',
      replyTo: 'seed_liqingzhao',
      replyName: '李清照',
      hoursAgo: 2
    }
  ],
  sushi2: [
    {
      content: '东坡兄「但愿人长久，千里共婵娟」——妙哉！吾亦爱月之人，「举杯邀明月」与兄此句，可作姊妹篇。',
      name: '李白',
      figureId: 'fig-libai',
      figureTitle: '诗仙 · 供奉翰林',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 18
    },
    {
      content: '"人有悲欢离合，月有阴晴圆缺"——东坡兄豁达至此，易安佩服。',
      name: '李清照',
      figureId: 'fig-liqingzhao',
      figureTitle: '易安居士 · 婉约宗主',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 12
    }
  ],
  liqingzhao1: [
    {
      content: '"绿肥红瘦"，四字道尽暮春心事。易安此阙，当为婉约压卷之作。',
      name: '辛弃疾',
      figureId: 'fig-xinqiji',
      figureTitle: '词中之龙 · 浙东安抚使',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 36
    }
  ],
  yuefei1: [
    {
      content: '将军豪情，令人敬仰！收复中原，还我河山——我辈虽为文人，亦愿执笔从戎，随将军左右！',
      name: '辛弃疾',
      figureId: 'fig-xinqiji',
      figureTitle: '词中之龙 · 浙东安抚使',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 1
    },
    {
      content: '鹏举兄壮志凌云，精忠报国之心，日月可鉴！吾皇若能重用将军，何愁中原不复！',
      name: '陆游',
      figureId: 'fig-luyou',
      figureTitle: '放翁 · 宝章阁待制',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 0.5
    }
  ],
  lishimin1: [
    {
      content: '太宗陛下「三镜」之论，武曌受教。治国当以史为鉴，以人为镜。',
      name: '武则天',
      figureId: 'fig-wuzetian',
      figureTitle: '圣神皇帝 · 改唐为周',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 48
    },
    {
      content: '陛下贞观之治，海内升平，亮深为钦佩。「以人为镜」四字，亦亮一生所守。',
      name: '诸葛亮',
      figureId: 'fig-zhugeliang',
      figureTitle: '诸葛武侯 · 丞相',
      dynasty: '三国',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 40
    }
  ],
  wuzetian1: [
    {
      content: '武才人开创殿试，选拔真才，颇有朕当年遗风。社稷有人，天下幸甚。',
      name: '李世民',
      figureId: 'fig-lishimin',
      figureTitle: '唐太宗 · 天可汗',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 60
    }
  ],
  caocao1: [
    {
      content: '孟德「周公吐哺，天下归心」——求贤若渴之心，亮亦感同身受。然王道之辨，你我殊途。',
      name: '诸葛亮',
      figureId: 'fig-zhugeliang',
      figureTitle: '诸葛武侯 · 丞相',
      dynasty: '三国',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 50
    },
    {
      content: '孟德兄之诗，气魄宏大。然「天下归心」四字，恐非一言可致。',
      name: '刘备',
      figureId: 'fig-liubei',
      figureTitle: '汉昭烈帝 · 汉中王',
      dynasty: '三国',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 44
    }
  ],
  zhugeliang1: [
    {
      content: '孔明！孤读此表，泪湿衣襟。有丞相辅佐，汉室中兴有望！',
      name: '刘备',
      figureId: 'fig-liubei',
      figureTitle: '汉昭烈帝 · 汉中王',
      dynasty: '三国',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 5
    },
    {
      content: '孔明忠义，操虽为敌，亦心生敬意。鞠躬尽瘁，死而后已——非大丈夫不能为。',
      name: '曹操',
      figureId: 'fig-caocao',
      figureTitle: '魏武帝 · 丞相',
      dynasty: '三国',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 3
    }
  ],
  simaqian1: [
    {
      content: '太史公「究天人之际，通古今之变」——史家绝唱，无韵离骚。轼受教！',
      name: '苏轼',
      figureId: 'fig-sushi',
      figureTitle: '东坡居士 · 龙图阁学士',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 28
    }
  ],
  huoqubing1: [
    {
      content: '去病豪情「匈奴未灭，何以家为」——为舅亦感骄傲。漠北一战，我甥舅二人共破单于，永载史册！',
      name: '卫青',
      figureId: 'fig-weiqing',
      figureTitle: '长平侯 · 大将军',
      dynasty: '汉',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 14
    }
  ],
  kongzi1: [
    {
      content: '夫子「有教无类」，开万世师表。后世诗人皆受夫子教化之恩。',
      name: '李白',
      figureId: 'fig-libai',
      figureTitle: '诗仙 · 供奉翰林',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 70
    },
    {
      content: '夫子之道，仁而已矣。「因材施教」四字，吾辈终身受用。',
      name: '杜甫',
      figureId: 'fig-dufu',
      figureTitle: '诗圣 · 检校工部员外郎',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 65
    }
  ]
}

async function checkAdmin(OPENID) {
  if (!OPENID) return '未登录'
  try {
    const res = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (!res.data || res.data.length === 0) return '用户不存在'
    const role = res.data[0].role || 'user'
    if (role !== 'admin' && role !== 'superadmin') return '无管理员权限'
    return null
  } catch (e) {
    return '鉴权失败'
  }
}

exports.main = async (event, context) => {
  const id = resolveIdentity(event, cloud.getWXContext())
  const { OPENID } = cloud.getWXContext()
  const adminErr = await checkAdmin(OPENID)
  if (adminErr) return { code: -1, message: adminErr }

  const { force = false } = event || {}
  const targetFigureIds = MOMENT_SEED.map(m => m.figureId)

  try {
    const existing = await db.collection('moments').where({
      figureId: _.in(targetFigureIds)
    }).limit(1).get()

    if (existing.data.length && !force) {
      return {
        code: 0,
        message: '测试数据已存在（fig-libai 等），使用 { force: true } 删除旧数据后重新插入'
      }
    }

    if (force) {
      const clearMoments = await db.collection('moments').where({
        figureId: _.in(targetFigureIds)
      }).remove()
      console.log('Clear moments:', clearMoments.stats.removed)
      try {
        const clearComments = await db.collection('moment_comments').where({
          momentId: db.RegExp({ regexp: '.*', options: 'i' })
        }).remove()
        const all = await db.collection('moment_comments').where({
          figureId: _.in(['fig-dufu', 'fig-wangwei', 'fig-liqingzhao', 'fig-xinqiji', 'fig-libai', 'fig-sushi', 'fig-luyou'])
        }).get()
        const idsToRemove = all.data.map(c => c._id)
        if (idsToRemove.length) {
          for (const id of idsToRemove) {
            try { await db.collection('moment_comments').doc(id).remove() } catch (_) {}
          }
        }
        console.log('Clear comments related:', all.data.length)
      } catch (e) {
        console.warn('Clear comments warn:', e.message)
      }
    }

    const insertedIds = []
    for (let i = 0; i < MOMENT_SEED.length; i++) {
      const m = MOMENT_SEED[i]
      const now = Date.now()
      const createdAtTs = now + (m.createdAtOffset || 0) * 86400000
      const doc = {
        figureId: m.figureId,
        name: m.name,
        figureTitle: m.figureTitle,
        dynasty: m.dynasty,
        avatar: m.avatar || '',
        content: m.content,
        images: Array.isArray(m.images) ? m.images.slice(0, 9) : [],
        historicalEvent: m.historicalEvent || '',
        historicalDate: m.historicalDate || '',
        location: '',
        visibility: 'public',
        likes: Array.isArray(m.likes) ? m.likes : [],
        commentCount: 0,
        createdAt: new Date(createdAtTs),
        updatedAt: new Date(now)
      }
      const r = await db.collection('moments').add({ data: attachOwnerFields(doc, id, db, { autoCreate: true }) })
      insertedIds.push({
        momentId: r._id,
        seedKey: m.seedKey,
        comments: COMMENT_SEED[m.seedKey] || [],
        createdAtTs
      })
    }

    let insertedCommentCount = 0
    for (let i = 0; i < insertedIds.length; i++) {
      const { momentId, comments, createdAtTs } = insertedIds[i]
      for (let j = 0; j < comments.length; j++) {
        const c = comments[j]
        const hoursAgo = typeof c.hoursAgo === 'number' ? c.hoursAgo : 1
        const doc = {
          momentId,
          name: c.name,
          avatar: c.avatar || '',
          dynasty: c.dynasty || '',
          figureId: c.figureId || '',
          figureTitle: c.figureTitle || '',
          content: c.content,
          replyTo: c.replyTo || '',
          replyName: c.replyName || '',
          authorSnapshot: {
            name: c.name,
            avatar: c.avatar || '',
            openid: 'seed_' + (c.figureId || ('u' + Math.random().toString(36).slice(2, 6)))
          },
          likes: [],
          createdAt: new Date(createdAtTs + hoursAgo * 3600000)
        }
        await db.collection('moment_comments').add({ data: attachOwnerFields(doc, id, db, { autoCreate: true }) })
        insertedCommentCount++
      }
      if (comments.length) {
        await db.collection('moments').doc(momentId).update({
          data: attachOwnerFields({ commentCount: _.set(comments.length) }, id, db)
        })
      }
    }

    return {
      code: 0,
      message: 'ok',
      data: {
        insertedMoments: insertedIds.length,
        insertedComments: insertedCommentCount,
        ids: insertedIds.map(x => ({ seedKey: x.seedKey, momentId: x.momentId, commentCount: x.comments.length }))
      }
    }
  } catch (err) {
    console.error('seedMoments err:', err)
    return {
      code: -1,
      message: 'seed fail'
    }
  }
}