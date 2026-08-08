const { requestCloud } = require('../../../utils/cloudRequest')
const loginGuard = require('../../../utils/loginGuard')
const { patchListForDisplay, patchAuthorForDisplay } = require('../../../utils/publicIdentity')

Page({
  data: {
    channelId: '',
    figureId: '',
    channel: null,
    videoList: [],
    loading: true,
    isLoggedIn: false,
    tab: 'videos'
  },

  onLoad(options) {
    const channelId = options.channelId || ''
    const figureId = options.figureId || ''
    this.setData({ channelId, figureId })
    this._init()
  },

  async _init() {
    await this.loadChannel()
    this.loadVideos()
  },

  onShow() {
    this.setData({ isLoggedIn: loginGuard.isLoggedIn() })
  },

  async loadChannel() {
    try {
      const params = {}
      if (this.data.channelId) params.channelId = this.data.channelId
      if (this.data.figureId) params.figureId = this.data.figureId
      const data = await requestCloud('videoChannel', 'channelDetail', params, { throwError: false })
      if (data) {
        this.setData({
          channel: Object.assign({}, data, patchAuthorForDisplay(data)),
          channelId: data._id
        })
      }
    } catch (e) {}
  },

  async loadVideos() {
    this.setData({ loading: true })
    try {
      const chId = this.data.channelId
      if (!chId) {
        this.setData({ loading: false })
        return
      }
      const data = await requestCloud('videoChannel', 'channelVideos', {
        channelId: chId
      }, { throwError: false })
      this.setData({
        videoList: patchListForDisplay(data || []),
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  onFollow() {
    const channelId = this.data.channelId
    if (!channelId) return

    requestCloud('videoChannel', 'toggleFollow', { channelId }, { throwError: false })
      .then(res => {
        if (res && typeof res.followed !== 'undefined') {
          const channel = { ...this.data.channel, ...patchAuthorForDisplay(this.data.channel), followed: res.followed, followerCount: res.followerCount }
          this.setData({ channel })
          wx.showToast({ title: res.followed ? '已关注' : '已取消关注', icon: 'none' })
        }
      })
      .catch(() => {})
  },

  onVideoTap(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/discover/channels/index?videoId=${id}`
    })
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  },

  onShareAppMessage() {
    const c = this.data.channel || {}
    return {
      title: `${c.figureName || ''}${c.figureTitle ? ' · ' + c.figureTitle : ''} 的视频号`,
      path: `/pages/discover/channel-detail/index?channelId=${this.data.channelId}`
    }
  }
})
