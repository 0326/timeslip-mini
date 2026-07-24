const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')
const { formatRelative, formatChatTime } = require('../../utils/date')

const FILTERS = [
  { key: 'all', name: '全部' },
  { key: 'simaqian', name: '司马迁' },
  { key: 'libai', name: '李白' },
  { key: 'sushi', name: '苏轼' },
  { key: 'zhugeliang', name: '诸葛亮' },
  { key: 'other', name: '其他' }
]

const MOCK_LETTERS = [
  {
    _id: 'l_mock1',
    figureId: 'libai',
    figureName: '李白',
    figureTitle: '诗仙',
    dynasty: 'tang',
    avatar: 'https://img.icons8.com/color/96/poet.png',
    content: '太白先生，近来学业繁重，心下烦闷。读先生之诗，顿觉心胸开阔。不知先生可有排解忧愁之法？',
    replyContent: '哈哈哈！人生在世不称意，明朝散发弄扁舟。烦忧之时，且持一杯酒，对一轮月，听一夜风。君不见黄河之水天上来，奔流到海不复回？忧愁亦如此水，终将逝去。少年且珍重，前路正长！',
    createdAt: Date.now() - 86400000 * 3
  },
  {
    _id: 'l_mock2',
    figureId: 'sushi',
    figureName: '苏轼',
    figureTitle: '东坡居士',
    dynasty: 'song',
    avatar: 'https://img.icons8.com/color/96/writer.png',
    content: '东坡居士，晚辈初入职场，诸事不顺，屡遭排挤。读先生《定风波》，感慨万千，敢问如何方能做到「一蓑烟雨任平生」？',
    replyContent: '少年听吾一言：人有悲欢离合，月有阴晴圆缺，此事古难全。黄州惠州儋州，吾一生颠沛，然未尝一日忘食也。且去做一碗东坡肉，吃饱了再说。烦恼如浮云，饿时方知皆虚。记住：「竹杖芒鞋轻胜马，谁怕？」',
    createdAt: Date.now() - 86400000 * 10
  }
]

Page({
  data: {
    letters: [],
    filteredLetters: [],
    filterList: FILTERS,
    filter: 'all',
    totalCount: 0,
    figuresCount: 0,
    firstDate: '--'
  },

  onShow() {
    this.loadLetters()
  },

  async loadLetters() {
    let letters = storage.get('letters') || []
    if (!letters.length) {
      try {
        const data = await requestCloud('pigeon', 'listLetters', {}, { throwError: false })
        letters = (data && data.letters) || MOCK_LETTERS
      } catch (e) {
        letters = MOCK_LETTERS
      }
    }

    letters = letters
      .map(l => ({ ...l, displayTime: formatRelative(l.createdAt), expanded: false }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    const figureIds = new Set(letters.map(l => l.figureId))
    const earliest = letters.length ? formatChatTime(letters[letters.length - 1].createdAt).split(' ')[0] : '--'

    this.setData({
      letters,
      totalCount: letters.length,
      figuresCount: figureIds.size,
      firstDate: earliest
    }, () => this.applyFilter())
  },

  applyFilter() {
    const { letters, filter } = this.data
    let filtered = letters
    if (filter !== 'all') {
      if (filter === 'other') {
        const main = ['simaqian', 'libai', 'sushi', 'zhugeliang']
        filtered = letters.filter(l => !main.includes(l.figureId))
      } else {
        filtered = letters.filter(l => l.figureId === filter)
      }
    }
    this.setData({ filteredLetters: filtered })
  },

  selectFilter(e) {
    const { key } = e.currentTarget.dataset
    this.setData({ filter: key }, () => this.applyFilter())
  },

  toggleExpand(e) {
    const { id } = e.currentTarget.dataset
    const filtered = this.data.filteredLetters.map(l =>
      l._id === id ? { ...l, expanded: !l.expanded } : l
    )
    const letters = this.data.letters.map(l =>
      l._id === id ? { ...l, expanded: !l.expanded } : l
    )
    this.setData({ filteredLetters: filtered, letters })
  },

  writeAgain(e) {
    const figure = e.currentTarget.dataset.figure || {}
    wx.redirectTo({
      url: `/pages/discover/pigeon?figureId=${figure.figureId || ''}`
    })
  },

  deleteLetter(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      confirmText: '删除',
      confirmColor: '#FA5151',
      success: (res) => {
        if (res.confirm) {
          const letters = (storage.get('letters') || []).filter(l => l._id !== id)
          storage.set('letters', letters, 86400 * 30)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadLetters()
        }
      }
    })
  },

  goPigeon() {
    wx.switchTab({
      url: '/pages/discover/index',
      success: () => {
        setTimeout(() => {
          wx.navigateTo({ url: '/pages/discover/pigeon' })
        }, 100)
      }
    })
  }
})
