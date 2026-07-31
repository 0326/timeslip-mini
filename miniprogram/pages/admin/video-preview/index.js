const { requestCloud } = require('../../../utils/cloudRequest')
const loginGuard = require('../../../utils/loginGuard')

Page({
  data: {
    videoId: '',
    loading: true,
    video: null,
    error: ''
  },

  onLoad(options) {
    if (!loginGuard.requireAdmin(this)) return
    const videoId = (options && options.videoId) || ''
    if (!videoId) {
      this.setData({ loading: false, error: '缺少视频ID' })
      return
    }
    this.setData({ videoId })
    this.loadVideo(videoId)
  },

  async loadVideo(videoId) {
    this.setData({ loading: true, error: '' })
    try {
      const data = await requestCloud('videoChannel', 'videoDetail', { videoId }, { throwError: false })
      if (!data) {
        this.setData({ loading: false, error: '视频不存在或已删除' })
        return
      }
      this.setData({ video: data, loading: false })
    } catch (e) {
      this.setData({ loading: false, error: e.message || '加载失败' })
    }
  },

  onBack() {
    wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/discover/index' }) })
  },

  stopPropagation() {}
})
