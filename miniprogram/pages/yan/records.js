const { requestCloud } = require('../../utils/cloudRequest')
const { patchListForDisplay, patchAuthorForDisplay } = require('../../utils/publicIdentity')

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
    replyContent: '',
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
        const traveling = patchListForDisplay(letters
          .filter(l => l.status === 'traveling' || l.status === 'processing' || l.status === 'returned')
          .map(l => ({
            ...l,
            isRandomDrift: l.deliveryMode === 'random',
            isReturned: l.status === 'returned',
            sentAtText: this.formatTime(l.sentAt),
            remainText: l.status === 'returned' ? '已返回，点击查看' : this.formatCountdown(Math.max(0, l.arriveAt - Date.now())),
            progress: l.status === 'returned' ? 100 : this.calcProgress(l)
          })))
        const arrived = patchListForDisplay(letters
          .filter(l => l.status === 'arrived')
          .map(l => ({
            ...l,
            arrivedAtText: this.formatTime(l.arriveAt)
          })))
        this.setData({
          travelingLetters: traveling,
          arrivedLetters: arrived,
          unreadCount: data.unread || 0,
          loading: false
        })
      } else {
        this.setData({ travelingLetters: [], arrivedLetters: [], unreadCount: 0, loading: false })
      }
    } catch (e) {
      this.setData({ travelingLetters: [], arrivedLetters: [], unreadCount: 0, loading: false })
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
    const duration = l.arriveAt - l.sentAt
    if (duration <= 0) return 100
    const now = Date.now()
    return Math.max(0, Math.min(100, Math.round(((now - l.sentAt) / duration) * 100)))
  },

  startCountdownLoop() {
    this.clearCountdownLoop()
    this._countdownTimer = setInterval(() => {
      if (this.data.travelingLetters.length === 0) return
      const now = Date.now()
      const updated = patchListForDisplay(this.data.travelingLetters.map(l => {
        if (l.isReturned) return l
        const remain = Math.max(0, l.arriveAt - now)
        const progress = l.arriveAt > l.sentAt ? Math.min(100, ((now - l.sentAt) / (l.arriveAt - l.sentAt)) * 100) : 100
        return Object.assign({}, l, { remainText: this.formatCountdown(remain), progress: Math.round(progress) })
      }))
      this.setData({ travelingLetters: updated })
      const arrived = updated.filter(l => !l.isReturned && l.remainText === '已到达')
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
        var replyContent = ''
        if (data.reply && data.reply.content) {
          replyContent = this.trimReplyContent(data.reply.content)
        }
        this.setData({ showDetail: true, detailLetter: Object.assign({}, data, patchAuthorForDisplay(data)), replyContent: replyContent })
        if (data.status === 'returned' || (data.status === 'arrived' && !data.read)) {
          await requestCloud('yan', 'read', { letterId: id }, { throwError: false })
          await this.loadLetters()
          const updated = Object.assign({}, data, { status: 'arrived', read: true, claimed: data.gift ? true : data.claimed })
          this.setData({ detailLetter: Object.assign({}, updated, patchAuthorForDisplay(updated)) })
        }
      }
    } catch (e) {}
  },

  // 去掉开头"古代贤人启"和结尾"拜复"等格式语
  trimReplyContent(text) {
    if (!text) return ''
    var t = text.replace(/^[\s]*古代贤人启[：:]*[\s]*/, '')
    t = t.replace(/[\s]*古代贤人\s*顿首拜复[\s。]*$/, '')
    t = t.replace(/[\s]*古代贤人\s*拜复[\s。]*$/, '')
    t = t.replace(/[\s]*顿首拜复[\s。]*$/, '')
    t = t.replace(/[\s]*拜复[\s。]*$/, '')
    return t.trim()
  },

  syncReadLocal(letterId) {
    const arrivedLetters = patchListForDisplay(this.data.arrivedLetters.map(l =>
      l._id === letterId ? Object.assign({}, l, { read: true }) : l
    ))
    const unreadCount = arrivedLetters.filter(l => !l.read).length
    this.setData({ arrivedLetters, unreadCount })
  },

  closeDetail() {
    this.setData({ showDetail: false, detailLetter: null, replyContent: '' })
  },

  // 继续回信（跳写信页，带 figureId）
  continueChat() {
    const d = this.data.detailLetter
    if (!d) return
    const figureId = encodeURIComponent(String(d.figureId || ''))
    const figureName = encodeURIComponent(String(d.figureName || ''))
    this.closeDetail()
    setTimeout(function() {
      wx.navigateTo({ url: '/pages/yan/index?figureId=' + figureId + '&figureName=' + figureName })
    }, 80)
  },

  goCollection() {
    this.closeDetail()
    setTimeout(function() {
      wx.navigateTo({ url: '/pages/yan/collection' })
    }, 80)
  },

  stopProp() {}
})
