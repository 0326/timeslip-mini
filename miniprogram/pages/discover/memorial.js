const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')
const { uid, sleep } = require('../../utils/helpers')

const CHAPTERS = [
  { key: 'all', name: '全部' },
  { key: 'han', name: '大汉篇' },
  { key: 'sanguo', name: '三国篇' },
  { key: 'tang', name: '盛唐篇' },
  { key: 'song', name: '赵宋篇' },
  { key: 'ming', name: '朱明篇' }
]

const MOCK_MEMORIALS = [
  {
    _id: 'mem_001',
    chapter: '大汉篇',
    dynasty: 'han',
    dynastyName: '西汉',
    title: '韩信请封齐王奏',
    submitter: '韩信',
    order: 1,
    content: '齐地反复多变，南临西楚，非假王不足以镇抚之。臣愿假齐王之号，安抚齐民，以备项羽。\n\n方今楚汉相持，胜负未决。齐地新附，人心未稳，若不假以王号，恐生异变。臣虽不才，愿为陛下东守藩篱，西扼项氏。\n\n伏惟陛下圣裁。',
    options: [
      { key: 'A', text: '准奏，封韩信为真齐王', hint: '笼络韩信，使其死心塌地效力' },
      { key: 'B', text: '驳回，命其回师增援', hint: '削弱其兵权，防止尾大不掉' },
      { key: 'C', text: '先削其兵权，再行封赏', hint: '张良之计：踩脚暗示，稳其心' }
    ],
    historicalOutcome: '真实历史：刘邦初闻大怒，张良、陈平暗中踩其脚。刘邦顿悟，改口曰：「大丈夫定诸侯，即为真王耳，何以假为！」遂封韩信为齐王。韩信得封后，引兵击楚，终助刘邦得天下。',
    unlocked: true,
    prerequisites: []
  },
  {
    _id: 'mem_002',
    chapter: '三国篇',
    dynasty: 'sanguo',
    dynastyName: '蜀汉',
    title: '出师表',
    submitter: '诸葛亮',
    order: 2,
    content: '先帝创业未半，而中道崩殂。今天下三分，益州疲弊，此诚危急存亡之秋也。\n\n臣本布衣，躬耕于南阳，苟全性命于乱世，不求闻达于诸侯。先帝不以臣卑鄙，猥自枉屈，三顾臣于草庐之中。\n\n今南方已定，兵甲已足，当奖率三军，北定中原，庶竭驽钝，攘除奸凶，兴复汉室，还于旧都。',
    options: [
      { key: 'A', text: '准奏，全力支持北伐', hint: '倾全国之力，以图恢复' },
      { key: 'B', text: '暂缓，休养生息数年', hint: '国力未充，不宜冒进' },
      { key: 'C', text: '分兵，先取西凉再图长安', hint: '步步为营，稳扎稳打' }
    ],
    historicalOutcome: '真实历史：刘禅准奏，诸葛亮六出祁山，鞠躬尽瘁死而后已。然蜀小国寡民，连年征战国力益衰，终为魏所灭。',
    unlocked: true,
    prerequisites: []
  },
  {
    _id: 'mem_003',
    chapter: '盛唐篇',
    dynasty: 'tang',
    dynastyName: '唐',
    title: '废王立武奏',
    submitter: '李义府',
    order: 3,
    content: '王皇后无子，武昭仪有子，恳请陛下废王皇后，立武昭仪为后。\n\n皇后母族柳氏势大，久怀怨望。武昭仪贤良淑德，素有令名，且为陛下育有子嗣，宜居正位。\n\n此非止陛下家事，实乃国之重事。伏请圣断。',
    options: [
      { key: 'A', text: '准奏，废王立武', hint: '顺应帝心，巩固皇权' },
      { key: 'B', text: '留中不发，维持现状', hint: '避免激化与长孙无忌等老臣的矛盾' },
      { key: 'C', text: '严加斥责，贬上书人', hint: '稳住老臣，以示无废后之心' }
    ],
    historicalOutcome: '真实历史：唐高宗力排众议，废王立武。武氏后成一代女皇，改唐为周。李唐宗室多遭屠戮，然武则天治宏贞观政启开元，亦是一代明君。',
    unlocked: true,
    prerequisites: []
  }
]

Page({
  data: {
    loading: true,
    chapters: CHAPTERS,
    activeChapter: 'all',
    memorialList: [],
    memorial: null,
    selectedOpt: '',
    zhupi: '',
    simulating: false,
    simulationResult: null,
    nextMemorialId: null
  },

  onLoad() {
    this.loadMemorialList()
  },

  async loadMemorialList() {
    try {
      const data = await requestCloud('memorial', 'list', { chapter: this.data.activeChapter }, { throwError: false })
      let list = (data && data.list) || MOCK_MEMORIALS
      const progress = storage.get('memorial_progress') || {}
      list = list.map(m => ({
        ...m,
        completed: !!progress[m._id],
        userChoice: progress[m._id] ? progress[m._id].choice : '',
        dynastyName: m.dynastyName || this.getDynastyName(m.dynasty)
      }))
      this.setData({ memorialList: list })
    } catch (e) {
      this.setData({ memorialList: MOCK_MEMORIALS })
    } finally {
      this.setData({ loading: false })
    }
  },

  getDynastyName(key) {
    const m = { han: '西汉', sanguo: '三国', tang: '唐', song: '宋', ming: '明', qing: '清' }
    return m[key] || key
  },

  selectChapter(e) {
    const { key } = e.currentTarget.dataset
    this.setData({ activeChapter: key }, () => {
      if (key === 'all') {
        this.setData({ memorialList: MOCK_MEMORIALS.map(m => ({ ...m, dynastyName: this.getDynastyName(m.dynasty) })) })
      } else {
        this.setData({
          memorialList: MOCK_MEMORIALS.filter(m => m.dynasty === key)
            .map(m => ({ ...m, dynastyName: this.getDynastyName(m.dynasty) }))
        })
      }
    })
  },

  selectMemorial(e) {
    const { id } = e.currentTarget.dataset
    const item = this.data.memorialList.find(m => m._id === id)
    if (!item || !item.unlocked) {
      wx.showToast({ title: '请先完成前置奏折', icon: 'none' })
      return
    }
    this.setData({
      memorial: item,
      selectedOpt: '',
      zhupi: '',
      simulationResult: null
    })
  },

  selectOption(e) {
    const { key } = e.currentTarget.dataset
    this.setData({ selectedOpt: key })
  },

  onZhupiInput(e) {
    this.setData({ zhupi: e.detail.value })
  },

  async onDecide() {
    const { selectedOpt, memorial, zhupi } = this.data
    if (!selectedOpt) return

    this.setData({ simulating: true })
    try {
      await sleep(2500)
      const data = await requestCloud('memorial', 'decide', {
        memorialId: memorial._id,
        decision: selectedOpt,
        zhupi: zhupi
      }, { throwError: false })

      const result = data || this.generateMockResult(memorial, selectedOpt)
      const progress = storage.get('memorial_progress') || {}
      progress[memorial._id] = {
        choice: selectedOpt,
        zhupi,
        result: result,
        completedAt: Date.now()
      }
      storage.set('memorial_progress', progress, 86400 * 30)

      const idx = this.data.memorialList.findIndex(m => m._id === memorial._id)
      const nextMem = this.data.memorialList[idx + 1]
      this.setData({
        simulating: false,
        simulationResult: result,
        nextMemorialId: nextMem ? nextMem._id : null
      })
    } catch (e) {
      const result = this.generateMockResult(memorial, selectedOpt)
      this.setData({ simulating: false, simulationResult: result })
    }
  },

  generateMockResult(memorial, choice) {
    const outcomes = {
      'mem_001_A': {
        outcome: 'better',
        choiceText: 'A. 准奏，封韩信为真齐王',
        threeMonthsLater: '韩信得封齐王，心下大悦，立即派灌婴率骑兵南下，直捣彭城。项羽腹背受敌，粮道断绝，军心涣散。三个月间，韩信连下七十余城，西楚版图日蹙。天下大势已定矣。',
        aiComment: '此乃高帝之智也！始则怒，终则喜，借假王之求，收真王之效。韩信感厚遇之恩，必效死命；诸侯闻高帝之量，莫不倾心。此一举而项羽失天下半矣。然日后韩信功高震主，亦伏后祸，此为帝王之权衡也。'
      },
      'mem_001_B': {
        outcome: 'worse',
        choiceText: 'B. 驳回，命其回师增援',
        threeMonthsLater: '韩信接诏后心下怏怏，部将多有怨言。齐地豪族闻之，复叛归楚。项羽闻齐地有变，遣项它率两万精兵驰援，与田横合兵一处。韩信三面受敌，形势危急，连向荥阳催粮三次。',
        aiComment: '此非明主之所为也！方今用人之际，当顺其欲而用其力。韩信一怒，则齐地非汉所有；田横项它合兵，则东方糜烂。高帝岂不闻「将欲取之，必先予之」？惜乎，惜乎！'
      },
      'mem_001_C': {
        outcome: 'neutral',
        choiceText: 'C. 先削其兵权，再行封赏',
        threeMonthsLater: '韩信虽得齐王之号，然兵权已分属曹参、灌婴诸将，心知见疑，行事渐趋谨慎。齐地既安，楚不得东下，汉亦无西进之力。楚汉相持之势，仍在成皋之间。',
        aiComment: '陈平、张良之计，本在「顺其意而稳其心」。若先削兵权，则韩信虽不言，心已寒矣。君臣嫌隙既生，纵得天下，亦难相安。然目前而言，齐地暂稳，项氏不能东，尚算持平之策。'
      },
      'mem_002_A': {
        outcome: 'neutral',
        choiceText: 'A. 全力支持北伐',
        threeMonthsLater: '诸葛丞相率十万大军出祁山，天水、南安、安定三郡叛魏应亮，关中响震。然街亭一役，马谡违亮节度，为张郃所破。蜀军粮尽，拔西县千余家退还汉中。',
        aiComment: '先帝遗愿，丞相忠心，可感动天，然不能移地也。蜀地险塞，易守难攻；反之出蜀亦然。以一州之地抗九州之众，纵使武侯复生，亦难长久。然「鞠躬尽瘁死而后已」，其志可嘉，其名不朽！'
      },
      'mem_002_B': {
        outcome: 'better',
        choiceText: 'B. 暂缓，休养生息',
        threeMonthsLater: '后主从谯周之议，罢北伐之师，劝农桑，兴水利，薄赋税。蜀地殷富，百姓安居。魏主曹睿闻之，谓群臣曰：「诸葛亮养民练兵，志不在小。」然大敌在北，吴亦虎视，两方相安。',
        aiComment: '此富国养民之策也！蜀地虽小，然天府之国，物产丰饶。若能闭关息民，十年生聚十年教训，待天下有变，再行北伐，或有可为。惜乎丞相心急，恨不得于有生之年还于旧都。'
      },
      'mem_002_C': {
        outcome: 'neutral',
        choiceText: 'C. 先取西凉再图长安',
        threeMonthsLater: '魏延率奇兵出子午谷，兼程十日抵长安。夏侯楙果然弃城而走。然张郃引军五万自陇右急援，与魏延相持于渭水。诸葛亮主力取陇西四郡，得羌人相助，势如破竹。',
        aiComment: '魏延子午谷之策，千百年来争论不休。今行此策，幸而得成，然亦险矣！夏侯楙膏粱子弟耳，若换司马懿，魏延危哉！兵者诡道，岂可常行险侥幸？丞相平生谨慎，终不取此。'
      },
      'mem_003_A': {
        outcome: 'neutral',
        choiceText: 'A. 准奏，废王立武',
        threeMonthsLater: '武氏正位中宫，长孙无忌、褚遂良等老臣先后被贬。许敬宗、李义府辈见用。帝苦头重，不能视事，百司奏事，或使皇后决之。后性明敏，涉猎文史，处事皆称旨。由是始委以政事，权与人主侔矣。',
        aiComment: '「女主武王」之谶，终成现实。然武氏之才，岂在男子之下？用人行政，皆有可观。然则李唐宗室，几被杀尽，此亦代价惨重。设身处地而论，高宗此断，是福是祸，未易言也。'
      },
      'mem_003_B': {
        outcome: 'better',
        choiceText: 'B. 留中不发，维持现状',
        threeMonthsLater: '高宗虽有废后之意，然顾命大臣犹在，遂搁置此议。武昭仪宠冠六宫，然终不得正位。太子李忠渐长，王皇后虽无宠，中宫之位尚稳，长孙无忌等老臣心下稍安。',
        aiComment: '或曰：「不废皇后，则武则天何以称帝？」然否！即便武氏为后，若高宗能久视，亦未必有武周之祸。今存王皇后，以分武氏之势，未始非计。况长孙无忌、褚遂良皆太宗顾命之臣，不用可惜。'
      },
      'mem_003_C': {
        outcome: 'worse',
        choiceText: 'C. 严加斥责，贬上书人',
        threeMonthsLater: '李义府被贬壁州司马，朝堂之上一时噤若寒蝉。武昭仪失此奥援，宠虽未衰，然外廷无人，势渐孤。长孙无忌、褚遂良等更上奏折，请抑后宫之权，高宗夹在中间，左右为难，夫妻间渐生嫌隙。',
        aiComment: '「堵不如疏」，此之谓也！李义府不过一马前卒，贬之何益？武昭仪既承恩宠，必有更多投机者。贬李义府一人，不过扬汤止沸耳。且武氏怀怨，日后必更惨烈！'
      }
    }
    const key = memorial._id + '_' + choice
    const mock = outcomes[key] || outcomes['mem_001_C']
    return mock
  },

  goNext() {
    const id = this.data.nextMemorialId
    if (!id) return
    this.setData({ memorial: null, simulationResult: null })
    setTimeout(() => {
      const item = this.data.memorialList.find(m => m._id === id)
      if (item) this.selectMemorial({ currentTarget: { dataset: { id } } })
    }, 100)
  },

  backToList() {
    this.setData({
      memorial: null,
      simulationResult: null,
      selectedOpt: '',
      zhupi: ''
    })
    this.loadMemorialList()
  }
})
