const { requestCloud } = require('../../../utils/cloudRequest')
const { storage } = require('../../../utils/storage')
const loginGuard = require('../../../utils/loginGuard')
const { throttle } = require('../../../utils/helpers')
const { getArticleDetail, formatCount, processArticle } = require('../../../utils/articleData')

const DETAIL_CACHE_TTL = 10 * 60
const CACHE_VERSION = 'v4'

function detailCacheKey(id) {
  return `look_detail_${CACHE_VERSION}_${id}`
}

Page({
  data: {
    articleId: '',
    article: null,
    content: [],
    liked: false,
    bookmarked: false,
    loading: true,
    pollVoted: false,
    pollResults: null,
    windowHeight: 600,
    statusBarHeight: 20,
    menuTop: 24,
    menuHeight: 32
  },

  onLoad(options) {
    const sys = wx.getSystemInfoSync()
    const statusBarHeight = sys.statusBarHeight || 20
    let menuTop = statusBarHeight + 4
    let menuHeight = 32
    try {
      const rect = wx.getMenuButtonBoundingClientRect()
      menuTop = rect.top
      menuHeight = rect.height
    } catch (e) {}
    this.setData({ windowHeight: sys.windowHeight, statusBarHeight, menuTop, menuHeight })
    if (options.id) {
      this.setData({ articleId: options.id })
      this.loadDetail(options.id)
    } else {
      this.setData({ loading: false })
    }
  },

  onNavBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ fail: () => { wx.switchTab({ url: '/pages/chat/index' }) } })
    } else {
      wx.switchTab({ url: '/pages/chat/index' })
    }
  },

  async loadDetail(id) {
    // 先尝试云函数（有缓存就用缓存）
    const key = detailCacheKey(id)
    try {
      const data = await requestCloud('look', 'articleDetail', { articleId: id }, { throwError: false })

      if (data && data.article) {
        storage.set(key, data, DETAIL_CACHE_TTL)
        await this.renderDetail(data)
        requestCloud('look', 'increaseView', { articleId: id }, { throwError: false })
        return
      }
    } catch (e) {}

    // 云函数失败，尝试缓存
    const cached = storage.get(key)
    if (cached && cached.article) {
      await this.renderDetail(cached)
      return
    }

    // 缓存也没有，用本地数据
    const localArticle = getArticleDetail(id)
    if (localArticle) {
      await this.renderDetail({ article: localArticle, liked: false, bookmarked: false, pollVoted: false, pollResults: null })
      return
    }

    // 本地数据也没有
    console.error('load look article detail failed: not found')
    this.setData({ loading: false })
    wx.showToast({ title: '文章不存在', icon: 'none' })
    setTimeout(() => wx.navigateBack(), 1500)
  },

  async renderDetail(data) {
    const article = processArticle(data.article)

    this.setData({
      articleId: article._id || this.data.articleId,
      article,
      content: article.content || [],
      liked: data.liked || false,
      bookmarked: data.bookmarked || false,
      pollVoted: data.pollVoted || false,
      pollResults: data.pollResults || null,
      loading: false
    })
  },

  _onLike: null,
  onLike(e) {
    if (!loginGuard.checkLogin(this)) return
    if (!this._onLike) this._onLike = throttle(this.handleLike.bind(this), 300)
    this._onLike(e)
  },

  async handleLike() {
    const nowLiked = !this.data.liked
    const article = this.data.article
    article.likeCount = (article.likeCount || 0) + (nowLiked ? 1 : -1)
    article.likeText = formatCount(article.likeCount)

    this.setData({ liked: nowLiked, article })

    try {
      await requestCloud('look', 'toggleLike', { articleId: this.data.articleId }, { throwError: false })
    } catch (e) {}
  },

  async onBookmark() {
    if (!loginGuard.checkLogin(this)) return
    const nowBookmarked = !this.data.bookmarked
    this.setData({ bookmarked: nowBookmarked })
    wx.showToast({ title: nowBookmarked ? '已收藏' : '已取消收藏', icon: 'none' })

    try {
      await requestCloud('look', 'toggleBookmark', { articleId: this.data.articleId }, { throwError: false })
    } catch (e) {}
  },

  async onVote(e) {
    if (!loginGuard.checkLogin(this)) return
    const { optionIndex } = e.detail || {}
    if (this.data.pollVoted || optionIndex === undefined) return

    const article = this.data.article
    if (article.poll) {
      const optionCount = article.poll.options.length
      const results = {
        counts: new Array(optionCount).fill(0),
        total: 0,
        percentages: new Array(optionCount).fill(0)
      }
      results.counts[optionIndex] = 1
      results.total = 1
      results.percentages = results.counts.map(c => results.total > 0 ? Math.round(c / results.total * 100) : 0)
      this.setData({ pollVoted: true, pollResults: results })
      wx.showToast({ title: '投票成功', icon: 'success' })
    }

    try {
      const data = await requestCloud('look', 'vote', {
        articleId: this.data.articleId,
        optionIndex
      }, { throwError: false })

      if (data && data.results) {
        this.setData({ pollResults: data.results })
      }
    } catch (e) {}
  },

  onShareAppMessage() {
    const a = this.data.article || {}
    return {
      title: a.title || '穿越圈·看一看',
      path: `/pages/discover/look/detail?id=${this.data.articleId}`,
      imageUrl: a.coverImage || ''
    }
  }
})
