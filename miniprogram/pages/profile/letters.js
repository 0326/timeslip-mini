const loginGuard = require('../../utils/loginGuard')

Page({
  data: {},

  onShow() {
    if (!loginGuard.checkLogin(this)) return
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
