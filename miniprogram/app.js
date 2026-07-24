const { ensureUser } = require('./utils/auth')
const { setTabBar } = require('./utils/globalLogic')

App({
  globalData: {
    userInfo: null,
    openid: '',
    points: 0,
    memberLevel: '普通会员',
    ancientName: '',
    crossNo: '',
    cache: {
      figures: null,
      dnaQuestions: null
    },
    currentTab: 0
  },

  tabList: [
    { pagePath: 'pages/chat/index', name: '聊天', icon: '💬' },
    { pagePath: 'pages/lantai/index', name: '兰台', icon: '📖' },
    { pagePath: 'pages/discover/index', name: '发现', icon: '🧭' },
    { pagePath: 'pages/profile/index', name: '我的', icon: '👤' }
  ],

  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      wx.showModal({
        title: '基础库版本过低',
        content: '请升级微信至最新版本使用本小程序',
        showCancel: false
      })
      return
    }

    wx.cloud.init({
      env: 'cloud1-d0gunpzup215cfd87',
      traceUser: true
    })

    this.loadFonts()
    this.initUser()
    this.preloadCommonData()
  },

  onShow() {
    // 后台切回时刷新用户信息
    if (this.globalData.openid) {
      this.refreshUserQuietly()
    }
  },

  pointsListeners: [],
  userListeners: [],

  subscribePoints(cb) {
    this.pointsListeners.push(cb)
    return () => {
      this.pointsListeners = this.pointsListeners.filter(l => l !== cb)
    }
  },

  emitPointsUpdate(points) {
    this.globalData.points = points
    this.pointsListeners.forEach(cb => {
      try { cb(points) } catch (e) {}
    })
  },

  subscribeUser(cb) {
    this.userListeners.push(cb)
    return () => {
      this.userListeners = this.userListeners.filter(l => l !== cb)
    }
  },

  emitUserUpdate(userInfo) {
    if (userInfo) {
      this.globalData.userInfo = userInfo
      this.globalData.points = userInfo.points || 0
      this.globalData.ancientName = userInfo.ancientName || ''
      this.globalData.crossNo = userInfo.crossNo || ''
    }
    this.userListeners.forEach(cb => {
      try { cb(this.globalData.userInfo) } catch (e) {}
    })
  },

  loadFonts() {
    try {
      wx.loadFontFace({
        family: 'Noto Serif SC',
        source: 'url("https://fonts.gstatic.com/s/notoserifsc/v21/H4chBXePl9DZ0Xe7gG9cyOjzokrKjDdNZg.woff2")',
        global: true,
        success() { console.log('Noto Serif SC 加载成功') },
        fail() { console.warn('Noto Serif SC 加载失败，使用系统字体') }
      })
      wx.loadFontFace({
        family: 'Ma Shan Zheng',
        source: 'url("https://fonts.gstatic.com/s/mashanzheng/v10/NaPecZTRCLxvwo41b4gvzkXaRME.woff2")',
        global: true,
        success() { console.log('Ma Shan Zheng 加载成功') },
        fail() { console.warn('Ma Shan Zheng 加载失败，使用系统字体') }
      })
    } catch (e) {
      console.warn('字体加载异常:', e.message)
    }
  },

  async initUser() {
    try {
      const userInfo = await ensureUser(this)
      if (userInfo) {
        console.log('✅ 用户初始化完成:', userInfo.nickName || '新用户')
        this.emitUserUpdate(userInfo)
      } else {
        console.warn('⚠️ 用户初始化失败，部分功能可能受限')
      }
    } catch (err) {
      console.error('initUser 异常:', err)
    }
  },

  async refreshUserQuietly() {
    try {
      const { ensureUser } = require('./utils/auth')
      const cached = this.globalData.userInfo
      this.globalData.userInfo = null
      this.globalData.openid = ''
      const fresh = await ensureUser(this)
      if (!fresh && cached) {
        this.emitUserUpdate(cached)
      }
    } catch (e) {}
  },

  preloadCommonData() {
    const { storage } = require('./utils/storage')
    const cachedFigures = storage.get('figures')
    const cachedDna = storage.get('dna_questions')
    if (cachedFigures) this.globalData.cache.figures = cachedFigures
    if (cachedDna) this.globalData.cache.dnaQuestions = cachedDna

    wx.cloud.callFunction({
      name: 'getUser',
      data: { action: 'warmup' }
    }).catch(() => {})
  },

  setCurrentTab(pageInst, idx) {
    this.globalData.currentTab = idx
    setTabBar(pageInst, idx)
  }
})
