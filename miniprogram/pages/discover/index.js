Page({
  data: {
    groups: [
      {
        items: [
          { key: 'moments', iconSrc: '/images/pyq.png', name: '朋友圈', url: '/pages/discover/moments' }
        ]
      },
      {
        items: [
          { key: 'channels', iconClass: 'shipinhao', name: '视频号', color: '#FA5151', url: '' },
          { key: 'live', iconClass: 'zhibo', name: '直播', color: '#FF7A45', url: '' }
        ]
      },
      {
        items: [
          { key: 'dna', iconClass: 'cyc', name: '测一测', color: '#722ED1', url: '/pages/discover/dna-hall/index' },
          { key: 'memorial', iconClass: 'pyp', name: '批一批', color: '#C9A24D', url: '/pages/discover/memorial' }
        ]
      },
      {
        items: [
          { key: 'listen', iconClass: 'tyt', name: '听一听', color: '#07C160', url: '' },
          { key: 'look', iconClass: 'kyk', name: '看一看', color: '#1890FF', url: '' }
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
