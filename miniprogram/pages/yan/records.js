const { requestCloud } = require('../../utils/cloudRequest')
const loginGuard = require('../../utils/loginGuard')

const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    navHeight: 44,
    travelingLetters: [],
    arrivedLetters: [],
    unreadCount: 0,
    showDetail: false,
    detailLetter: null,
    loading: true
  },

  onLoad() {
    const sysInfo = app.globalData || {}
    const statusBarHeight = sysInfo.statusBarHeight || 20
    let navHeight = 44
    try {
      const menuBtn = wx.getMenuButtonBoundingClientRect()
      if (menuBtn && menuBtn.height) {
        navHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height
      }
    } catch (e) {}
    this.setData({ statusBarHeight, navHeight })
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
    this.loadLetters()
    this.startCountdownLoop()
  },

  onHide() {
    this.clearCountdownLoop()
  },

  onUnload() {
    this.clearCountdownLoop()
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/discover/index' }) })
  },

  async loadLetters() {
    if (this._loadingLetters) return
    this._loadingLetters = true
    try {
      const data = await requestCloud('yan', 'list', {}, { throwError: false })
      if (data) {
        const letters = data.letters || []
        const traveling = letters
          .filter(l => l.status === 'traveling' || l.status === 'processing')
          .map(l => ({
            ...l,
            sentAtText: this.formatTime(l.sentAt),
            remainText: this.formatCountdown(Math.max(0, l.arriveAt - Date.now())),
            progress: this.calcProgress(l)
          }))
        const arrived = letters
          .filter(l => l.status === 'arrived')
          .map(l => ({
            ...l,
            arrivedAtText: this.formatTime(l.arriveAt)
          }))
        this.setData({
          travelingLetters: traveling,
          arrivedLetters: arrived,
          unreadCount: data.unread || 0,
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      this.setData({ loading: false })
    } finally {
      this._loadingLetters = false
    }
  },

  formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const pad = n => (n < 10 ? '0' + n : n)
    return d.getMonth() + 1 + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  },

  calcProgress(l) {
    if (!l.arriveAt || !l.sentAt) return 0
    const now = Date.now()
    return Math.min(100, Math.round(((now - l.sentAt) / (l.arriveAt - l.sentAt)) * 100))
  },

  startCountdownLoop() {
    this.clearCountdownLoop()
    this._countdownTimer = setInterval(() => {
      if (this.data.travelingLetters.length === 0) return
      const now = Date.now()
      const updated = this.data.travelingLetters.map(l => {
        const remain = Math.max(0, l.arriveAt - now)
        const progress = l.arriveAt > l.sentAt ? Math.min(100, ((now - l.sentAt) / (l.arriveAt - l.sentAt)) * 100) : 100
        return Object.assign({}, l, { remainText: this.formatCountdown(remain), progress: Math.round(progress) })
      })
      this.setData({ travelingLetters: updated })
      const arrived = updated.filter(l => l.remainText === '已到达')
      if (arrived.length > 0) {
        this.loadLetters()
      }
    }, 1000)
  },

  clearCountdownLoop() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer)
      this._countdownTimer = null
    }
  },

  formatCountdown(ms) {
    if (ms <= 0) return '已到达'
    const s = Math.floor(ms / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0')
    if (m > 0) return m + ':' + String(sec).padStart(2, '0')
    return sec + '秒'
  },

  async viewLetter(e) {
    const id = e.currentTarget.dataset.id
    try {
      const data = await requestCloud('yan', 'detail', { letterId: id }, { throwError: false })
      if (data) {
        this.setData({ showDetail: true, detailLetter: data })
        if (data.status === 'arrived' && !data.read) {
          requestCloud('yan', 'read', { letterId: id }, { throwError: false })
          this.syncReadLocal(id)
        }
      }
    } catch (e) {}
  },

  syncReadLocal(letterId) {
    const arrivedLetters = this.data.arrivedLetters.map(l =>
      l._id === letterId ? Object.assign({}, l, { read: true }) : l
    )
    const unreadCount = arrivedLetters.filter(l => !l.read).length
    this.setData({ arrivedLetters, unreadCount })
  },

  closeDetail() {
    this.setData({ showDetail: false, detailLetter: null })
  },

  async claimGift(e) {
    const id = e.currentTarget.dataset.id
    try {
      const data = await requestCloud('yan', 'claim', { letterId: id }, { showLoading: true, loadingText: '收入藏馆...' })
      if (data) {
        wx.showToast({ title: '已收入藏馆', icon: 'success' })
        const detailLetter = this.data.detailLetter
          ? Object.assign({}, this.data.detailLetter, { claimed: true })
          : null
        const arrivedLetters = this.data.arrivedLetters.map(l =>
          l._id === id ? Object.assign({}, l, { claimed: true }) : l
        )
        this.setData({ showDetail: false, detailLetter, arrivedLetters })
      }
    } catch (e) {}
  },

  stopProp() {}
})
