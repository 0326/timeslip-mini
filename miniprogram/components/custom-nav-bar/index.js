Component({
  options: {
    multipleSlots: true,
    styleIsolation: 'apply-shared'
  },

  properties: {
    title: { type: String, value: '' },
    subTitle: { type: String, value: '' },
    showBack: { type: Boolean, value: true },
    showHome: { type: Boolean, value: false },
    backText: { type: String, value: '' },
    bgColor: { type: String, value: '#ffffff' },
    textColor: { type: String, value: '#191919' },
    fixed: { type: Boolean, value: true },
    translucent: { type: Boolean, value: false },
    capsule: { type: Boolean, value: false },
    noPlaceholder: { type: Boolean, value: false }
  },

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuTop: 24,
    menuHeight: 32,
    menuRight: 8
  },

  attached() {
    try {
      const sys = wx.getSystemInfoSync()
      const statusBarHeight = sys.statusBarHeight || 20
      let menuTop = statusBarHeight + 4
      let menuHeight = 32
      let menuRight = 8
      try {
        const rect = wx.getMenuButtonBoundingClientRect()
        menuTop = rect.top
        menuHeight = rect.height
        menuRight = sys.windowWidth - rect.right
      } catch (e) {}
      this.setData({
        statusBarHeight,
        navBarHeight: menuHeight + (menuTop - statusBarHeight) * 2,
        menuTop,
        menuHeight,
        menuRight
      })
    } catch (e) {}
  },

  methods: {
    onBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack({ fail: () => { wx.switchTab({ url: '/pages/chat/index' }) } })
      } else {
        wx.switchTab({ url: '/pages/chat/index' })
      }
      this.triggerEvent('back')
    },

    onHome() {
      wx.switchTab({ url: '/pages/chat/index' })
      this.triggerEvent('home')
    },

    onTitleClick() {
      this.triggerEvent('titleclick')
    }
  }
})
