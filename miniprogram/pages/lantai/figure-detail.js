const { requestCloud } = require('../../utils/cloudRequest')
const { getDynastyInfo } = require('../../utils/date')
const { storage } = require('../../utils/storage')
const loginGuard = require('../../utils/loginGuard')

const MOCK_FIGURE = {
  _id: 'simaqian',
  name: '司马迁',
  title: '太史公',
  dynasty: 'han',
  era: '西汉',
  birth: '公元前145年',
  death: '约公元前86年',
  avatar: 'https://img.icons8.com/color/96/writer.png',
  bio: '字子长，夏阳（今陕西韩城南）人。西汉史学家、散文家。司马谈之子，任太史令，因替李陵败降之事辩解而受宫刑，后任中书令。发奋继续完成所著史籍，被后世尊称为史迁、太史公、历史之父。',
  masterpieces: ['史记（一百三十篇）', '报任安书'],
  famousQuotes: [
    '人固有一死，或重于泰山，或轻于鸿毛。',
    '究天人之际，通古今之变，成一家之言。',
    '网罗天下放失旧闻，考之行事，稽其成败兴坏之纪。'
  ],
  relatedMoments: [
    { _id: 'm1', title: '鸿门宴', desc: '史记·项羽本纪详载此事', figureName: '刘邦', time: '前206年' }
  ],
  relatedBooks: [
    { id: 'shiji', title: '史记', chapter: '全书130篇' }
  ],
  unlocked: true
}

Page({
  data: {
    id: '',
    figure: null,
    dynastyInfo: null,
    tab: 'bio',
    loading: true,
    channelInfo: null,
    channelVideos: []
  },

  onLoad(options) {
    const id = options.id || 'simaqian'
    const tab = options.tab || 'bio'
    this.setData({ id, tab })
    this.loadDetail(id)
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  async loadDetail(id) {
    try {
      let figure
      const cached = storage.get('figure_' + id)
      if (cached) figure = cached
      if (!figure) {
        const data = await requestCloud('shiji', 'figureDetail', { id }, { throwError: false })
        figure = (data && data.figure) || MOCK_FIGURE
        storage.set('figure_' + id, figure, 86400)
      }
      this.setData({
        figure,
        dynastyInfo: getDynastyInfo(figure.dynasty),
        loading: false
      })
      this.loadChannel(id)
    } catch (e) {
      this.setData({ figure: MOCK_FIGURE, dynastyInfo: getDynastyInfo(MOCK_FIGURE.dynasty), loading: false })
    }
  },

  async loadChannel(figureId) {
    try {
      const data = await requestCloud('videoChannel', 'channelByFigure', { figureId }, { throwError: false })
      if (data && data.channel) {
        this.setData({
          channelInfo: data.channel,
          channelVideos: data.videos || []
        })
      }
    } catch (e) {}
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  },

  startChat() {
    const f = this.data.figure || {}
    if (!f.unlocked) {
      wx.showToast({ title: '此人物未解锁', icon: 'none' })
      return
    }
    const name = f.title ? `${f.name} · ${f.title}` : f.name
    wx.navigateTo({
      url: `/pages/chat/room?figureId=${f._id}&figureName=${encodeURIComponent(name)}`
    })
  },

  sendLetter() {
    const f = this.data.figure || {}
    if (!f.unlocked) {
      wx.showToast({ title: '此人物未解锁', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/discover/pigeon?figureId=${f._id}&figureName=${encodeURIComponent(f.name)}`
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
    if (!channel || !loginGuard.checkLogin(this)) return

    requestCloud('videoChannel', 'toggleFollow', { channelId: channel._id }, { throwError: false })
      .then(res => {
        if (res && typeof res.followed !== 'undefined') {
          channel.followed = res.followed
          this.setData({ channelInfo: channel })
          wx.showToast({ title: res.followed ? '已关注' : '已取消关注', icon: 'none' })
        }
      })
      .catch(() => {})
  },

  goVideoDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/discover/channels/index?videoId=${id}`
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
