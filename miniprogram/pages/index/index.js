Page({
  data: {
    userInfo: null,
    points: 0,
    loading: true
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    const app = getApp()
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        points: app.globalData.points,
        loading: false
      })
    }
  },

  async loadUserInfo() {
    const app = getApp()
    const { ensureUser } = require('../../utils/auth')
    const userInfo = await ensureUser(app)
    if (userInfo) {
      this.setData({
        userInfo,
        points: app.globalData.points,
        loading: false
      })
    } else {
      this.setData({ loading: false })
    }
  },

  onTapProfile() {
    wx.showToast({ title: '个人中心开发中', icon: 'none' })
  }
})
