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
      avatar: '',
      bio: ''
    },
    figureOptions: [],
    selectedFigureId: ''
  },

  onLoad() {
    if (!loginGuard.requireAdmin(this)) return
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

  async loadFigures() {
    if (this.data.figureOptions.length > 0) return
    try {
      const data = await requestCloud('shiji', 'figureList', { limit: 200 }, { throwError: false })
      this.setData({ figureOptions: data || [] })
    } catch (e) {}
  },

  openCreate() {
    this.setData({
      showCreate: true,
      createForm: {
        figureId: '',
        figureName: '',
        figureTitle: '',
        avatar: '',
        bio: ''
      },
      selectedFigureId: ''
    })
    this.loadFigures()
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

  onFigureSelect(e) {
    const figure = e.currentTarget.dataset.figure
    this.setData({
      selectedFigureId: figure.figureId,
      createForm: {
        figureId: 'fig-' + figure.figureId,
        figureName: figure.figureName,
        figureTitle: figure.title || '',
        avatar: figure.avatar || '',
        bio: ''
      }
    })
  },

  async submitCreate() {
    if (!this.data.selectedFigureId) {
      wx.showToast({ title: '请先选择角色', icon: 'none' })
      return
    }
    try {
      await requestCloud('videoChannel', 'adminChannelCreate', this.data.createForm, { throwError: false })
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
      url: `/pages/admin/channel-detail/index?channelId=${id}`
    })
  },

  stopPropagation() {}
})
