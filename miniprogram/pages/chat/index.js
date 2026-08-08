const { formatChatTime } = require('../../utils/date')
const chatSession = require('../../utils/chatSession')
const { QINGYUE } = require('../../utils/constants')
const { storage } = require('../../utils/storage')
const { requestCloud } = require('../../utils/cloudRequest')
const loginGuard = require('../../utils/loginGuard')
const { patchListForDisplay, patchAuthorForDisplay } = require('../../utils/publicIdentity')

const FIGURES_CACHE_KEY = 'figures_star5_v5'
const FIGURE_DETAIL_PREFIX = 'figure_v2_'

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
    // P1：青月异步消息同步（处理用户离开房间后 Agent 完成场景）
    this.syncQingyueSession()
    // P1：监听进行中的青月 promise，完成时实时刷新列表（无需切页面再切回）
    this.watchQingyuePromise()
  },

  // P1：监听进行中的青月 promise，完成时刷新列表
  // Promise 支持多个 then，room.js 的 then 和这里的 then 都会执行
  watchQingyuePromise() {
    const app = getApp()
    const promise = app.getAgentPromise(QINGYUE.figureId)
    if (!promise) return
    // 避免重复挂载
    if (this._qingyueWatched === promise) return
    this._qingyueWatched = promise
    promise
      .then(() => {
        this._qingyueWatched = null
        this.loadSessions()
      })
      .catch(() => {
        this._qingyueWatched = null
        this.loadSessions()
      })
  },

  // P1：同步云端青月会话状态到本地（processing/failed/unread/lastMessage）
  async syncQingyueSession() {
    try {
      const cloud = await requestCloud('qingyue-agent', 'syncSessions', {}, { throwError: false })
      if (cloud) {
        chatSession.applyCloudSession(QINGYUE.figureId, cloud)
        // 本地列表立即刷新
        this.loadSessions()
      }
    } catch (e) {
      // 静默失败，本地列表照常显示
    }
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
    let sessions = chatSession.getSessions()
    // 从人物缓存刷新头像，防止旧缓存头像失效
    sessions = this.refreshAvatars(sessions)
    const processed = patchListForDisplay(this.processSessions(sessions))
    this.setData({
      sessions: processed,
      filteredSessions: patchListForDisplay(this.filterBySearch(processed, this.data.searchText))
    })
  },

  // 从兰台人物列表 / 人物详情缓存中获取最新头像
  refreshAvatars(sessions) {
    const figuresList = storage.get(FIGURES_CACHE_KEY) || []
    const figureMap = {}
    figuresList.forEach(f => {
      const id = f._id || f.id || f.figureId
      if (id && f.avatar) figureMap[id] = f.avatar
    })
    let updated = false
    const result = sessions.map(s => {
      if (s.isSystem) return s // 青月由 initQingyueSession 保证
      let avatar = figureMap[s.figureId]
      if (!avatar) {
        // 尝试从人物详情缓存获取
        const detail = storage.get(FIGURE_DETAIL_PREFIX + s.figureId)
        if (detail && detail.avatar) avatar = detail.avatar
      }
      if (avatar && avatar !== s.avatar) {
        updated = true
        return { ...s, avatar }
      }
      return s
    })
    if (updated) chatSession.saveSessions(result)
    return result
  },

  processSessions(list) {
    return list
      .map(s => {
        let lastMsg = s.lastMessage || ''
        lastMsg = lastMsg.split('\n')[0]
        if (lastMsg.length > 60) {
          lastMsg = lastMsg.slice(0, 60) + '...'
        }
        // P1：processing 状态显示"对方正在输入..."
        if (s.status === 'processing') {
          lastMsg = '对方正在输入...'
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
      filteredSessions: patchListForDisplay(this.filterBySearch(this.data.sessions, keyword))
    })
  },

  onClearSearch() {
    this.setData({ searchText: '', filteredSessions: patchListForDisplay(this.data.sessions) })
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
