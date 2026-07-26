const { requestCloud } = require('../../../utils/cloudRequest')
const { storage } = require('../../../utils/storage')
const loginGuard = require('../../../utils/loginGuard')
const { throttle } = require('../../../utils/helpers')
const { formatCount, processArticle } = require('../../../utils/articleData')

const DETAIL_CACHE_TTL = 10 * 60
const RELATED_CACHE_TTL = 10 * 60
const FIGURE_CACHE_TTL = 60 * 60
const CACHE_VERSION = 'v4'

function detailCacheKey(id) {
  return `look_detail_${CACHE_VERSION}_${id}`
}

function relatedCacheKey(id) {
  return `look_related_${CACHE_VERSION}_${id}`
}

function figureCacheKey(id) {
  return `look_figure_${id}`
}

Page({
  data: {
    articleId: '',
    article: null,
    content: [],
    liked: false,
    bookmarked: false,
    loading: true,
    relatedArticles: [],
    pollVoted: false,
    pollResults: null,
    windowHeight: 600
  },

  onLoad(options) {
    const sys = wx.getSystemInfoSync()
    this.setData({ windowHeight: sys.windowHeight })
    if (options.id && options.id.indexOf('article_') !== 0) {
      this.setData({ articleId: options.id })
      this.loadDetail(options.id)
    } else {
      this.setData({ loading: false })
      wx.showToast({ title: '内容已更新，请从列表进入', icon: 'none' })
    }
  },

  async loadDetail(id) {
    const key = detailCacheKey(id)

    try {
      const data = await requestCloud('look', 'articleDetail', { articleId: id }, { throwError: false })

      if (!data || !data.article) {
        throw new Error('empty online article detail')
      }

      storage.set(key, data, DETAIL_CACHE_TTL)
      await this.renderDetail(data)
      requestCloud('look', 'increaseView', { articleId: this.data.articleId }, { throwError: false })
      this.loadRelated(this.data.articleId)
    } catch (e) {
      const cached = storage.get(key)

      if (cached && cached.article) {
        await this.renderDetail(cached)
        this.loadRelated(this.data.articleId)
      } else {
        console.error('load look article detail failed:', e)
        this.setData({ loading: false })
        wx.showToast({ title: '文章加载失败', icon: 'none' })
      }
    }
  },

  async renderDetail(data) {
    const article = processArticle(data.article)
    const content = await this.enrichContent(article.content || [])

    this.setData({
      articleId: article._id || this.data.articleId,
      article,
      content,
      liked: data.liked || false,
      bookmarked: data.bookmarked || false,
      pollVoted: data.pollVoted || false,
      pollResults: data.pollResults || null,
      loading: false
    })
  },

  async enrichContent(content) {
    const figureIds = content
      .filter(b => b.type === 'figure_card' && b.figureId)
      .map(b => b.figureId)
      .filter((id, idx, arr) => arr.indexOf(id) === idx)

    const figureMap = {}
    const missingIds = []

    figureIds.forEach(id => {
      const cached = storage.get(figureCacheKey(id))
      if (cached) {
        figureMap[id] = cached
      } else {
        missingIds.push(id)
      }
    })

    if (missingIds.length) {
      try {
        const data = await requestCloud('shiji', 'figuresBatch', { ids: missingIds }, { throwError: false })
        if (data && Array.isArray(data.figures)) {
          data.figures.forEach(f => {
            if (!f || !f._id) return
            figureMap[f._id] = f
            storage.set(figureCacheKey(f._id), f, FIGURE_CACHE_TTL)
          })
        }
      } catch (e) {}
    }

    return content.map(block => {
      if (block.type === 'figure_card' && figureMap[block.figureId]) {
        const figure = figureMap[block.figureId]
        return {
          ...block,
          figure,
          name: figure.name || block.name,
          dynasty: figure.dynastyName || figure.dynasty || block.dynasty,
          title: figure.title || figure.identity || block.title
        }
      }
      return block
    })
  },

  async loadRelated(id) {
    const key = relatedCacheKey(id)

    try {
      const data = await requestCloud('look', 'relatedArticles', { articleId: id, limit: 3 }, { throwError: false })

      if (!data || !Array.isArray(data.list)) {
        throw new Error('empty online related articles')
      }

      storage.set(key, data, RELATED_CACHE_TTL)
      this.renderRelated(data.list)
    } catch (e) {
      const cached = storage.get(key)

      if (cached && Array.isArray(cached.list)) {
        this.renderRelated(cached.list)
      } else {
        console.warn('load look related articles failed:', e)
      }
    }
  },

  renderRelated(list) {
    this.setData({
      relatedArticles: (list || []).map(processArticle).filter(Boolean)
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

    // 先做乐观更新，云端结果返回后再覆盖为真实统计。
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

  onFigureTap(e) {
    const { id } = e.detail || e.currentTarget.dataset
    if (id) {
      wx.navigateTo({ url: `/pages/lantai/figure-detail?id=${id}` })
    }
  },

  onComment() {
    wx.navigateTo({
      url: `/pages/discover/look/comment?id=${this.data.articleId}`,
      fail: () => {
        wx.showToast({ title: '评论功能开发中', icon: 'none' })
      }
    })
  },

  openRelated(e) {
    const { id } = e.detail || e.currentTarget.dataset
    if (id) {
      wx.redirectTo({ url: `/pages/discover/look/detail?id=${id}` })
    }
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
