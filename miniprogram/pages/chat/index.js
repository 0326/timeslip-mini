const { formatChatTime } = require('../../utils/date')
const chatSession = require('../../utils/chatSession')
const { QINGYUE } = require('../../utils/constants')
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
  },

  onPullDownRefresh() {
    this.loadSessions()
    wx.stopPullDownRefresh()
  },

  refreshLoginState() {
    const loggedIn = loginGuard.isLoggedIn()
    this.setData({ isLoggedIn: loggedIn })
    // 无论登录与否，都确保青月会话存在并展示
    chatSession.initQingyueSession()
    this.loadSessions()
  },

  loadSessions() {
    this.setData({ loading: false, loadError: false })
    const sessions = chatSession.getSessions()
    const processed = this.processSessions(sessions)
    this.setData({
      sessions: processed,
      filteredSessions: this.filterBySearch(processed, this.data.searchText)
    })
  },

  processSessions(list) {
    return list
      .map(s => {
        let lastMsg = s.lastMessage || ''
        lastMsg = lastMsg.split('\n')[0]
        if (lastMsg.length > 60) {
          lastMsg = lastMsg.slice(0, 60) + '...'
        }
        return {
          ...s,
          lastMessage: lastMsg,
          displayTime: formatChatTime(s.lastTime),
          fullName: s.figureTitle ? `${s.figureName} · ${s.figureTitle}` : s.figureName
        }
      })
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
    const { id, name } = e.currentTarget.dataset
    // 青月（系统引导）无需登录即可对话
    if (id !== QINGYUE.figureId && !this.data.isLoggedIn) {
      this.goLogin()
      return
    }
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
