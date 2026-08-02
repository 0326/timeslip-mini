const { requestCloud } = require('../../utils/cloudRequest')
const loginGuard = require('../../utils/loginGuard')

const app = getApp()

const TYPE_INTERVAL = 60
const TYPE_CHARS_PER_TICK = 3

Page({
  data: {
    statusBarHeight: 20,
    navHeight: 44,
    travelingLetters: [],
    arrivedLetters: [],
    unreadCount: 0,
    showDetail: false,
    detailLetter: null,
    // 逐字显示
    typedReply: '',
    typing: false,
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
    this.stopTyping()
  },

  onUnload() {
    this.clearCountdownLoop()
    this.stopTyping()
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/discover/index' }) })
  },

  goWrite() {
    wx.navigateTo({ url: '/pages/yan/index' })
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
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
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
        this.startTypeReply(data.reply && data.reply.content ? data.reply.content : '')
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

  // 逐字显示
  startTypeReply(fullText) {
    this.stopTyping()
    if (!fullText) {
      this.setData({ typedReply: '', typing: false })
      return
    }
    this.setData({ typedReply: '', typing: true })
    this._typeText = fullText
    this._typeIndex = 0
    this._typeTimer = setInterval(() => {
      this._typeIndex = Math.min(this._typeText.length, this._typeIndex + TYPE_CHARS_PER_TICK)
      this.setData({ typedReply: this._typeText.slice(0, this._typeIndex) })
      if (this._typeIndex >= this._typeText.length) {
        this.stopTyping()
      }
    }, TYPE_INTERVAL)
  },

  stopTyping() {
    if (this._typeTimer) {
      clearInterval(this._typeTimer)
      this._typeTimer = null
    }
    if (this._typeText) {
      // 若正在打字过程中停止，直接显示全部内容
      const full = this._typeText
      this._typeText = ''
      this.setData({ typedReply: full, typing: false })
    } else {
      this.setData({ typing: false })
    }
  },

  closeDetail() {
    this.stopTyping()
    this.setData({ showDetail: false, detailLetter: null, typedReply: '' })
  },

  // 继续通信（跳写信页，带 figureId）
  continueChat() {
    const d = this.data.detailLetter
    if (!d) return
    const figureId = encodeURIComponent(String(d.figureId || ''))
    const figureName = encodeURIComponent(String(d.figureName || ''))
    this.closeDetail()
    setTimeout(() => {
      wx.navigateTo({ url: '/pages/yan/index?figureId=' + figureId + '&figureName=' + figureName })
    }, 80)
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
        this.setData({ detailLetter, arrivedLetters })
      }
    } catch (e) {}
  },

  stopProp() {}
})
