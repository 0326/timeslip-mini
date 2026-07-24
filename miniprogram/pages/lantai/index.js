const { requestCloud } = require('../../utils/cloudRequest')
const { sortByDynasty, getDynastyInfo } = require('../../utils/date')
const { storage } = require('../../utils/storage')
const { DYNASTY_FILTERS } = require('../../utils/constants')

const MOCK_FIGURES = [
  { _id: 'huangdi', name: '黄帝', title: '人文初祖', dynasty: 'xianqin', avatar: 'https://img.icons8.com/color/96/emperor.png', bio: '中华民族始祖，统一华夏部落。', unlocked: true },
  { _id: 'simaqian', name: '司马迁', title: '太史公', dynasty: 'han', avatar: 'https://img.icons8.com/color/96/writer.png', bio: '著《史记》，史家之绝唱，无韵之离骚。', unlocked: true },
  { _id: 'liubang', name: '刘邦', title: '汉高祖', dynasty: 'han', avatar: 'https://img.icons8.com/color/96/king.png', bio: '斩白蛇起义，建立大汉四百年基业。', unlocked: true },
  { _id: 'hanwu', name: '刘彻', title: '汉武帝', dynasty: 'han', avatar: 'https://img.icons8.com/color/96/emperor.png', bio: '罢黜百家，独尊儒术；北击匈奴，凿空西域。', unlocked: true },
  { _id: 'zhugeliang', name: '诸葛亮', title: '武乡侯', dynasty: 'sanguo', avatar: 'https://img.icons8.com/color/96/general.png', bio: '鞠躬尽瘁，死而后已。卧龙一出天下惊。', unlocked: true },
  { _id: 'libai', name: '李白', title: '诗仙', dynasty: 'tang', avatar: 'https://img.icons8.com/color/96/poet.png', bio: '斗酒诗百篇，自称臣是酒中仙。', unlocked: true },
  { _id: 'wuzetian', name: '武则天', title: '则天大圣皇帝', dynasty: 'tang', avatar: 'https://img.icons8.com/color/96/queen.png', bio: '中国历史上唯一的女皇帝，上承贞观下启开元。', unlocked: false },
  { _id: 'sushi', name: '苏轼', title: '东坡居士', dynasty: 'song', avatar: 'https://img.icons8.com/color/96/writer.png', bio: '一蓑烟雨任平生，北宋文坛宗主。', unlocked: true },
  { _id: 'yuefei', name: '岳飞', title: '岳武穆', dynasty: 'song', avatar: 'https://img.icons8.com/color/96/samurai.png', bio: '精忠报国，还我河山！', unlocked: true },
  { _id: 'zhuyuanzhang', name: '朱元璋', title: '明太祖', dynasty: 'ming', avatar: 'https://img.icons8.com/color/96/emperor.png', bio: '驱除胡虏，恢复中华，布衣天子。', unlocked: false },
  { _id: 'zhenghe', name: '郑和', title: '三保太监', dynasty: 'ming', avatar: 'https://img.icons8.com/color/96/ship-captain.png', bio: '七下西洋，扬威海外。', unlocked: false },
  { _id: 'kangxi', name: '爱新觉罗·玄烨', title: '康熙大帝', dynasty: 'qing', avatar: 'https://img.icons8.com/color/96/emperor.png', bio: '平三藩、收台湾、征噶尔丹，千古一帝。', unlocked: false }
]

Page({
  data: {
    tab: 'figures',
    dynastyFilters: DYNASTY_FILTERS,
    currentDynasty: 'all',
    figures: [],
    filteredFigures: [],
    books: [],
    searchText: '',
    loading: true,
    waterfallLeft: [],
    waterfallRight: []
  },

  onLoad() {
    this.loadFigures()
    this.loadBooks()
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 1)
  },

  onPullDownRefresh() {
    this.loadFigures(true)
    this.loadBooks(true)
  },

  async loadFigures(force = false) {
    try {
      let figures
      if (!force) {
        const cached = storage.get('figures')
        if (cached) figures = cached
      }
      if (!figures) {
        const data = await requestCloud('shiji', 'figures', {}, { throwError: false })
        figures = (data && data.figures) || MOCK_FIGURES
        storage.set('figures', figures, 86400)
      }
      this.applyFigureFilter(figures)
    } catch (e) {
      this.applyFigureFilter(MOCK_FIGURES)
    }
  },

  applyFigureFilter(figures) {
    const { currentDynasty, searchText } = this.data
    let list = figures.slice()
    if (currentDynasty !== 'all') {
      list = list.filter(f => f.dynasty === currentDynasty)
    }
    if (searchText) {
      const kw = searchText.toLowerCase()
      list = list.filter(f =>
        (f.name || '').toLowerCase().includes(kw) ||
        (f.title || '').toLowerCase().includes(kw) ||
        (f.bio || '').toLowerCase().includes(kw)
      )
    }
    list = sortByDynasty(list)
    list = list.map(f => ({ ...f, dynastyInfo: getDynastyInfo(f.dynasty) }))
    const left = [], right = []
    list.forEach((item, idx) => {
      if (idx % 2 === 0) left.push(item)
      else right.push(item)
    })
    this.setData({
      figures,
      filteredFigures: list,
      waterfallLeft: left,
      waterfallRight: right,
      loading: false
    })
    wx.stopPullDownRefresh()
  },

  async loadBooks(force = false) {
    const cached = !force ? storage.get('books') : null
    if (cached) {
      this.setData({ books: cached })
      return
    }
    const books = [
      { id: 'shiji', title: '史记', author: '司马迁', dynasty: 'han', chapters: 130, desc: '史家之绝唱，无韵之离骚' },
      { id: 'hanshu', title: '汉书', author: '班固', dynasty: 'han', chapters: 100, desc: '第一部纪传体断代史' },
      { id: 'sanguozhi', title: '三国志', author: '陈寿', dynasty: 'jin', chapters: 65, desc: '三国时代的权威记载' },
      { id: 'zizhitongjian', title: '资治通鉴', author: '司马光', dynasty: 'song', chapters: 294, desc: '鉴前世之兴衰，考当今之得失' },
      { id: 'xintangshu', title: '新唐书', author: '欧阳修', dynasty: 'song', chapters: 225, desc: '唐代历史的系统梳理' },
      { id: 'mingshi', title: '明史', author: '张廷玉等', dynasty: 'qing', chapters: 332, desc: '明朝近三百年全史' }
    ]
    storage.set('books', books, 86400)
    this.setData({ books })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab })
  },

  selectDynasty(e) {
    const dynasty = e.currentTarget.dataset.key
    this.setData({ currentDynasty: dynasty })
    this.applyFigureFilter(this.data.figures)
  },

  onSearchInput(e) {
    this.setData({ searchText: e.detail.value })
    this.applyFigureFilter(this.data.figures)
  },

  onFigureTap(e) {
    const id = e.currentTarget.dataset.id
    const figure = this.data.filteredFigures.find(f => f._id === id) || {}
    if (!figure.unlocked) {
      wx.showModal({
        title: '人物未解锁',
        content: `完成「${figure.name}」相关任务即可解锁聊天和信件功能，是否前往成就查看？`,
        confirmText: '查看成就',
        success: (r) => {
          if (r.confirm) wx.navigateTo({ url: '/pages/profile/achievements' })
        }
      })
      return
    }
    wx.navigateTo({
      url: `/pages/lantai/figure-detail?id=${id}`
    })
  },

  onBookTap(e) {
    const id = e.currentTarget.dataset.id
    const book = this.data.books.find(b => b.id === id)
    wx.navigateTo({
      url: `/pages/lantai/book-reader?id=${id}&title=${encodeURIComponent(book.title)}`
    })
  },

  openChat(e) {
    const id = e.currentTarget.dataset.id
    const f = this.data.filteredFigures.find(x => x._id === id) || {}
    const name = f.title ? `${f.name} · ${f.title}` : f.name
    wx.navigateTo({
      url: `/pages/chat/room?figureId=${id}&figureName=${encodeURIComponent(name)}`
    })
  }
})
