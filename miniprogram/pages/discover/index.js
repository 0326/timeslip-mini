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
          { key: 'channels', iconClass: 'shipinhao', name: '视频号', color: '#FA5151', url: '/pages/discover/channels/index', locked: true },
          { key: 'letters', iconClass: 'mail', name: '雁书', color: '#C9A24D', url: '/pages/yan/index', locked: true }
        ]
      },
      {
        items: [
          { key: 'dna', iconClass: 'cyc', name: '测一测', color: '#722ED1', url: '/pages/discover/dna-hall/index' },
          { key: 'memorial', iconClass: 'pyp', name: '批一批', color: '#C9A24D', url: '/pages/discover/memorial', locked: true },
          { key: 'look', iconClass: 'kyk', name: '看一看', color: '#1890FF', url: '/pages/discover/look/index' }
        ]
      }
    ]
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 2)
  },

  onItemTap(e) {
    const { url, name, locked } = e.currentTarget.dataset
    if (locked) {
      wx.showToast({ title: '未解锁该功能，请继续探索哦', icon: 'none' })
      return
    }
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
