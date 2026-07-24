const { requestCloud } = require('../../utils/cloudRequest')
const { formatChatTime } = require('../../utils/date')
const { storage } = require('../../utils/storage')

const MOCK_FIGURES = [
  { figureId: 'simaqian', figureName: '司马迁', figureTitle: '太史公', dynasty: 'han', lastMessage: '太史公曰：网罗天下放失旧闻，考之行事，稽其成败兴坏之纪...', unreadCount: 2, avatar: 'https://img.icons8.com/color/96/emperor.png' },
  { figureId: 'libang', figureName: '刘邦', figureTitle: '汉高祖', dynasty: 'han', lastMessage: '大丈夫生当如此啊！', unreadCount: 0, avatar: 'https://img.icons8.com/color/96/king.png' },
  { figureId: 'simaqian', figureName: '李白', figureTitle: '诗仙', dynasty: 'tang', lastMessage: '人生得意须尽欢，莫使金樽空对月！', unreadCount: 5, avatar: 'https://img.icons8.com/color/96/poet.png' },
  { figureId: 'sushi', figureName: '苏轼', figureTitle: '东坡居士', dynasty: 'song', lastMessage: '竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。', unreadCount: 0, avatar: 'https://img.icons8.com/color/96/writer.png' },
  { figureId: 'zhugeliang', figureName: '诸葛亮', figureTitle: '武乡侯', dynasty: 'sanguo', lastMessage: '鞠躬尽瘁，死而后已。', unreadCount: 1, avatar: 'https://img.icons8.com/color/96/general.png' },
  { figureId: 'wuzetian', figureName: '武则天', figureTitle: '则天大圣皇帝', dynasty: 'tang', lastMessage: '朕今日得一佳句，卿可赏鉴。', unreadCount: 0, avatar: 'https://img.icons8.com/color/96/queen.png' },
  { figureId: 'hanwu', figureName: '刘彻', figureTitle: '汉武帝', dynasty: 'han', lastMessage: '寇可往，我亦可往！', unreadCount: 0, avatar: 'https://img.icons8.com/color/96/king.png' },
  { figureId: 'yuefei', figureName: '岳飞', figureTitle: '岳武穆', dynasty: 'song', lastMessage: '靖康耻，犹未雪；臣子恨，何时灭！', unreadCount: 3, avatar: 'https://img.icons8.com/color/96/samurai.png' }
]

Page({
  data: {
    sessions: [],
    loading: true,
    searchText: '',
    filteredSessions: []
  },

  onLoad() {
    this.loadSessions()
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 0)
    this.loadSessions()
  },

  onPullDownRefresh() {
    this.loadSessions(true)
  },

  async loadSessions(forceRefresh = false) {
    try {
      const cached = !forceRefresh ? storage.get('chat_sessions') : null
      if (cached && cached.length) {
        this.setData({
          sessions: this.processSessions(cached),
          filteredSessions: this.processSessions(cached)
        })
      }

      const data = await requestCloud('chat', 'listSessions', {}, { throwError: false })
      const sessions = (data && data.sessions) || MOCK_FIGURES.map(f => ({
        ...f,
        lastTime: Date.now() - Math.floor(Math.random() * 86400000 * 7)
      }))
      storage.set('chat_sessions', sessions, 1800)
      const processed = this.processSessions(sessions)
      this.setData({
        sessions: processed,
        filteredSessions: this.filterBySearch(processed, this.data.searchText),
        loading: false
      })
    } catch (e) {
      const fallback = MOCK_FIGURES.map(f => ({
        ...f,
        lastTime: Date.now() - Math.floor(Math.random() * 86400000 * 7)
      }))
      const processed = this.processSessions(fallback)
      this.setData({
        sessions: processed,
        filteredSessions: processed,
        loading: false
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
  }
})
