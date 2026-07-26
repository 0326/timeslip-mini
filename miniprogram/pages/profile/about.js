Page({
  rateApp: function () {
    wx.previewImage({
      current: '',
      urls: ['https://img.icons8.com/color/96/five-star.png'],
      fail: function () {
        wx.showToast({ title: '感谢您的支持！', icon: 'none' })
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
      content: '穿越圈 · 穿越兰台团队\n\n微信公众号：穿越兰台\n邮箱：hello@timeslip.work\n官网：https://shiji.timeslip.work\n\n欢迎反馈问题与建议！',
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
