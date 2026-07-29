const { requestCloud } = require('../../utils/cloudRequest')
const chatSession = require('../../utils/chatSession')
const { AI_CONFIG, QINGYUE } = require('../../utils/constants')
const { storage } = require('../../utils/storage')
const { uid, sleep, resolveAvatarUrl } = require('../../utils/helpers')
const loginGuard = require('../../utils/loginGuard')

Page({
  data: {
    figureId: '',
    figureName: '',
    navTitle: '',
    figureTitle: '',
    avatar: '',
    userAvatar: '/images/icons/avatar.png',
    userName: '',
    isSystem: false,
    messages: [],
    inputValue: '',
    inputText: '',
    sending: false,
    scrollTop: 0,
    scrollTo: '',
    aiTyping: false,
    chatStatus: 0,
    showTools: false,
    manualScroll: false
  },

  onLoad(options) {
    const figureId = options.figureId || QINGYUE.figureId
    const figureName = decodeURIComponent(options.figureName || QINGYUE.name)
    const [name, title] = figureName.split(' · ')

    const isSystem = figureId === QINGYUE.figureId
    let avatar = isSystem ? QINGYUE.avatar : ''
    if (!avatar) {
      avatar = this.resolveFigureAvatar(figureId)
    }

    const userInfo = this.getUserInfo()

    this.setData({
      figureId,
      figureName: name,
      navTitle: name,
      figureTitle: title || '',
      avatar,
      userName: userInfo.nickName || '',
      isSystem
    })

    this.loadUserAvatar(userInfo)
    wx.setNavigationBarTitle({ title: name })

    // 确保青月会话与欢迎消息存在
    if (isSystem) chatSession.initQingyueSession()
    this.loadHistory()
  },

  onShow() {
    // 青月（系统引导）无需登录
    if (!this.data.isSystem && !loginGuard.checkLogin(this)) return
    const app = getApp()
    app.setCurrentTab(this, 0)
    const userInfo = this.getUserInfo()
    this.setData({
      userName: userInfo.nickName || ''
    })
    this.loadUserAvatar(userInfo)
    // 进入房间清除未读
    chatSession.clearUnread(this.data.figureId)
  },

  async loadUserAvatar(userInfo) {
    var self = this
    userInfo = userInfo || this.getUserInfo()
    if (userInfo && userInfo.avatarUrl) {
      const url = await resolveAvatarUrl(userInfo.avatarUrl)
      self.setData({ userAvatar: url })
    } else {
      self.setData({ userAvatar: '/images/icons/avatar.png' })
    }
  },

  getUserInfo() {
    const app = getApp()
    return (app.globalData && app.globalData.userInfo) || storage.get('userInfo') || storage.get('user_info') || {}
  },

  // 从兰台人物列表 / 详情缓存中解析角色头像
  resolveFigureAvatar(figureId) {
    // 1. 人物列表缓存
    const figuresList = storage.get('figures_star5_v4') || []
    const fig = figuresList.find(f => (f._id || f.id || f.figureId) === figureId)
    if (fig && fig.avatar) return fig.avatar
    // 2. 人物详情缓存
    const detail = storage.get('figure_v2_' + figureId)
    if (detail && detail.avatar) return detail.avatar
    // 3. 旧版缓存
    const old = storage.get('figure_' + figureId)
    if (old && old.avatar) return old.avatar
    return ''
  },

  async loadHistory() {
    const localMessages = chatSession.getMessages(this.data.figureId)
    if (localMessages.length || this.data.isSystem) {
      this.setData({ messages: localMessages })
      this.scrollToBottom()
      return
    }

    const cloudMessages = await requestCloud('chat', 'history', {
      figureId: this.data.figureId,
      limit: 50
    }, { throwError: false })
    if (Array.isArray(cloudMessages) && cloudMessages.length) {
      const messages = cloudMessages.map(message => ({
        ...message,
        role: message.role === 'assistant' ? 'figure' : message.role,
        createdAt: message.createdAt ? new Date(message.createdAt).getTime() : Date.now()
      }))
      chatSession.saveMessages(this.data.figureId, messages)
      this.setData({ messages })
    } else {
      this.setData({ messages: [] })
    }
    this.scrollToBottom()
  },

  scrollToBottom() {
    const messages = this.data.messages
    if (!messages.length) return
    setTimeout(() => {
      this.setData({ scrollTo: 'msg-' + messages[messages.length - 1]._id })
    }, 50)
  },

  bindKeyInput(e) {
    this.setData({ inputValue: e.detail.value, inputText: e.detail.value })
  },

  bindInputFocus() {
    this.setData({ showTools: false })
  },

  toggleTools() {
    this.setData({ showTools: !this.data.showTools })
  },

  onClearChat() {
    wx.showModal({
      title: '提示',
      content: '确定要清除全部对话记录吗？',
      success: async (res) => {
        if (res.confirm) {
          chatSession.clearMessages(this.data.figureId)
          chatSession.bumpSession(this.data.figureId, '', Date.now())
          this.setData({ messages: [], showTools: false })
          // 青月：同步清云端消息 + 重置 Agent session
          if (this.data.isSystem) {
            await requestCloud('qingyue-agent', 'clearSession', {}, { throwError: false })
          }
        }
      }
    })
  },

  onStopGen() {
    // P0：青月已改为云函数同步调用，停止按钮仅重置 UI 状态
    this.setChatProcessing(false)
  },

  onScrollMsg(e) {
    const { scrollTop } = e.detail
    if (scrollTop < (this._lastScrollTop || 0) - 20) {
      if (!this.data.manualScroll) this.setData({ manualScroll: true })
    }
    this._lastScrollTop = scrollTop
  },

  autoToBottom() {
    this.setData({ manualScroll: false })
    this.scrollToBottom()
  },

  async onSend() {
    const text = (this.data.inputValue || '').trim()
    if (!text || this.data.sending) return
    if (text.length > AI_CONFIG.chatMaxLength) {
      wx.showToast({ title: `最多${AI_CONFIG.chatMaxLength}字`, icon: 'none' })
      return
    }

    this.sendText(text)
  },

  async sendText(text) {

    const now = Date.now()
    const userMsg = {
      _id: uid('u_'),
      role: 'user',
      content: text,
      createdAt: now
    }
    const messages = this.data.messages.concat([userMsg])
    this.setData({
      messages,
      inputValue: '',
      inputText: '',
      sending: true,
      aiTyping: true,
      chatStatus: 1,
      navTitle: '对方正在输入中...',
      manualScroll: false
    })
    wx.setNavigationBarTitle({ title: '对方正在输入中...' })
    this.scrollToBottom()
    this.persistMessages(messages)
    this.bumpSession(text, now)

    try {
      let aiContent
      if (this.data.isSystem) {
        // 青月走 qingyue-agent 代理云函数（服务端管理 agentSessionId + ACP 调用 + SSE 解析 + 落库）
        const data = await requestCloud('qingyue-agent', 'send', { text }, { throwError: true })
        aiContent = data && data.aiMsg && data.aiMsg.content
        if (!aiContent) throw new Error('AGENT_EMPTY_RESPONSE')
      } else {
        await sleep(300)
        const data = await requestCloud('chat', 'send', {
          figureId: this.data.figureId,
          figureName: this.data.figureName,
          figureTitle: this.data.figureTitle,
          content: text,
          userInput: text,
          history: this.data.messages
            .filter(message => message.status !== 'failed')
            .slice(-AI_CONFIG.maxHistoryPairs * 2)
        }, { throwError: true })
        aiContent = data && data.aiMsg && data.aiMsg.content
        if (!aiContent) throw new Error('AI_EMPTY_RESPONSE')
      }
      this.addAiMessage(aiContent)
    } catch (e) {
      console.warn('[chat] send failed:', this.formatError(e))
      this.addFailedMessage(text)
    }
  },

  formatError(e) {
    if (!e) return 'UNKNOWN_ERROR'
    const parts = [
      e.errCode || e.code || '',
      e.errMsg || e.message || ''
    ].filter(Boolean)
    return parts.length ? parts.join(' ') : String(e)
  },

  addFailedMessage(text) {
    const failedMessage = {
      _id: uid('a_'),
      role: 'figure',
      figureId: this.data.figureId,
      content: '暂时无法回复，请稍后重试。',
      status: 'failed',
      retryText: text,
      createdAt: Date.now()
    }
    const messages = this.data.messages.concat([failedMessage])
    this.setData({
      messages,
      sending: false,
      aiTyping: false,
      chatStatus: 0,
      navTitle: this.data.figureName
    })
    wx.setNavigationBarTitle({ title: this.data.figureName })
    this.persistMessages(messages)
    this.scrollToBottom()
  },

  onRetry(e) {
    if (this.data.sending) return
    const id = e.currentTarget.dataset.id
    const failed = this.data.messages.find(message => message._id === id)
    if (!failed || failed.status !== 'failed') return
    const index = this.data.messages.findIndex(message => message._id === id)
    const previous = index > 0 ? this.data.messages[index - 1] : null
    const nextMessages = this.data.messages.filter((message, messageIndex) =>
      messageIndex !== index && !(messageIndex === index - 1 && previous && previous.role === 'user')
    )
    this.setData({ messages: nextMessages })
    this.persistMessages(nextMessages)
    this.sendText(failed.retryText)
  },

  addAiMessage(content) {
    const now = Date.now()
    const fullMsg = {
      _id: uid('a_'),
      role: 'figure',
      figureId: this.data.figureId,
      content,
      createdAt: now
    }
    const messages = this.data.messages.concat([fullMsg])
    this.setData({
      messages,
      sending: false,
      aiTyping: false,
      chatStatus: 0,
      navTitle: this.data.figureName
    })
    wx.setNavigationBarTitle({ title: this.data.figureName })
    this.scrollToBottom()
    this.persistMessages(messages)
    this.bumpSession(content, now)
  },

  setChatProcessing(isProcessing) {
    const title = isProcessing ? '对方正在输入中...' : this.data.figureName
    this.setData({
      sending: isProcessing,
      aiTyping: isProcessing,
      chatStatus: isProcessing ? 1 : 0,
      navTitle: title
    })
    wx.setNavigationBarTitle({ title })
  },

  // 持久化消息到本地
  persistMessages(messages) {
    chatSession.saveMessages(this.data.figureId, messages)
  },

  // 更新首页会话列表（最后消息 + 时间），首次聊天自动创建会话
  bumpSession(lastMessage, lastTime) {
    chatSession.upsertSession({
      figureId: this.data.figureId,
      figureName: this.data.figureName,
      figureTitle: this.data.figureTitle,
      avatar: this.data.avatar,
      lastMessage: lastMessage,
      lastTime: lastTime,
      isSystem: this.data.isSystem
    })
    chatSession.clearUnread(this.data.figureId)
  },

  onAvatarTap() {
    if (this.data.isSystem) {
      wx.showToast({ title: '青月是系统向导，没有详情页哦', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/lantai/figure-detail?id=${this.data.figureId}&name=${encodeURIComponent(this.data.figureName)}`
    })
  },

  onAvatarError() {
    this.setData({ avatar: '/images/icons/avatar.png' })
  },

  onQuickReply(e) {
    const item = e.currentTarget.dataset.item
    this.setData({ inputValue: item, inputText: item })
    this.onSend()
  },

  onBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/chat/index' }) })
  },

  onShareAppMessage() {
    return {
      title: `我正在和${this.data.figureName}聊天，你也来试试？`,
      path: `/pages/chat/room?figureId=${this.data.figureId}`
    }
  }
})
