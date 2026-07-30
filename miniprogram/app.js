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
    currentTab: 0,
    settings: {
      bigFont: false,
      themeName: '古纸原风',
      notifyEnabled: true,
      vibrationEnabled: true
    },
    // P1：青月异步消息跟踪
    agentPromises: {},   // key: figureId → 进行中的 send promise
    activePages: {}      // key: "chat/room:<figureId>" → true
  },

  tabList: [
    { pagePath: 'pages/chat/index', name: '穿越', icon: '💬' },
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
    // 同步本地 app_settings 到 globalData
    this.restoreSettings()
    // 确保青月（系统引导）会话存在
    require('./utils/chatSession').initQingyueSession()
    this.preloadCommonData()
  },

  pointsListeners: [],
  userListeners: [],
  settingsListeners: [],

  restoreSettings() {
    try {
      const { storage } = require('./utils/storage')
      const saved = storage.get('app_settings')
      if (saved && typeof saved === 'object') {
        if (typeof saved.bigFont === 'boolean') this.globalData.settings.bigFont = saved.bigFont
        if (typeof saved.themeName === 'string') this.globalData.settings.themeName = saved.themeName
        if (typeof saved.notifyEnabled === 'boolean') this.globalData.settings.notifyEnabled = saved.notifyEnabled
        if (typeof saved.vibrationEnabled === 'boolean') this.globalData.settings.vibrationEnabled = saved.vibrationEnabled
      }
    } catch (e) {
      console.error('restoreSettings error:', e)
    }
  },

  applySettings(settings) {
    if (!settings || typeof settings !== 'object') return
    const s = this.globalData.settings
    if (typeof settings.bigFont === 'boolean') s.bigFont = settings.bigFont
    if (typeof settings.themeName === 'string') s.themeName = settings.themeName
    if (typeof settings.notifyEnabled === 'boolean') s.notifyEnabled = settings.notifyEnabled
    if (typeof settings.vibrationEnabled === 'boolean') s.vibrationEnabled = settings.vibrationEnabled
    try {
      const { storage } = require('./utils/storage')
      storage.set('app_settings', {
        notifyEnabled: s.notifyEnabled,
        vibrationEnabled: s.vibrationEnabled,
        bigFont: s.bigFont,
        theme: s.themeName
      }, 86400 * 365)
    } catch (e) {
      console.error('applySettings persist error:', e)
    }
    this.emitSettingsUpdate(s)
  },

  subscribeSettings(cb) {
    if (typeof cb === 'function') this.settingsListeners.push(cb)
    return () => {
      this.settingsListeners = this.settingsListeners.filter(l => l !== cb)
    }
  },

  emitSettingsUpdate(settings) {
    this.settingsListeners.forEach(cb => {
      try { cb(settings) } catch (e) {}
    })
  },

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
    // 统一使用带版本的缓存键，避免裸键被历史脏数据污染
    const cachedFigures = storage.get('figures_common_v1')
    const cachedDna = storage.get('dna_questions_v1')
    if (cachedFigures) this.globalData.cache.figures = cachedFigures
    if (cachedDna) this.globalData.cache.dnaQuestions = cachedDna
  },

  setCurrentTab(pageInst, idx) {
    this.globalData.currentTab = idx
    setTabBar(pageInst, idx)
  },

  // P1：青月异步消息页面跟踪
  setActivePage(page, figureId) {
    this.globalData.activePages[`${page}:${figureId}`] = true
  },

  clearActivePage(page, figureId) {
    delete this.globalData.activePages[`${page}:${figureId}`]
  },

  isPageActive(page, figureId) {
    return !!this.globalData.activePages[`${page}:${figureId}`]
  },

  getAgentPromise(figureId) {
    return this.globalData.agentPromises[figureId] || null
  },

  setAgentPromise(figureId, promise) {
    this.globalData.agentPromises[figureId] = promise
    if (promise && typeof promise.finally === 'function') {
      promise.finally(() => {
        if (this.globalData.agentPromises[figureId] === promise) {
          delete this.globalData.agentPromises[figureId]
        }
      })
    }
  }
})
