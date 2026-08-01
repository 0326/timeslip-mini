const { requestCloud } = require('../../../utils/cloudRequest')
const loginGuard = require('../../../utils/loginGuard')

Page({
  data: {
    videoList: [],
    loading: true,
    channelList: [],
    currentChannelId: '',
    lastCreatedAt: null,
    hasMore: true
  },

  onLoad() {
    if (!loginGuard.requireAdmin(this)) return
    this.loadVideos(true)
  },

  onPullDownRefresh() {
    this.loadVideos(true)
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.loadVideos(false)
    }
  },

  async loadVideos(reset) {
    this.setData({ loading: true })
    try {
      const params = {
        limit: 20
      }
      if (this.data.currentChannelId) {
        params.channelId = this.data.currentChannelId
      }
      if (!reset && this.data.lastCreatedAt) {
        params.lastCreatedAt = this.data.lastCreatedAt
      }

      const data = await requestCloud('videoChannel', 'adminVideoList', params, { throwError: false })
      const list = data || []
      const newList = reset ? list : this.data.videoList.concat(list)

      this.setData({
        videoList: newList,
        lastCreatedAt: list.length > 0 ? list[list.length - 1].createdAt : null,
        hasMore: list.length === 20,
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
    }
    wx.stopPullDownRefresh()
  },

  onVideoTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/admin/video-preview/index?videoId=${id}`
    })
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/admin/video-upload/index?editId=${id}` })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条视频吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await requestCloud('videoChannel', 'adminVideoRemove', { videoId: id }, { throwError: false })
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadVideos(true)
        } catch (e) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  onToggleStatus(e) {
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
          this.loadVideos(true)
        } catch (err) {
          wx.showToast({ title: `${actionText}失败`, icon: 'none' })
        }
      }
    })
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/admin/video-upload/index' })
  },

  goChannelManage() {
    wx.navigateTo({ url: '/pages/admin/channel-manage/index' })
  }
})
