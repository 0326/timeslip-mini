Page({
  data: { version: 'v1.0.0' },

  onLoad() {
    try {
      const info = wx.getAccountInfoSync && wx.getAccountInfoSync()
      if (info && info.miniProgram && info.miniProgram.version) {
        this.setData({ version: 'v' + info.miniProgram.version })
      }
    } catch (e) {}
  },

  rateApp() {
    wx.showModal({
      title: '给我们评分',
      content: '感谢您的支持！\n\n请在微信「发现-小程序」中搜索「穿越圈」，进入后点击右上角「···」选择「评价」即可为我们打分。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  checkUpdate() {
    const um = wx.getUpdateManager && wx.getUpdateManager()
    if (!um) {
      wx.showToast({ title: '当前版本不支持检查更新', icon: 'none' })
      return
    }
    wx.showLoading({ title: '检查中...' })
    um.onCheckForUpdate(function (res) {
      wx.hideLoading()
      if (res.hasUpdate) {
        wx.showModal({
          title: '发现新版本',
          content: '新版本已下载，是否重启应用？',
          success: function (r) {
            if (r.confirm) um.applyUpdate()
          }
        })
      } else {
        wx.showToast({ title: '已是最新版本', icon: 'success' })
      }
    })
  },

  shareApp: function () {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] })
    wx.showToast({ title: '点击右上角分享', icon: 'none' })
  },

  contactUs: function () {
    wx.showModal({
      title: '联系我们',
      content: '穿越圈 · 穿越兰台团队\n\n邮箱：1833559609@qq.com\n\n官网：https://timeslip.work\n\n欢迎反馈问题与建议！',
      showCancel: false,
      confirmText: '好的'
    })
  },

  onShareAppMessage: function () {
    return {
      title: '穿越圈 · 和历史人物做朋友',
      path: '/pages/discover/index'
    }
  }
})
