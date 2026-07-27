Component({
  options: { styleIsolation: 'apply-shared' },
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/chat/index', text: '穿越', icon: '/images/tabbar/chat.png', iconActive: '/images/tabbar/chat_f.png' },
      { pagePath: '/pages/lantai/index', text: '兰台', icon: '/images/tabbar/lantai.png', iconActive: '/images/tabbar/lantai_f.png' },
      { pagePath: '/pages/discover/index', text: '发现', icon: '/images/tabbar/find.png', iconActive: '/images/tabbar/find_f.png' },
      { pagePath: '/pages/profile/index', text: '我的', icon: '/images/tabbar/mine.png', iconActive: '/images/tabbar/mine_f.png' }
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
      const pages = getCurrentPages()
      const currentRoute = pages.length ? '/' + pages[pages.length - 1].route : ''
      if (currentRoute === path) {
        this.setData({ selected: idx })
        return
      }
      wx.switchTab({
        url: path,
        success: () => {
          this.setData({ selected: idx })
          try {
            const app = getApp()
            if (app && app.emitTabChange) app.emitTabChange(idx, path)
          } catch (_) {}
        },
        fail: (err) => {
          console.warn('switchTab fail', err)
          wx.reLaunch({
            url: path,
            success: () => this.setData({ selected: idx })
          })
        }
      })
    }
  }
})
