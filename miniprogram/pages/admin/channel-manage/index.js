const { requestCloud } = require('../../../utils/cloudRequest')
const loginGuard = require('../../../utils/loginGuard')

Page({
  data: {
    channelList: [],
    loading: true,
    showCreate: false,
    createForm: {
      figureId: '',
      figureName: '',
      figureTitle: '',
      bio: ''
    },
    figureOptions: []
  },

  onLoad() {
    if (!loginGuard.isLoggedIn()) {
      wx.redirectTo({ url: '/pages/login/index' })
      return
    }
    this.loadChannels()
  },

  onPullDownRefresh() {
    this.loadChannels()
  },

  async loadChannels() {
    this.setData({ loading: true })
    try {
      const data = await requestCloud('videoChannel', 'adminChannelList', {}, { throwError: false })
      this.setData({
        channelList: data || [],
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
    }
    wx.stopPullDownRefresh()
  },

  openCreate() {
    this.setData({
      showCreate: true,
      createForm: {
        figureId: '',
        figureName: '',
        figureTitle: '',
        bio: ''
      }
    })
  },

  closeCreate() {
    this.setData({ showCreate: false })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`createForm.${field}`]: e.detail.value
    })
  },

  async submitCreate() {
    const form = this.data.createForm
    if (!form.figureId) {
      wx.showToast({ title: '请输入人物ID', icon: 'none' })
      return
    }
    if (!form.figureName) {
      wx.showToast({ title: '请输入人物名称', icon: 'none' })
      return
    }

    try {
      await requestCloud('videoChannel', 'adminChannelCreate', form, { throwError: false })
      wx.showToast({ title: '创建成功', icon: 'success' })
      this.setData({ showCreate: false })
      this.loadChannels()
    } catch (e) {
      wx.showToast({ title: e.message || '创建失败', icon: 'none' })
    }
  },

  onChannelTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/discover/channel-detail/index?channelId=${id}`
    })
  },

  stopPropagation() {}
})
