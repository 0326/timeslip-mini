const { restoreFromCache } = require('./utils/auth')
const { setTabBar } = require('./utils/globalLogic')

App({
  globalData: {
    userInfo: null,
    openid: '',
    points: 0,
    memberLevel: '普通会员',
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

    // 仅从本地缓存恢复用户态，未登录时由 loginGuard 跳转到登录页
    restoreFromCache()
    this.preloadCommonData()
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
      this.globalData.crossNo = userInfo.crossNo || ''
    }
    this.userListeners.forEach(cb => {
      try { cb(this.globalData.userInfo) } catch (e) {}
    })
  },

  preloadCommonData() {
    const { storage } = require('./utils/storage')
    const cachedFigures = storage.get('figures')
    const cachedDna = storage.get('dna_questions')
    if (cachedFigures) this.globalData.cache.figures = cachedFigures
    if (cachedDna) this.globalData.cache.dnaQuestions = cachedDna
  },

  setCurrentTab(pageInst, idx) {
    this.globalData.currentTab = idx
    setTabBar(pageInst, idx)
  }
})
