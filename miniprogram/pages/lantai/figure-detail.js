const { requestCloud } = require('../../utils/cloudRequest')
const { getDynastyInfo } = require('../../utils/date')
const { storage } = require('../../utils/storage')
const { patchListForDisplay, patchAuthorForDisplay } = require('../../utils/publicIdentity')

const RELATION_TYPE_MAP = {
  peer: '同朝',
  family: '亲属',
  friend: '好友',
  enemy: '对手',
  teacher: '师长',
  student: '门生',
  lord: '君主',
  subordinate: '臣属',
  rival: '对手',
  spouse: '配偶',
  parent: '父母',
  child: '子女',
  sibling: '兄弟'
}

const FIGURE_CACHE_VERSION = 2

function normalizeRelation(rel) {
  if (!rel) return rel
  return {
    ...rel,
    name: rel.name || rel.targetName || '',
    relation: rel.relation || rel.label || RELATION_TYPE_MAP[rel.type] || rel.type || ''
  }
}

function normalizeFigureData(figure) {
  if (!figure) return figure
  const relations = (figure.relations || [])
    .map(normalizeRelation)
    .filter(r => r && r.name)
  const relatedBooks = (figure.relatedBooks || []).map(b => ({
    ...b,
    chapters: b.chapters || (b.chapter ? b.chapter.replace(/[^\d]/g, '') : ''),
    chapter: b.chapter || (b.chapters ? `${b.chapters}卷` : ''),
    dynasty: b.dynasty || '',
    author: b.author || ''
  }))
  return {
    ...figure,
    relations,
    relatedBooks,
    masterpieces: figure.masterpieces || []
  }
}

Page({
  data: {
    id: '',
    figure: null,
    dynastyInfo: null,
    tab: 'bio',
    loading: true,
    channelInfo: null,
    channelVideos: [],
    relatedArticles: []
  },

  onLoad(options) {
    let id = options.id || 'simaqian'
    // 扫小程序码进入：scene 携带 figureId
    if (options.scene) {
      const decoded = decodeURIComponent(options.scene)
      if (decoded) id = decoded
    }
    const tab = options.tab || 'bio'
    this.setData({ id, tab })
    this.loadDetail(id)
  },

  onShow() {
  },

  async loadDetail(id) {
    try {
      let figure
      const cacheKey = 'figure_v' + FIGURE_CACHE_VERSION + '_' + id
      const cached = storage.get(cacheKey)
      if (cached) figure = cached
      if (!figure) {
        const data = await requestCloud('shiji', 'figureDetail', { id }, { throwError: false })
        figure = normalizeFigureData(data && data.figure)
        if (figure) storage.set(cacheKey, figure, 86400)
      } else {
        figure = normalizeFigureData(figure)
      }
      if (!figure) {
        this.setData({ loading: false })
        wx.showToast({ title: '未找到人物信息', icon: 'none' })
        return
      }
      // 构造逻辑 figureId（video_channels 存的是 "fig-sushi" 格式）
      const logicalFigureId = figure.figureId || (figure.id ? 'fig-' + figure.id : id)
      this.setData({
        figure: Object.assign({}, figure, patchAuthorForDisplay(figure)),
        figureId: logicalFigureId,
        dynastyInfo: getDynastyInfo(figure.dynasty),
        loading: false
      })
      this.loadChannel(logicalFigureId)
      this.loadRelatedArticles(id)
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadChannel(figureId) {
    try {
      const data = await requestCloud('videoChannel', 'channelByFigure', { figureId }, { throwError: false })
      if (data && data.channel) {
        this.setData({
          channelInfo: Object.assign({}, data.channel, patchAuthorForDisplay(data.channel)),
          channelVideos: patchListForDisplay(data.videos || [])
        })
      }
    } catch (e) {}
  },

  async loadRelatedArticles(figureId) {
    try {
      const data = await requestCloud('look', 'articlesByFigure', { figureId, limit: 3 }, { throwError: false })
      if (data && data.list) {
        const CATEGORY_NAMES = {
          figure_truth: '人物真相',
          perspective: '史观解读',
          fun_fact: '冷知识'
        }
        const DYNASTY_NAMES = {
          xianqin: '先秦', chunqiu: '春秋', zhanguo: '战国',
          han: '秦汉', sanguo: '三国', tang: '唐', song: '宋',
          ming: '明', qing: '清'
        }
        const articles = patchListForDisplay(data.list.map(a => ({
          ...a,
          categoryName: CATEGORY_NAMES[a.category] || a.category || '',
          dynastyName: DYNASTY_NAMES[a.dynasty] || a.dynasty || '',
          viewText: this.formatCount(a.viewCount),
          likeText: this.formatCount(a.likeCount),
          bookmarkText: this.formatCount(a.bookmarkCount || 0)
        })))
        this.setData({ relatedArticles: articles })
      }
    } catch (e) {}
  },

  formatCount(num) {
    const n = Number(num) || 0
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
    return String(n)
  },

  goArticleDetail(e) {
    const id = e.detail && e.detail.id || e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: `/pages/discover/look/detail?id=${id}` })
    }
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  },

  startChat() {
    const f = this.data.figure || {}
    const name = f.title ? `${f.name} · ${f.title}` : f.name
    wx.navigateTo({
      url: `/pages/chat/room?figureId=${f._id}&figureName=${encodeURIComponent(name)}`
    })
  },

  sendLetter() {
    const f = this.data.figure || {}
    const figureId = (f.figureId || f.id || f._id || '').toString()
    const figureName = encodeURIComponent(f.name || f.figureName || '')
    const dynasty = f.dynasty || ''
    wx.navigateTo({
      url: `/pages/yan/index?figureId=${figureId}&figureName=${figureName}&dynasty=${dynasty}`
    })
  },

  goBookReader(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/lantai/book-reader?id=${id}` })
  },

  goMoment(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/discover/moment-detail?id=${id}` })
  },

  onChannelFollow() {
    const channel = this.data.channelInfo

    requestCloud('videoChannel', 'toggleFollow', { channelId: channel._id }, { throwError: false })
      .then(res => {
        if (res && typeof res.followed !== 'undefined') {
          const updated = Object.assign({}, channel, { followed: res.followed })
          this.setData({ channelInfo: Object.assign({}, updated, patchAuthorForDisplay(updated)) })
          wx.showToast({ title: res.followed ? '已关注' : '已取消关注', icon: 'none' })
        }
      })
      .catch(() => {})
  },

  goVideoDetail(e) {
    const id = e.currentTarget.dataset.id
    const channelInfo = this.data.channelInfo || {}
    const figureId = this.data.figureId || ''
    const params = [`videoId=${id}`]
    if (channelInfo._id) params.push(`channelId=${channelInfo._id}`)
    if (figureId) params.push(`figureId=${figureId}`)
    wx.navigateTo({
      url: `/pages/discover/channels/index?${params.join('&')}`
    })
  },

  onShareAppMessage() {
    const f = this.data.figure || {}
    return {
      title: `${f.name || ''}${f.title ? ' · ' + f.title : ''} | 穿越圈人物图鉴`,
      path: `/pages/lantai/figure-detail?id=${this.data.id}`
    }
  }
})
