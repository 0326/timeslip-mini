const { requestCloud } = require('../../utils/cloudRequest')
const { formatChatTime } = require('../../utils/date')
const { storage } = require('../../utils/storage')
const loginGuard = require('../../utils/loginGuard')

Page({
  data: {
    sessions: [],
    loading: true,
    searchText: '',
    filteredSessions: [],
    loadError: false,
    isLoggedIn: false
  },

  onLoad() {
    this.refreshLoginState()
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 0)
    this.refreshLoginState()
    if (this.data.isLoggedIn && !this.data.loading) this.loadSessions()
  },

  onPullDownRefresh() {
    if (this.data.isLoggedIn) {
      this.loadSessions(true)
    } else {
      wx.stopPullDownRefresh()
    }
  },

  refreshLoginState() {
    const loggedIn = loginGuard.isLoggedIn()
    this.setData({ isLoggedIn: loggedIn })
    if (loggedIn) {
      this.loadSessions()
    } else {
      this.setData({ sessions: [], filteredSessions: [], loading: false, loadError: false })
    }
  },

  async loadSessions(forceRefresh = false) {
    this.setData({ loading: true, loadError: false })
    try {
      const cached = !forceRefresh ? storage.get('chat_sessions') : null
      if (cached && cached.length) {
        const processed = this.processSessions(cached)
        this.setData({
          sessions: processed,
          filteredSessions: this.filterBySearch(processed, this.data.searchText)
        })
      }

      const data = await requestCloud('chat', 'listSessions', {}, { throwError: false })
      const sessions = (data && data.sessions) || []
      if (sessions.length) storage.set('chat_sessions', sessions, 1800)
      const processed = this.processSessions(sessions)
      this.setData({
        sessions: processed,
        filteredSessions: this.filterBySearch(processed, this.data.searchText),
        loading: false
      })
    } catch (e) {
      this.setData({
        sessions: [],
        filteredSessions: [],
        loading: false,
        loadError: true
      })
    }
    wx.stopPullDownRefresh()
  },

  processSessions(list) {
    return list
      .map(s => ({
        ...s,
        displayTime: formatChatTime(s.lastTime),
        fullName: s.figureTitle ? `${s.figureName} · ${s.figureTitle}` : s.figureName
      }))
      .sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0))
  },

  filterBySearch(list, keyword) {
    if (!keyword) return list
    const kw = keyword.toLowerCase()
    return list.filter(s =>
      (s.figureName || '').toLowerCase().includes(kw) ||
      (s.figureTitle || '').toLowerCase().includes(kw) ||
      (s.lastMessage || '').toLowerCase().includes(kw)
    )
  },

  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({
      searchText: keyword,
      filteredSessions: this.filterBySearch(this.data.sessions, keyword)
    })
  },

  onClearSearch() {
    this.setData({ searchText: '', filteredSessions: this.data.sessions })
  },

  openRoom(e) {
    if (!this.data.isLoggedIn) {
      this.goLogin()
      return
    }
    const { id, name } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/chat/room?figureId=${id}&figureName=${encodeURIComponent(name || '')}`
    })
  },

  openSearch() {
    wx.showToast({ title: '搜索历史人物', icon: 'none' })
  },

  goToLantai() {
    wx.switchTab({ url: '/pages/lantai/index' })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index' })
  }
})
