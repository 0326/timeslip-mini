const { requestCloud } = require('../../../utils/cloudRequest')
const { getDynastyInfo } = require('../../../utils/date')
const loginGuard = require('../../../utils/loginGuard')
const { throttle } = require('../../../utils/helpers')

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
    if (options.id) {
      this.setData({ articleId: options.id })
      this.loadDetail(options.id)
    } else {
      this.setData({ loading: false })
    }
  },

  async loadDetail(id) {
    try {
      const data = await requestCloud('look', 'articleDetail', { articleId: id }, { throwError: false })

      let article, liked, bookmarked, pollVoted, pollResults

      if (data && data.article) {
        article = data.article
        liked = data.liked
        bookmarked = data.bookmarked
        pollVoted = data.pollVoted
        pollResults = data.pollResults
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' })
        this.setData({ loading: false })
        return
      }

      article.categoryName = CATEGORY_NAMES[article.category] || article.category || ''
      article.dynastyName = DYNASTY_NAMES[article.dynasty] || article.dynasty || ''
      article.viewText = this.formatCount(article.viewCount)
      article.likeText = this.formatCount(article.likeCount)

      const content = await this.enrichContent(article.content || [])

      this.setData({
        article,
        content,
        liked,
        bookmarked,
        pollVoted,
        pollResults,
        loading: false
      })

      requestCloud('look', 'increaseView', { articleId: id }, { throwError: false })
      this.loadRelated(id)
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async enrichContent(content) {
    const figureIds = content
      .filter(b => b.type === 'figure_card')
      .map(b => b.figureId)
      .filter((id, idx, arr) => arr.indexOf(id) === idx)

    const figureMap = {}
    if (figureIds.length) {
      try {
        const data = await requestCloud('shiji', 'figuresBatch', { ids: figureIds }, { throwError: false })
        if (data && data.figures) {
          data.figures.forEach(f => {
            f.dynastyName = DYNASTY_NAMES[f.dynasty] || f.dynasty || ''
            figureMap[f._id] = f
          })
        }
      } catch (e) {}
    }

    return content.map(block => {
      if (block.type === 'figure_card' && figureMap[block.figureId]) {
        block.figureInfo = figureMap[block.figureId]
      }
      return block
    })
  },

  async loadRelated(id) {
    try {
      const data = await requestCloud('look', 'relatedArticles', { articleId: id, limit: 3 }, { throwError: false })
      if (data && data.list) {
        const related = data.list.map(a => ({
          ...a,
          categoryName: CATEGORY_NAMES[a.category] || a.category || '',
          dynastyName: DYNASTY_NAMES[a.dynasty] || a.dynasty || '',
          viewText: this.formatCount(a.viewCount),
          likeText: this.formatCount(a.likeCount),
          bookmarkText: this.formatCount(a.bookmarkCount || 0)
        }))
        this.setData({ relatedArticles: related })
      }
    } catch (e) {}
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
    article.likeText = this.formatCount(article.likeCount)

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

    try {
      const data = await requestCloud('look', 'vote', {
        articleId: this.data.articleId,
        optionIndex
      }, { throwError: false })

      if (data && data.results) {
        this.setData({ pollVoted: true, pollResults: data.results })
        wx.showToast({ title: '投票成功', icon: 'success' })
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
  },

  formatCount(num) {
    const n = Number(num) || 0
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
    return String(n)
  }
})
