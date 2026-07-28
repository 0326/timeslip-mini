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
      const fig = storage.get('figure_' + figureId)
      if (fig && fig.avatar) avatar = fig.avatar
    }

    const userInfo = this.getUserInfo()

    this.setData({
      figureId,
      figureName: name,
      figureTitle: title || '',
      avatar,
      userName: userInfo.nickName || '',
      isSystem
    })

    this.loadUserAvatar(userInfo)
    wx.setNavigationBarTitle({ title: figureName })

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
    this.setData({ chatStatus: 0, aiTyping: false, sending: false })
    if (this._typeTimer) {
      clearTimeout(this._typeTimer)
      this._typeTimer = null
    }
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
      manualScroll: false
    })
    this.scrollToBottom()
    this.persistMessages(messages)
    this.bumpSession(text, now)

    try {
      let aiContent
      if (this.data.isSystem) {
        await sleep(300)
        aiContent = this.generateQingyueReply(text)
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
      if (this.data.isSystem) {
        this.addAiMessage(this.generateQingyueReply(text))
      } else {
        this.addFailedMessage(text)
      }
    }
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
    this.setData({ messages, sending: false, aiTyping: false, chatStatus: 0 })
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
      content: '',
      createdAt: now
    }
    const messages = this.data.messages.concat([fullMsg])
    this.setData({ messages, sending: false, chatStatus: 2 })
    this.scrollToBottom()
    this.typeEffect(fullMsg._id, content, 0)
  },

  typeEffect(msgId, content, i) {
    if (this.data.chatStatus === 0) return
    const speed = AI_CONFIG.typingSpeedMs || 40
    if (i >= content.length) {
      this.setData({ aiTyping: false, chatStatus: 0 })
      this.persistMessages(this.data.messages)
      this.bumpSession(content, Date.now())
      return
    }
    const messages = this.data.messages.map(m =>
      m._id === msgId ? { ...m, content: content.slice(0, i + 1) } : m
    )
    this.setData({ messages })
    if (i % 5 === 0 && !this.data.manualScroll) this.scrollToBottom()
    this._typeTimer = setTimeout(() => this.typeEffect(msgId, content, i + 1), speed)
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

  // 青月引导回复：关键词匹配 + 功能介绍
  generateQingyueReply(text) {
    const t = (text || '').toLowerCase()
    const has = kw => t.indexOf(kw) >= 0
    if (has('兰台') || has('人物') || has('历史人物')) {
      return '「兰台」是穿越圈的人物殿堂，你可以在这里结识孔子、司马迁、李白、苏轼等历代先贤。\n\n点击底部「兰台」Tab，选择一位人物进入详情页，即可开始对话。每位人物都有独特的性格与口吻哦～'
    }
    if (has('发现') || has('朋友圈') || has('动态')) {
      return '「发现」页有穿越朋友圈，历史人物会在这里发布动态，你可以点赞、评论，与他们互动。\n\n还有「飞鸽传书」可以给古人写信，「奏折推演」体验朝堂决策。点击底部「发现」Tab 即可探索。'
    }
    if (has('飞鸽') || has('信') || has('写信')) {
      return '「飞鸽传书」让你可以给历史人物写一封信，他们会以古人的口吻回信给你。\n\n在「发现」页找到飞鸽传书入口，选择收信人即可开始。信件会保存在「我的」-「书信集」中。'
    }
    if (has('dna') || has('测试') || has('灵魂') || has('匹配')) {
      return '「DNA 测试」会通过几道趣味问题，找到与你灵魂最契合的历史人物。\n\n在「发现」页进入「DNA 殿堂」即可开始测试，测完还能直接与匹配的人物对话。'
    }
    if (has('视频') || has('视频号')) {
      return '「视频号」里有历史人物的主题视频频道，可以观看、点赞、评论。\n\n在「发现」页找到「视频号」入口，或在人物详情页查看该人物的相关视频。'
    }
    if (has('奏折') || has('朝堂')) {
      return '「奏折推演」让你化身决策者，批阅古人的奏折并做出选择，系统会推演你的决策对历史走向的影响。\n\n前往「发现」页即可体验。'
    }
    if (has('成就')) {
      return '在「我的」-「成就」中，可以查看你的穿越足迹。每一次对话、每一封信、每一次互动都可能解锁新成就。'
    }
    if (has('怎么') || has('如何') || has('帮助') || has('功能') || has('能做')) {
      return '穿越圈目前有这些核心功能：\n\n1. 「兰台」— 结识历史人物并与之对话\n2. 「发现」— 朋友圈、飞鸽传书、奏折推演、DNA 测试、视频号\n3. 「我的」— 个人资料、成就、书信集\n\n你可以直接告诉我感兴趣的方向，我来为你指路～'
    }
    if (has('你好') || has('hi') || has('哈喽') || has('在吗')) {
      return '你好呀～我是青月，穿越圈的向导。你可以问我「兰台是什么」「怎么飞鸽传书」「DNA 测试怎么玩」之类的问题，我会一一为你解答。'
    }
    return '这个问题我可能不太确定，不过穿越圈的功能你都可以试试看：\n· 去「兰台」找一位历史人物聊天\n· 在「发现」刷朋友圈、写信、做 DNA 测试\n\n如果想了解某项功能，直接告诉我名字就好～'
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
