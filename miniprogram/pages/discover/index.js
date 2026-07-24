const { requestCloud } = require('../../utils/cloudRequest')
const { formatRelative, getDynastyInfo } = require('../../utils/date')
const { DYNASTY_FILTERS, PAGINATION } = require('../../utils/constants')
const { storage } = require('../../utils/storage')
const { throttle } = require('../../utils/helpers')

const MOCK_MOMENTS = [
  {
    _id: 'm1',
    figureId: 'liubang',
    figureName: '刘邦',
    figureTitle: '汉高祖',
    avatar: 'https://img.icons8.com/color/96/king.png',
    dynasty: 'han',
    content: '今日鸿门，气氛有点微妙。项庄舞剑，意在沛公啊！幸好项伯出来解围，不然今日要交代在这里了...😅',
    images: [],
    historicalEvent: '鸿门宴',
    historicalDate: '公元前206年',
    likes: [
      { openid: 'fan_kuai', name: '樊哙', avatar: '' },
      { openid: 'zhang_liang', name: '张良', avatar: '' },
      { openid: 'xiao_he', name: '萧何', avatar: '' }
    ],
    likeCount: 3,
    comments: [
      { openid: 'fan_zeng', name: '范增', content: '竖子不足与谋！唉，错失良机啊！' },
      { openid: 'xiang_yu', name: '项羽', content: '大哥别走啊，再来喝两杯🤔' },
      { openid: 'zhang_liang', name: '张良', content: '主公吉人天相，此一劫过，后必有大福。' }
    ],
    commentCount: 3,
    createdAt: Date.now() - 3600000 * 2
  },
  {
    _id: 'm2',
    figureId: 'zhugeliang',
    figureName: '诸葛亮',
    figureTitle: '武乡侯',
    avatar: 'https://img.icons8.com/color/96/general.png',
    dynasty: 'sanguo',
    content: '臣本布衣，躬耕于南阳，苟全性命于乱世，不求闻达于诸侯。先帝不以臣卑鄙，猥自枉屈，三顾臣于草庐之中...',
    images: [],
    historicalEvent: '三顾茅庐',
    historicalDate: '公元207年',
    likes: [],
    likeCount: 88,
    comments: [
      { openid: 'liubei', name: '刘备', content: '孔明先生，备得先生，如鱼得水也！' },
      { openid: 'guanyu', name: '关羽', content: '嗯......确实有几分本事。' },
      { openid: 'zhangfei', name: '张飞', content: '俺也觉得军师说的对！' }
    ],
    commentCount: 3,
    createdAt: Date.now() - 86400000
  },
  {
    _id: 'm3',
    figureId: 'libai',
    figureName: '李白',
    figureTitle: '诗仙',
    avatar: 'https://img.icons8.com/color/96/poet.png',
    dynasty: 'tang',
    content: '桃花潭水深千尺，不及汪伦送我情。\n今日一别，不知何日再聚，唯有诗酒相赠！🍶',
    images: [],
    historicalEvent: '赠汪伦',
    historicalDate: '天宝年间',
    likes: [],
    likeCount: 1024,
    comments: [
      { openid: 'dufu', name: '杜甫', content: '白也诗无敌，飘然思不群！' },
      { openid: 'wanglun', name: '汪伦', content: '先生下次一定要再来啊！我这里还有万家酒店！' }
    ],
    commentCount: 2,
    createdAt: Date.now() - 86400000 * 2
  },
  {
    _id: 'm4',
    figureId: 'sushi',
    figureName: '苏轼',
    figureTitle: '东坡居士',
    avatar: 'https://img.icons8.com/color/96/writer.png',
    dynasty: 'song',
    content: '黄州好猪肉，价贱如泥土。贵者不肯吃，贫者不解煮，早晨起来打两碗，饱得自家君莫管。🥩',
    images: [],
    historicalEvent: '东坡肉',
    historicalDate: '元丰年间',
    likes: [],
    likeCount: 520,
    comments: [
      { openid: 'fo_yin', name: '佛印', content: '居士又在研究吃了？哈哈哈！' },
      { openid: 'huangtingjian', name: '黄庭坚', content: '老师！求秘方！' }
    ],
    commentCount: 2,
    createdAt: Date.now() - 86400000 * 3
  }
]

Page({
  data: {
    dynastyFilters: DYNASTY_FILTERS,
    currentDynasty: 'all',
    subTab: 'moments',
    moments: [],
    page: 0,
    hasMore: true,
    loading: false,
    refreshing: false,
    quickEntries: [
      { key: 'dna', name: '历史人格', desc: '测测你是谁？', icon: '🧬', url: '/pages/discover/dna-test', color: 'linear-gradient(135deg,#667eea,#764ba2)' },
      { key: 'pigeon', name: '飞鸽传书', desc: '写信给古人', icon: '🕊️', url: '/pages/discover/pigeon', color: 'linear-gradient(135deg,#f093fb,#f5576c)' },
      { key: 'memorial', name: '批奏折', desc: '体验当皇帝', icon: '📜', url: '/pages/discover/memorial', color: 'linear-gradient(135deg,#f6d365,#fda085)' }
    ]
  },

  onLoad() {
    this.loadMoments(true)
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 2)
  },

  onPullDownRefresh() {
    this.loadMoments(true)
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoments(false)
    }
  },

  async loadMoments(reset) {
    if (this.data.loading) return
    this.setData({ loading: true, refreshing: reset })
    try {
      const page = reset ? 0 : this.data.page
      let data
      try {
        data = await requestCloud('moment', 'list', {
          dynasty: this.data.currentDynasty === 'all' ? '' : this.data.currentDynasty,
          page,
          pageSize: PAGINATION.MOMENT_PAGE_SIZE
        }, { throwError: false })
      } catch (e) {}

      let list
      if (data && data.moments && data.moments.length) {
        list = data.moments
      } else {
        list = reset ? MOCK_MOMENTS.slice(0, PAGINATION.MOMENT_PAGE_SIZE) : []
      }

      list = list.map(m => ({
        ...m,
        dynastyInfo: getDynastyInfo(m.dynasty),
        displayTime: formatRelative(m.createdAt),
        likeText: m.likeCount > 999 ? (m.likeCount / 1000).toFixed(1) + 'k' : m.likeCount
      }))

      storage.set('moments_' + this.data.currentDynasty, list, 1800)

      this.setData({
        moments: reset ? list : this.data.moments.concat(list),
        page: page + 1,
        hasMore: list.length === PAGINATION.MOMENT_PAGE_SIZE,
        loading: false,
        refreshing: false
      })
    } catch (e) {
      this.setData({ loading: false, refreshing: false })
    }
    wx.stopPullDownRefresh()
  },

  selectDynasty(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.currentDynasty) return
    this.setData({ currentDynasty: key, page: 0, hasMore: true })
    this.loadMoments(true)
  },

  switchSub(e) {
    this.setData({ subTab: e.currentTarget.dataset.tab })
  },

  _onLike: null,
  onLike(e) {
    if (!this._onLike) this._onLike = throttle(this.handleLike.bind(this), 300)
    this._onLike(e)
  },

  async handleLike(e) {
    const id = e.currentTarget.dataset.id
    const moments = this.data.moments.slice()
    const idx = moments.findIndex(m => m._id === id)
    if (idx < 0) return
    const moment = moments[idx]
    const nowLiked = !moment._liked
    const app = getApp()
    const openid = (app.globalData && app.globalData.openid) || 'me'
    const likes = moment.likes || []
    if (nowLiked) {
      likes.push({ openid, name: '我', avatar: '' })
      moment.likeCount = (moment.likeCount || 0) + 1
    } else {
      const newLikes = likes.filter(l => l.openid !== openid)
      moment.likes = newLikes
      moment.likeCount = Math.max(0, (moment.likeCount || 0) - 1)
    }
    moment._liked = nowLiked
    moment.likeText = moment.likeCount > 999 ? (moment.likeCount / 1000).toFixed(1) + 'k' : moment.likeCount
    moments[idx] = moment
    this.setData({ moments })
    try {
      await requestCloud('moment', nowLiked ? 'like' : 'unlike', { momentId: id }, { throwError: false })
    } catch (e) {}
  },

  openMomentDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/discover/moment-detail?id=${id}` })
  },

  openQuick(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.navigateTo({
      url,
      fail: () => {
        wx.showToast({ title: '功能开发中', icon: 'none' })
      }
    })
  },

  openCommentInput(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '发表评论',
      editable: true,
      placeholderText: '友善评论，穿越时空的对话...',
      success: async (r) => {
        if (!r.confirm || !r.content) return
        if (r.content.length > 200) {
          wx.showToast({ title: '最多200字', icon: 'none' })
          return
        }
        const moments = this.data.moments.slice()
        const idx = moments.findIndex(m => m._id === id)
        if (idx < 0) return
        const m = moments[idx]
        m.comments = m.comments || []
        m.comments.push({ openid: 'me', name: '我', content: r.content })
        m.commentCount = (m.commentCount || 0) + 1
        moments[idx] = m
        this.setData({ moments })
        wx.showToast({ title: '已发布', icon: 'success' })
      }
    })
  }
})
