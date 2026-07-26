const { requestCloud } = require('../../../utils/cloudRequest')
const loginGuard = require('../../../utils/loginGuard')

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

Page({
  data: {
    articles: [],
    leftColumn: [],
    rightColumn: [],
    page: 0,
    hasMore: true,
    loading: false
  },

  onLoad() {
    this.loadBookmarks(true)
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  onPullDownRefresh() {
    this.loadBookmarks(true)
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadBookmarks(false)
    }
  },

  async loadBookmarks(reset) {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const page = reset ? 0 : this.data.page
      const data = await requestCloud('look', 'myBookmarks', {
        page,
        pageSize: 10
      }, { throwError: false })

      const list = (data && data.list) || []
      const processed = list.map(a => ({
        ...a,
        categoryName: CATEGORY_NAMES[a.category] || a.category || '',
        dynastyName: DYNASTY_NAMES[a.dynasty] || a.dynasty || '',
        viewText: this.formatCount(a.viewCount),
        likeText: this.formatCount(a.likeCount),
        bookmarkText: this.formatCount(a.bookmarkCount || 0)
      }))

      const allArticles = reset ? processed : this.data.articles.concat(processed)
      const { left, right } = this.splitColumns(allArticles)

      this.setData({
        articles: allArticles,
        leftColumn: left,
        rightColumn: right,
        page: page + 1,
        hasMore: data ? data.hasMore : false,
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
    }
    wx.stopPullDownRefresh()
  },

  formatCount(num) {
    const n = Number(num) || 0
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
    return String(n)
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
  },

  goLook() {
    wx.navigateTo({ url: '/pages/discover/look/index' })
  }
})
