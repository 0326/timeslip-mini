const { requestCloud } = require('../../../utils/cloudRequest')
const loginGuard = require('../../../utils/loginGuard')

Page({
  data: {
    channelId: '',
    channel: null,
    videoList: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    editBio: ''
  },

  onLoad(options) {
    if (!loginGuard.requireAdmin(this)) return
    const channelId = options.channelId || ''
    if (!channelId) {
      wx.showToast({ title: '缺少视频号ID', icon: 'none' })
      return
    }
    this.setData({ channelId })
    this.loadData()
  },

  onShow() {
    // 从视频编辑页返回时刷新
    if (this.data.channelId && !this.data.loading) {
      this.loadVideos(true)
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadVideos(false)
    }
  },

  async loadData() {
    this.setData({ loading: true })
    await this.loadChannel()
    await this.loadVideos(true)
    this.setData({ loading: false })
  },

  async loadChannel() {
    try {
      const data = await requestCloud('videoChannel', 'channelDetail', {
        channelId: this.data.channelId
      }, { throwError: false })
      if (data) {
        this.setData({
          channel: data,
          editBio: data.bio || ''
        })
      }
    } catch (e) {}
  },

  async loadVideos(reset) {
    if (reset) {
      this.setData({ videoList: [], hasMore: true })
    }
    if (this.data.loadingMore) return
    this.setData({ loadingMore: true })
    try {
      const params = {
        channelId: this.data.channelId,
        limit: 20
      }
      if (!reset && this.data.videoList.length > 0) {
        const last = this.data.videoList[this.data.videoList.length - 1]
        if (last && last.createdAt) params.lastCreatedAt = last.createdAt
      }
      const data = await requestCloud('videoChannel', 'adminVideoList', params, { throwError: false })
      const list = data || []
      const newList = reset ? list : this.data.videoList.concat(list)
      this.setData({
        videoList: newList,
        hasMore: list.length === 20,
        loadingMore: false
      })
    } catch (e) {
      this.setData({ loadingMore: false })
    }
  },

  onBioInput(e) {
    this.setData({ editBio: e.detail.value })
  },

  async saveBio() {
    try {
      await requestCloud('videoChannel', 'adminChannelUpdate', {
        channelId: this.data.channelId,
        bio: this.data.editBio
      }, { throwError: false })
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  goAddVideo() {
    wx.navigateTo({
      url: `/pages/admin/video-upload/index?channelId=${this.data.channelId}`
    })
  },

  onVideoTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/admin/video-preview/index?videoId=${id}`
    })
  },

  onEditVideo(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/admin/video-upload/index?editId=${id}`
    })
  },

  onToggleVideo(e) {
    const id = e.currentTarget.dataset.id
    const currentStatus = e.currentTarget.dataset.status
    const newStatus = currentStatus === 'published' ? 'unpublished' : 'published'
    const actionText = newStatus === 'published' ? '上架' : '下架'
    wx.showModal({
      title: '确认操作',
      content: `确定要${actionText}这条视频吗？`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          await requestCloud('videoChannel', 'adminVideoUpdate', {
            videoId: id,
            status: newStatus
          }, { throwError: false })
          wx.showToast({ title: `已${actionText}`, icon: 'success' })
          this.loadVideos()
        } catch (err) {
          wx.showToast({ title: `${actionText}失败`, icon: 'none' })
        }
      }
    })
  },

  onDeleteVideo(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条视频吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await requestCloud('videoChannel', 'adminVideoRemove', { videoId: id }, { throwError: false })
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadVideos()
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  }
})
