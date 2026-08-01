const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')
const { sleep, uid } = require('../../utils/helpers')
const { CONTENT_SECURITY } = require('../../utils/constants')
const loginGuard = require('../../utils/loginGuard')

const FIGURE_LIST = [
  { figureId: 'simaqian', figureName: '司马迁', figureTitle: '太史公', dynasty: 'han', dynastyName: '西汉', avatar: 'https://img.icons8.com/color/96/emperor.png' },
  { figureId: 'libai', figureName: '李白', figureTitle: '诗仙', dynasty: 'tang', dynastyName: '盛唐', avatar: 'https://img.icons8.com/color/96/poet.png' },
  { figureId: 'sushi', figureName: '苏轼', figureTitle: '东坡居士', dynasty: 'song', dynastyName: '北宋', avatar: 'https://img.icons8.com/color/96/writer.png' },
  { figureId: 'zhugeliang', figureName: '诸葛亮', figureTitle: '武乡侯', dynasty: 'sanguo', dynastyName: '三国·蜀', avatar: 'https://img.icons8.com/color/96/general.png' },
  { figureId: 'wuzetian', figureName: '武则天', figureTitle: '则天大圣皇帝', dynasty: 'tang', dynastyName: '武周', avatar: 'https://img.icons8.com/color/96/queen.png' },
  { figureId: 'libang', figureName: '刘邦', figureTitle: '汉高祖', dynasty: 'han', dynastyName: '西汉', avatar: 'https://img.icons8.com/color/96/king.png' },
  { figureId: 'hanwu', figureName: '刘彻', figureTitle: '汉武帝', dynasty: 'han', dynastyName: '西汉', avatar: 'https://img.icons8.com/color/96/king.png' },
  { figureId: 'yuefei', figureName: '岳飞', figureTitle: '岳武穆', dynasty: 'song', dynastyName: '南宋', avatar: 'https://img.icons8.com/color/96/samurai.png' }
]

const REPLY_TEMPLATES = {
  simaqian: [
    '来函已悉，甚感君心。读史可知兴替，观人可明得失。君之心事，如夏日之阴，非言不能解也。',
    '太史公曰：天下熙熙，皆为利来；天下攘攘，皆为利往。然君之所求，似有超乎利者，此乃君子之风也。',
    '网罗天下放失旧闻，考之行事。君之来函，使吾忆起当年布衣游历之时，甚念甚念。'
  ],
  libai: [
    '哈哈哈！来信妙极！人生得意须尽欢，莫使金樽空对月。君若有酒，当共饮之！',
    '飞流直下三千尺，疑是银河落九天。读君之信，胸中豪气顿生，真想与君把盏言欢！',
    '天生我材必有用，千金散尽还复来。莫愁前路无知己，吾乃青莲居士李太白也！'
  ],
  sushi: [
    '竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。读君之信，觉君亦有旷达之心，甚慰。',
    '黄州惠州儋州，吾一生颠沛，然未尝一日忘食也。不知君可尝过东坡肉乎？',
    '但愿人长久，千里共婵娟。君之所在，虽隔千载，然此心同此情同。'
  ],
  zhugeliang: [
    '鞠躬尽瘁，死而后已。君之所忧，亮已知之。凡事谋定而后动，可也。',
    '非淡泊无以明志，非宁静无以致远。愿君守此二语，终身受用不尽。',
    '先帝创业未半，而中道崩殂。读君之语，使吾忆起隆中对策之时，感慨系之。'
  ],
  wuzetian: [
    '朕览毕此信，知君非寻常之人。事成于密，败于泄，君其慎之。',
    '自古男子能为之事，女子何独不能？君若有大志，但去做，勿惧人言。',
    '无字碑上，功过留与后人评。朕之一生，无怨无悔。愿君亦能如此。'
  ],
  libang: [
    '大丈夫生当如此！读君之信，有吞吐天下之志，甚合吾意！',
    '运筹帷帐之中，决胜千里之外，吾不如子房。然吾能用之，此乃取天下之道也。',
    '大风起兮云飞扬，威加海内兮归故乡！君可有壮志豪情？且说与朕听！'
  ],
  hanwu: [
    '寇可往，我亦可往！匈奴未灭，何以家为？君若有此心，当为大丈夫！',
    '罢黜百家，独尊儒术。治大国若烹小鲜，不可不慎，亦不可不惧。',
    '金屋藏娇，已是过往；汉武盛世，方为吾志。读君之信，甚合朕意。'
  ],
  yuefei: [
    '靖康耻，犹未雪；臣子恨，何时灭！读君之书，怒发冲冠！',
    '精忠报国，此吾毕生之志。君若男儿，当有此心。',
    '三十功名尘与土，八千里路云和月。莫等闲白了少年头，空悲切！'
  ]
}

Page({
  data: {
    letterContent: '',
    selectedFigure: null,
    figureList: FIGURE_LIST,
    showPicker: false,
    canSend: false,
    sending: false,
    reply: null
  },

  onLoad() {
    const cached = storage.get('figures_common_v1')
    if (cached && cached.length) this.setData({ figureList: cached })
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  onInput(e) {
    const content = e.detail.value || ''
    const canSend = content.trim().length > 0 && !!this.data.selectedFigure
    this.setData({ letterContent: content, canSend })
  },

  openFigurePicker() { this.setData({ showPicker: true }) },
  closeFigurePicker() { this.setData({ showPicker: false }) },
  stopProp() {},

  selectFigure(e) {
    const { item } = e.currentTarget.dataset
    const canSend = this.data.letterContent.trim().length > 0
    this.setData({
      selectedFigure: item,
      showPicker: false,
      canSend
    })
  },

  async onSend() {
    const { selectedFigure, letterContent, canSend } = this.data
    if (!canSend) return

    try {
      const check = await requestCloud('contentCheck', 'text', { content: letterContent }, { throwError: false })
      if (check && check.ok === false) {
        wx.showToast({ title: '内容不合规，请修改', icon: 'none' })
        return
      }
    } catch (e) {}

    this.setData({ sending: true, reply: null })

    try {
      await sleep(3000)
      const data = await requestCloud('pigeon', 'send', {
        figureId: selectedFigure.figureId,
        figureName: selectedFigure.figureName,
        content: letterContent
      }, { throwError: false })

      let replyContent = data && data.replyContent
      if (!replyContent) {
        const templates = REPLY_TEMPLATES[selectedFigure.figureId] || REPLY_TEMPLATES.simaqian
        replyContent = templates[Math.floor(Math.random() * templates.length)]
      }

      const chars = replyContent.split('')
      const reply = {
        replyId: uid('r_'),
        content: replyContent,
        displayContent: [],
        replyTime: this.formatReplyTime()
      }

      this.setData({ sending: false, reply })
      this.typeReply(chars, 0)
    } catch (e) {
      const templates = REPLY_TEMPLATES[selectedFigure.figureId] || REPLY_TEMPLATES.simaqian
      const replyContent = templates[Math.floor(Math.random() * templates.length)]
      const chars = replyContent.split('')
      this.setData({
        sending: false,
        reply: {
          replyId: uid('r_'),
          content: replyContent,
          displayContent: [],
          replyTime: this.formatReplyTime()
        }
      })
      this.typeReply(chars, 0)
    }
  },

  typeReply(chars, i) {
    if (i >= chars.length) return
    const end = Math.min(i + 3, chars.length)
    const display = this.data.reply.displayContent.concat(chars.slice(i, end))
    this.setData({ 'reply.displayContent': display })
    setTimeout(() => this.typeReply(chars, end), 60)
  },

  formatReplyTime() {
    const d = new Date()
    const pad = n => (n < 10 ? '0' + n : n)
    return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  },

  saveLetter() {
    const { selectedFigure, letterContent, reply } = this.data
    if (!reply) return
    const letters = storage.get('letters') || []
    letters.unshift({
      _id: uid('l_'),
      figureId: selectedFigure.figureId,
      figureName: selectedFigure.figureName,
      figureTitle: selectedFigure.figureTitle,
      avatar: selectedFigure.avatar,
      content: letterContent,
      replyContent: reply.content,
      createdAt: Date.now()
    })
    storage.set('letters', letters, 86400 * 30)
    wx.showToast({ title: '已保存至驿站', icon: 'success' })
  },

  writeAgain() {
    this.setData({
      letterContent: '',
      reply: null,
      canSend: false
    })
  },

  goChat() {
    const { selectedFigure } = this.data
    if (!selectedFigure) return
    const name = `${selectedFigure.figureName} · ${selectedFigure.figureTitle}`
    wx.redirectTo({
      url: `/pages/chat/room?figureId=${selectedFigure.figureId}&figureName=${encodeURIComponent(name)}`
    })
  }
})
