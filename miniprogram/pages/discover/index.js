Page({
  data: {
    groups: [
      {
        items: [
          { key: 'moments', icon: '📸', name: '朋友圈', url: '/pages/discover/moments' }
        ]
      },
      {
        items: [
          { key: 'channels', icon: '📺', name: '视频号', url: '' },
          { key: 'live', icon: '🎥', name: '直播', url: '' }
        ]
      },
      {
        items: [
          { key: 'dna', icon: '🧬', name: '测一测', url: '/pages/discover/dna-hall/index' },
          { key: 'memorial', icon: '📜', name: '批一批', url: '/pages/discover/memorial' }
        ]
      },
      {
        items: [
          { key: 'listen', icon: '🎧', name: '听一听', url: '' },
          { key: 'look', icon: '👀', name: '看一看', url: '' }
        ]
      }
    ]
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 2)
  },

  onItemTap(e) {
    const { url, name } = e.currentTarget.dataset
    if (!url) {
      wx.showToast({ title: '即将上线', icon: 'none' })
      return
    }
    wx.navigateTo({
      url,
      fail: () => wx.showToast({ title: '功能开发中', icon: 'none' })
    })
  }
})
