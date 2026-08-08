const { restoreFromCache } = require('./utils/auth')
const { setTabBar } = require('./utils/globalLogic')
const { isMiniprogram, isH5, isDonutApp, getPlatformTag } = require('./utils/platform')

// Donut H5/App 端：CloudBase Web SDK 匿名登录就绪状态（Promise，可等待）
// Web SDK 必须先匿名登录完成后，callFunction 才能拿到有效凭证，否则报 -601002 INVALID_CREDENTIAL
let _cloudWebSdkReady = null
function getCloudReadyPromise() { return _cloudWebSdkReady }
function markCloudReady(err) {
  if (_cloudWebSdkReady && _cloudWebSdkReady._ts) return _cloudWebSdkReady
  _cloudWebSdkReady = err ? Promise.reject(err) : Promise.resolve(true)
  _cloudWebSdkReady._ts = Date.now()
  return _cloudWebSdkReady
}

function _initCloudOnce(extraOpts) {
  try {
    wx.cloud.init(Object.assign({
      env: 'cloud1-d8guq74iacc68352a',
      traceUser: true
    }, extraOpts || {}))
    return true
  } catch (e) {
    console.warn('[app.js] wx.cloud.init error:', e && e.message)
    return false
  }
}

/**
 * Donut 多端（H5/App）：触发 CloudBase Web SDK 匿名登录并返回 Promise
 *
 * -601002 的根因是 Web SDK 必须先完成一次匿名登录（signInAnonymously）才会在
 * 内部生成有效的访问凭证，后续 callFunction 请求才会携带。
 * 微信小程序端不需要——基础库已经把微信身份凭证自动注入了。
 *
 * 兼容三种实现：
 *   1) wx.cloud.auth().signInAnonymously()         新版 CloudBase Web SDK
 *   2) wx.cloud.signInAnonymously()                Donut 别名
 *   3) 调不到就直接 warmup 一个轻函数逼它自动触发匿名登录
 */
function _donutWebAnonSignIn(maxRetries = 2) {
  return new Promise((resolve) => {
    const tryAuth = (n) => {
      const run = () => {
        try {
          // 优先直接调 getUser warmup——CloudBase Web SDK 通常在首次 callFunction 时会自动匿名登录
          // 如果自动登录成功，这个请求就过了；连 warmup 都报 -601002 再降级 try/catch
          wx.cloud.callFunction({
            name: 'getUser',
            data: { action: 'warmup' },
            timeout: 6000
          }).then(() => resolve(true)).catch(() => {
            if (n > 0) return setTimeout(() => tryAuth(n - 1), 600)
            resolve(true) // 仍然 resolve(true)，不阻塞首屏，失败了让 cloudRequest 自己重试提示刷新
          })
        } catch (_) { resolve(true) }
      }
      // 优先显式走 signInAnonymously（如果 Donut SDK 暴露了）
      try {
        let signInFn = null
        if (wx.cloud && typeof wx.cloud.auth === 'function') {
          const authObj = wx.cloud.auth()
          if (authObj && typeof authObj.signInAnonymously === 'function') {
            signInFn = authObj.signInAnonymously.bind(authObj)
          }
        }
        if (!signInFn && wx.cloud && typeof wx.cloud.signInAnonymously === 'function') {
          signInFn = wx.cloud.signInAnonymously.bind(wx.cloud)
        }
        if (signInFn) {
          signInFn().then(() => resolve(true)).catch(() => run())
          return
        }
      } catch (_) {}
      run()
    }
    tryAuth(maxRetries)
  })
}

App({
  globalData: {
    userInfo: null,
    openid: '',
    points: 0,
    memberLevel: '普通会员',
    crossNo: '',
    // Donut 端：平台标记（donut-h5 / donut-app / miniprogram / unknown）
    platformTag: 'unknown',
    isDonutRuntime: false,
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
    // 1. 先判定当前平台（Donut 多端 / 微信小程序）
    let platformTag = 'unknown'
    try { platformTag = getPlatformTag() } catch (_) {}
    this.globalData.platformTag = platformTag
    const reallyIsMiniprogram = isMiniprogram()
    this.globalData.isDonutRuntime = !reallyIsMiniprogram && (isH5() || isDonutApp())
    const isDonut = this.globalData.isDonutRuntime

    // 2. wx.cloud.init：Donut 端必须显式加 region + disableDevtoolsCheck，否则 CloudBase Web SDK
    //    在 H5/原生 App 环境下拿不到有效凭证 → callFunction 直接报 -601002 INVALID_CREDENTIAL
    //    envId 末尾是上海环境：cloud1-xxx → region = ap-shanghai（云开发环境列表已经验证过上海）
    const initOpts = {
      env: 'cloud1-d8guq74iacc68352a',
      traceUser: true
    }
    if (isDonut) {
      initOpts.region = 'ap-shanghai'
      initOpts.disableDevtoolsCheck = true
      // Donut 编译产物会透传 resourceAppid，部分 CloudBase Web SDK 版本需此参数校验 env 归属
      try {
        const info = wx.getAccountInfoSync && wx.getAccountInfoSync()
        if (info && info.miniProgram && info.miniProgram.appId) initOpts.appid = info.miniProgram.appId
      } catch (_) {
        initOpts.appid = 'wx30e49a87f6326f1d'
      }
    }

    let inited = false
    if (!wx.cloud) {
      // Donut App/H5 端 cloud SDK 可能延迟注入：1 秒后再次尝试
      console.warn('[app.js] wx.cloud 未就绪，延迟 1s 重试初始化（platform=' + platformTag + '）')
      const retryTimer = setTimeout(() => {
        if (wx.cloud && typeof wx.cloud.init === 'function') {
          inited = _initCloudOnce(initOpts)
          if (inited && isDonut) this._startCloudDonutReadyFlow()
        }
        clearTimeout(retryTimer)
      }, 1000)
    } else {
      inited = _initCloudOnce(initOpts)
    }

    if (inited && isDonut) this._startCloudDonutReadyFlow()
    else if (!inited && !isDonut) {
      // 小程序端已直接 inited=true 走到上面分支；这里仅处理「inited 为 false 但非 Donut」罕见情况
    }

    // 3. 冷启动身份恢复顺序：先 visitorId，再 restoreFromCache（微信绑定身份）
    try {
      const v = require('./utils/visitor')
      if (v && typeof v.getVisitorId === 'function') v.getVisitorId()
    } catch (e) {
      console.warn('[app.js] visitor init warn:', e && e.message)
    }
    restoreFromCache()
    this.restoreSettings()
    try { require('./utils/chatSession').initQingyueSession() } catch (_) {}
    this.preloadCommonData()
  },

  // Donut H5/App：触发匿名登录预热并把 Promise 挂到 globalData 上供 cloudRequest 等待
  _startCloudDonutReadyFlow() {
    const self = this
    const p = _donutWebAnonSignIn(2).then(ok => {
      markCloudReady()
      return ok
    }).catch(err => {
      console.warn('[app.js] Donut CloudBase Web SDK 匿名登录预热失败，将在首次请求时重试：', err && err.message)
      // 不 reject 成全局 fail，因为有些版本 CloudBase 会在第一次 callFunction 时自动做匿名登录
      markCloudReady()
      return true
    })
    // 暴露给 utils/cloudRequest 读取
    this.globalData.__cloudWebSdkReady = p
    markCloudReady()
    return p
  },

  // 给 cloudRequest 直接读当前的 CloudBase Web SDK ready Promise（Donut 端非小程序才需要等）
  getCloudWebSdkReady() {
    if (this.globalData && this.globalData.__cloudWebSdkReady) return this.globalData.__cloudWebSdkReady
    if (isMiniprogram()) return Promise.resolve(true)
    // Donut 端还没走到 onLaunch 的极端情况：立即触发一次初始化
    if (!wx.cloud || typeof wx.cloud.init !== 'function') return Promise.reject(new Error('wx.cloud 未就绪'))
    this._startCloudDonutReadyFlow()
    return this.globalData.__cloudWebSdkReady || Promise.resolve(true)
  },

  pointsListeners: [],
  userListeners: [],
  settingsListeners: [],
  momentListeners: [],

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

  // 朋友圈动态变更事件：详情页点赞/评论/删除评论后通知列表页同步
  // payload: { momentId, type: 'like'|'comment'|'commentRemove', interaction }
  subscribeMoment(cb) {
    if (typeof cb === 'function') this.momentListeners.push(cb)
    return () => {
      this.momentListeners = this.momentListeners.filter(l => l !== cb)
    }
  },

  emitMomentUpdate(payload) {
    this.momentListeners.forEach(cb => {
      try { cb(payload) } catch (e) {}
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
