Component({
  options: { styleIsolation: 'apply-shared' },
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/chat/index', text: '穿越', icon: '💬', iconActive: '💬' },
      { pagePath: '/pages/lantai/index', text: '兰台', icon: '📖', iconActive: '📚' },
      { pagePath: '/pages/discover/index', text: '发现', icon: '🧭', iconActive: '🧭' },
      { pagePath: '/pages/profile/index', text: '我的', icon: '👤', iconActive: '🏵️' }
    ]
  },
  lifetimes: {
    attached() {
      try {
        const app = getApp()
        if (app && app.onTabChange) {
          app.onTabChange = (idx) => this.setData({ selected: idx })
        }
        if (app && app.subscribeTabBadge) {
          app.subscribeTabBadge((badges) => {
            const list = this.data.list.map((l, i) => ({ ...l, badge: badges[i] || 0 }))
            this.setData({ list })
          })
        }
      } catch (_) {}
    }
  },
  methods: {
    onTabTap(e) {
      const idx = e.currentTarget.dataset.index
      const path = e.currentTarget.dataset.path
      this.setData({ selected: idx })
      wx.switchTab({
        url: path,
        fail: (err) => {
          console.warn('switchTab fail', err)
          wx.reLaunch({ url: path })
        }
      })
      try {
        const app = getApp()
        if (app && app.emitTabChange) app.emitTabChange(idx, path)
      } catch (_) {}
    }
  }
})
