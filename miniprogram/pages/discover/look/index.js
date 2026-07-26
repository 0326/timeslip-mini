const { requestCloud } = require('../../../utils/cloudRequest')
const { storage } = require('../../../utils/storage')

const CATEGORIES = [
  { key: 'all', name: '全部' },
  { key: 'figure_truth', name: '人物真相' },
  { key: 'perspective', name: '史观解读' },
  { key: 'fun_fact', name: '冷知识' }
]

const CATEGORY_NAMES = {
  figure_truth: '人物真相',
  perspective: '史观解读',
  fun_fact: '冷知识'
}

const DYNASTY_NAMES = {
  xianqin: '先秦', xia: '夏', shang: '商', zhou: '周', chunqiu: '春秋', zhanguo: '战国',
  han: '秦汉', xihan: '西汉', donghan: '东汉', sanguo: '三国',
  jin: '晋', nanbeichao: '南北朝',
  tang: '唐', wuzhou: '武周',
  song: '宋', beisong: '北宋', nansong: '南宋',
  yuan: '元', ming: '明', qing: '清'
}

const MOCK_ARTICLES = [
  {
    _id: 'mock_1',
    title: '真实的孔子：九尺六寸的山东大汉',
    subtitle: '被画像定格的文弱书生，其实能射箭驾车、力能扛鼎',
    coverImage: '/images/look/article_001.jpg',
    category: 'figure_truth',
    dynasty: 'chunqiu',
    summary: '孔子身高九尺六寸，精通六艺，绝非后世画像中的文弱书生...',
    viewCount: 1234,
    likeCount: 328,
    bookmarkCount: 56,
    tags: ['孔子', '春秋']
  },
  {
    _id: 'mock_2',
    title: '鸿门宴：项羽不杀刘邦，真的是妇人之仁吗？',
    subtitle: '一场改变历史走向的酒局，背后藏着更深的博弈',
    coverImage: '/images/look/article_006.jpg',
    category: 'perspective',
    dynasty: 'han',
    summary: '项羽在鸿门宴上放走刘邦，被后人诟病为妇人之仁。但真相远比这复杂...',
    viewCount: 2156,
    likeCount: 580,
    bookmarkCount: 120,
    tags: ['项羽', '刘邦', '鸿门宴']
  },
  {
    _id: 'mock_3',
    title: '真实的关羽：没有青龙偃月刀，没有过五关斩六将',
    subtitle: '正史中的关二哥，和《三国演义》里差了多少？',
    coverImage: '/images/look/article_002.jpg',
    category: 'figure_truth',
    dynasty: 'sanguo',
    summary: '关羽的兵器不是青龙偃月刀，过五关斩六将也是虚构...',
    viewCount: 3421,
    likeCount: 892,
    bookmarkCount: 234,
    tags: ['关羽', '三国']
  },
  {
    _id: 'mock_4',
    title: '古人用什么擦屁股？从竹片到草纸的进化史',
    subtitle: '一个你从没想过但确实很 important 的问题',
    coverImage: '/images/look/article_010.jpg',
    category: 'fun_fact',
    dynasty: 'tang',
    summary: '唐以前用竹片，宋以后有草纸，古人的如厕史比你想象的精彩...',
    viewCount: 5678,
    likeCount: 1234,
    bookmarkCount: 89,
    tags: ['冷知识', '唐']
  }
]

Page({
  data: {
    categories: CATEGORIES,
    activeCategory: 'all',
    articles: [],
    leftColumn: [],
    rightColumn: [],
    page: 0,
    hasMore: true,
    loading: false,
    refreshing: false,
    navOpaque: false
  },

  onLoad() {
    this.loadArticles(true)
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 2)
  },

  onPullDownRefresh() {
    this.loadArticles(true)
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadArticles(false)
    }
  },

  onPageScroll(e) {
    const shouldOpaque = e.scrollTop > 50
    if (shouldOpaque !== this.data.navOpaque) {
      this.setData({ navOpaque: shouldOpaque })
    }
  },

  async loadArticles(reset) {
    if (this.data.loading) return
    this.setData({ loading: true, refreshing: reset })

    try {
      const page = reset ? 0 : this.data.page
      const data = await requestCloud('look', 'articleList', {
        category: this.data.activeCategory,
        page,
        pageSize: 10
      }, { throwError: false })

      let list = []
      if (data && data.list && data.list.length) {
        list = data.list
      } else if (reset) {
        list = MOCK_ARTICLES.filter(a => {
          if (this.data.activeCategory === 'all') return true
          return a.category === this.data.activeCategory
        })
      }

      const processed = list.map(a => ({
        ...a,
        categoryName: CATEGORY_NAMES[a.category] || a.category || '',
        dynastyName: DYNASTY_NAMES[a.dynasty] || a.dynasty || '',
        viewText: this.formatCount(a.viewCount),
        likeText: this.formatCount(a.likeCount),
        bookmarkText: this.formatCount(a.bookmarkCount)
      }))

      const allArticles = reset ? processed : this.data.articles.concat(processed)
      const { left, right } = this.splitColumns(allArticles)

      this.setData({
        articles: allArticles,
        leftColumn: left,
        rightColumn: right,
        page: page + 1,
        hasMore: data ? data.hasMore : false,
        loading: false,
        refreshing: false
      })
    } catch (e) {
      this.setData({ loading: false, refreshing: false })
      if (reset) {
        const mockList = MOCK_ARTICLES.filter(a => {
          if (this.data.activeCategory === 'all') return true
          return a.category === this.data.activeCategory
        }).map(a => ({
          ...a,
          categoryName: CATEGORY_NAMES[a.category],
          dynastyName: DYNASTY_NAMES[a.dynasty],
          viewText: this.formatCount(a.viewCount),
          likeText: this.formatCount(a.likeCount),
          bookmarkText: this.formatCount(a.bookmarkCount)
        }))
        this.setData({ articles: mockList, hasMore: false })
        const { left, right } = this.splitColumns(mockList)
        this.setData({ leftColumn: left, rightColumn: right })
      }
    }
    wx.stopPullDownRefresh()
  },

  formatCount(num) {
    const n = Number(num) || 0
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
    return String(n)
  },

  switchCategory(e) {
    const { key } = e.currentTarget.dataset
    if (key === this.data.activeCategory) return
    this.setData({ activeCategory: key, articles: [], leftColumn: [], rightColumn: [], page: 0, hasMore: true })
    this.loadArticles(true)
  },

  openArticle(e) {
    const { id } = e.detail || e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/discover/look/detail?id=${id}` })
  },

  splitColumns(articles) {
    const left = []
    const right = []
    articles.forEach((item, index) => {
      if (index % 2 === 0) {
        left.push(item)
      } else {
        right.push(item)
      }
    })
    return { left, right }
  }
})
