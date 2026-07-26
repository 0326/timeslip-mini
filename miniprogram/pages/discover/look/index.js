const { requestCloud } = require('../../../utils/cloudRequest')
const { storage } = require('../../../utils/storage')
const { processArticle } = require('../../../utils/articleData')

const CATEGORIES = [
  { key: 'all', name: '全部' },
  { key: 'figure_truth', name: '人物真相' },
  { key: 'perspective', name: '史观解读' },
  { key: 'fun_fact', name: '冷知识' }
]

const PAGE_SIZE = 10
const CACHE_TTL = 10 * 60
const CACHE_VERSION = 'v4'

function cacheKey(category, page) {
  return `look_articles_${CACHE_VERSION}_${category}_${page}`
}

function clearLegacyLookCaches() {
  try {
    const info = wx.getStorageInfoSync()
    info.keys.forEach(key => {
      if (key.indexOf('timeslip_look_articles_') === 0 && key.indexOf(`timeslip_look_articles_${CACHE_VERSION}_`) !== 0) {
        wx.removeStorageSync(key)
      }
    })
  } catch (e) {}
}

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
    clearLegacyLookCaches()
    this.loadArticles(true)
  },

  onShow() {
    const app = getApp()
    if (typeof app.setCurrentTab === 'function') {
      try { app.setCurrentTab(this, 2) } catch (e) {}
    }
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

    const page = reset ? 0 : this.data.page
    const key = cacheKey(this.data.activeCategory, page)

    try {
      const data = await requestCloud('look', 'articleList', {
        category: this.data.activeCategory,
        page,
        pageSize: PAGE_SIZE
      }, { throwError: false })

      if (!data || !Array.isArray(data.list)) {
        throw new Error('empty online article list')
      }

      storage.set(key, data, CACHE_TTL)
      this.renderArticles(data.list, data.hasMore, page, reset)
    } catch (e) {
      const cached = storage.get(key)

      if (cached && Array.isArray(cached.list)) {
        this.renderArticles(cached.list, cached.hasMore, page, reset)
      } else {
        console.error('load look articles failed:', e)
        this.setData({ loading: false, refreshing: false, hasMore: false })
        wx.showToast({ title: '文章加载失败', icon: 'none' })
      }
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  renderArticles(list, hasMore, page, reset) {
    const processed = (list || []).map(processArticle).filter(Boolean)
    const allArticles = reset ? processed : this.data.articles.concat(processed)
    const { left, right } = this.splitColumns(allArticles)

    this.setData({
      articles: allArticles,
      leftColumn: left,
      rightColumn: right,
      page: page + 1,
      hasMore: !!hasMore,
      loading: false,
      refreshing: false
    })
  },

  switchCategory(e) {
    const { key } = e.currentTarget.dataset
    if (key === this.data.activeCategory) return
    this.setData({ activeCategory: key, articles: [], leftColumn: [], rightColumn: [], page: 0, hasMore: true })
    this.loadArticles(true)
  },

  openArticle(e) {
    const { id } = e.detail || e.currentTarget.dataset
    if (!id) return

    // 旧缓存里的本地编号不是云数据库文档 _id，清掉后重新拉线上列表。
    if (typeof id !== 'string' || id.indexOf('article_') === 0) {
      this.setData({ articles: [], leftColumn: [], rightColumn: [], page: 0, hasMore: true })
      clearLegacyLookCaches()
      this.loadArticles(true)
      wx.showToast({ title: '内容已更新，请重试', icon: 'none' })
      return
    }

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
