
Page({
  data: {},

  onShow() {
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/profile/index' }) })
  },

  goRecords() {
    wx.navigateTo({ url: '/pages/yan/records' })
  },

  goWrite() {
    wx.navigateTo({ url: '/pages/yan/index' })
  }
})
