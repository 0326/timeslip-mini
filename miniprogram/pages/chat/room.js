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
      success: (res) => {
        if (res.confirm) {
          chatSession.clearMessages(this.data.figureId)
          chatSession.bumpSession(this.data.figureId, '', Date.now())
          this.setData({ messages: [], showTools: false })
        }
      }
    })
  },

  onStopGen() {
    this._qingyueRunSeq = ''
    this.setChatProcessing(false)
    chatSession.saveMessages(this.data.figureId, this.data.messages)
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
        await this.sendQingyueAgentMessage(text)
        return
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
      if (this.data.isSystem) this.removeEmptyAgentMessage()
      this.addFailedMessage(text)
    }
  },

  removeEmptyAgentMessage() {
    const messages = this.data.messages.filter(message =>
      !(message.role === 'figure' && message.figureId === QINGYUE.figureId && !message.content && !message.status)
    )
    if (messages.length !== this.data.messages.length) {
      this.setData({ messages })
      this.persistMessages(messages)
    }
  },

  async sendQingyueAgentMessage(text) {
    const runSeq = uid('acp_')
    this._qingyueRunSeq = runSeq

    const payload = await this.requestQingyueAcp(text)
    if (this.data.chatStatus === 0 || this._qingyueRunSeq !== runSeq) return

    const finalContent = this.extractAcpText(payload).trim()
    if (!finalContent) throw new Error('AGENT_EMPTY_RESPONSE')
    this.addAiMessage(finalContent)
  },

  requestQingyueAcp(text) {
    const url = `${QINGYUE.acpEndpoint || ''}`
    if (!url) throw new Error('QINGYUE_ACP_ENDPOINT_MISSING')
    return new Promise((resolve, reject) => {
      wx.request({
        url,
        method: 'POST',
        header: {
          'content-type': 'application/json',
          Authorization: `Bearer ${QINGYUE.publishableKey}`
        },
        data: {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'session/prompt',
          params: {
            prompt: [
              {
                type: 'text',
                text
              }
            ]
          }
        },
        success: (res) => {
          const data = res && res.data
          if (!res || res.statusCode < 200 || res.statusCode >= 300) {
            const message = (data && (data.message || data.error && data.error.message)) || `ACP_HTTP_${res && res.statusCode}`
            reject(new Error(message))
            return
          }
          if (data && data.error) {
            reject(new Error(data.error.message || data.error.code || 'ACP_JSONRPC_ERROR'))
            return
          }
          resolve(data)
        },
        fail: reject
      })
    })
  },

  extractAcpText(payload) {
    const result = payload && payload.result !== undefined ? payload.result : payload
    if (!result) return ''
    if (typeof result === 'string') {
      return result.indexOf('data:') >= 0 ? this.extractSseAcpText(result) : result
    }
    if (typeof result.text === 'string') return result.text
    if (typeof result.answer === 'string') return result.answer
    if (typeof result.reply === 'string') return result.reply
    if (typeof result.content === 'string') return result.content
    if (typeof result.output === 'string') return result.output
    if (typeof result.output_text === 'string') return result.output_text
    if (result.message) return this.extractAcpText(result.message)
    if (Array.isArray(result.content)) {
      return result.content.map(item => {
        if (typeof item === 'string') return item
        return item && (item.text || item.content || '')
      }).filter(Boolean).join('')
    }
    if (Array.isArray(result)) {
      return result.map(item => this.extractAcpText(item)).filter(Boolean).join('')
    }
    if (result.data) return this.extractAcpText(result.data)
    return ''
  },

  extractSseAcpText(raw) {
    const frames = String(raw || '')
      .split(/\n\n+/)
      .map(part => part.trim())
      .filter(Boolean)

    const visibleChunks = []

    frames.forEach(frame => {
      const lines = frame.split(/\n/).map(line => line.trim())
      const dataLines = lines
        .filter(line => line.indexOf('data:') === 0)
        .map(line => line.slice(5).trim())
        .filter(Boolean)
      if (!dataLines.length) return
      const dataText = dataLines.join('\n')
      if (dataText === '[DONE]') return
      let event
      try {
        event = JSON.parse(dataText)
      } catch (e) {
        return
      }
      const update = event && event.params && event.params.update
      if (!update) return
      const updateType = update.sessionUpdate || update.type || ''
      const visibleUpdateTypes = [
        'agent_message_chunk',
        'assistant_message_chunk',
        'message_chunk',
        'text_message_chunk',
        'message',
        'text'
      ]
      if (visibleUpdateTypes.indexOf(updateType) < 0) return
      const text = this.extractVisibleContentText(update.content || update.message || update.delta)
      if (!text) return
      visibleChunks.push(text)
    })

    return visibleChunks.join('')
  },

  extractVisibleContentText(content) {
    if (!content) return ''
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content.map(item => this.extractVisibleContentText(item)).filter(Boolean).join('')
    }
    if (typeof content.text === 'string') return content.text
    if (typeof content.content === 'string') return content.content
    if (typeof content.delta === 'string') return content.delta
    if (Array.isArray(content.content)) return this.extractVisibleContentText(content.content)
    return ''
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
