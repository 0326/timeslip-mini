const { ensureUser } = require('./utils/auth')

App({
  globalData: {
    userInfo: null,
    openid: '',
    points: 0,
    memberLevel: '普通会员'
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }

    wx.cloud.init({
      env: 'cloud1-d0gunpzup215cfd87',
      traceUser: true
    })

    this.initUser()
  },

  pointsListeners: [],

  subscribePoints(cb) {
    this.pointsListeners.push(cb)
    return () => {
      this.pointsListeners = this.pointsListeners.filter(l => l !== cb)
    }
  },

  emitPointsUpdate(points) {
    this.globalData.points = points
    this.pointsListeners.forEach(cb => cb(points))
  },

  async initUser() {
    const userInfo = await ensureUser(this)
    if (userInfo) {
      console.log('✅ 用户初始化完成:', userInfo.nickName || '新用户', '积分:', userInfo.points || 0)
      this.emitPointsUpdate(userInfo.points || 0)
    } else {
      console.warn('⚠️ 用户初始化失败，部分功能可能受限')
    }
  }
})
