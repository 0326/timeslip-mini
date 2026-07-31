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
    scrollAnimated: false,
    dailyLimited: false
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
    this.checkDailyLimit()
  },

  onShow() {
    // 青月（系统引导）无需登录
    if (!this.data.isSystem && !loginGuard.checkLogin(this)) return
    const app = getApp()
    app.setCurrentTab(this, 0)
    // P1：标记当前页面活跃（青月异步完成时判断是否累加 unread）
    if (this.data.isSystem) {
      app.setActivePage('chat/room', this.data.figureId)
    }
    const userInfo = this.getUserInfo()
    this.setData({
      userName: userInfo.nickName || ''
    })
    this.loadUserAvatar(userInfo)
    // 进入房间清除未读
    chatSession.clearUnread(this.data.figureId)
    // P1：青月异步消息同步
    if (this.data.isSystem) {
      this.syncQingyueState()
    }
    // 每次进入页面检查日限（跨天后自动恢复）
    this.checkDailyLimit()
  },

  onUnload() {
    // P1：离开房间取消活跃标记
    if (this.data.isSystem) {
      const app = getApp()
      app.clearActivePage('chat/room', this.data.figureId)
    }
  },

  // P1：青月异步消息同步
  // 1. 若有进行中的 promise，恢复 typing 标题
  // 2. 拉取云端最近 50 条消息，与本地去重合并
  // 3. 调 markRead 清云端 unread
  async syncQingyueState() {
    const app = getApp()
    const figureId = this.data.figureId

    // 恢复 typing 状态
    const pendingPromise = app.getAgentPromise(figureId)
    if (pendingPromise) {
      this.setChatProcessing(true)
    }

    // 拉取云端最近 50 条消息，与本地去重合并（不用 since 时间过滤，避免时间不一致漏消息）
    try {
      const cloudMsgs = await requestCloud('qingyue-agent', 'history', { limit: 50 }, { throwError: false })
      if (Array.isArray(cloudMsgs) && cloudMsgs.length) {
        const localMsgs = chatSession.getMessages(figureId)
        const localIds = new Set(localMsgs.map(m => m._id))
        const toAdd = cloudMsgs
          .filter(m => !localIds.has(m._id))
          .map(m => ({
            _id: m._id,
            role: m.role === 'assistant' ? 'figure' : m.role,
            figureId: m.figureId,
            content: m.content,
            createdAt: m.createdAt ? new Date(m.createdAt).getTime() : Date.now()
          }))
        if (toAdd.length) {
          const messages = localMsgs.concat(toAdd)
          chatSession.saveMessages(figureId, messages)
          this.setData({ messages })
          this.scrollToBottom(true)
          // 最后一条是 AI 回复时，同步本地 session 状态
          const last = toAdd[toAdd.length - 1]
          if (last.role === 'figure') {
            chatSession.markDone(figureId, last.content)
          }
        }
      }
    } catch (e) {
      console.warn('[room] syncMessages failed:', e && e.message)
    }

    // 清云端 unread
    requestCloud('qingyue-agent', 'markRead', {}, { throwError: false }).catch(() => {})
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
    const figuresList = storage.get('figures_star5_v5') || []
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
      this.scrollToBottom(true)
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
    this.scrollToBottom(true)
  },

  // instant=true：瞬时定位（初次加载/同步历史），无动画无滚动效果
  // instant=false：带动画滚动（发新消息）
  scrollToBottom(instant) {
    const messages = this.data.messages
    if (!messages.length) return
    const target = 'msg-' + messages[messages.length - 1]._id
    if (instant) {
      // 先关动画，确保 DOM 渲染后再定位，避免可见滚动
      this.setData({ scrollAnimated: false, scrollTo: '' })
      wx.nextTick(() => {
        this.setData({ scrollTo: target })
      })
    } else {
      this.setData({ scrollAnimated: true, scrollTo: target })
    }
  },

  bindKeyInput(e) {
    this.setData({ inputValue: e.detail.value, inputText: e.detail.value })
  },

  async checkDailyLimit() {
    const today = this.localTodayStr()
    const cacheKey = 'daily_limit'
    const cached = wx.getStorageSync(cacheKey)
    // 命中当天缓存：直接使用
    if (cached && cached.date === today) {
      this.setData({ dailyLimited: !!cached.reached })
      return
    }
    // 缓存失效：查云端（无论哪个角色，全局计数一致，查一个即可）
    try {
      const cloudName = this.data.isSystem ? 'qingyue-agent' : 'chat'
      const res = await requestCloud(cloudName, 'dailyStatus', {}, { throwError: false })
      if (res && typeof res.reached === 'boolean') {
        this.setData({ dailyLimited: res.reached })
        wx.setStorageSync(cacheKey, {
          date: today,
          reached: res.reached,
          used: res.used || 0
        })
      }
    } catch (e) {
      // 查询失败不影响正常使用
    }
  },

  // 本地日期字符串（YYYY-MM-DD，东八区），用于判断是否跨天
  localTodayStr() {
    const d = new Date()
    const utc = d.getTime() + d.getTimezoneOffset() * 60000
    const sh = new Date(utc + 8 * 3600000)
    const y = sh.getFullYear()
    const m = String(sh.getMonth() + 1).padStart(2, '0')
    const day = String(sh.getDate()).padStart(2, '0')
    return y + '-' + m + '-' + day
  },

  // 本地缓存：今日已发送数 +1（全局）
  incDailyUsed() {
    const today = this.localTodayStr()
    const cacheKey = 'daily_limit'
    const cached = wx.getStorageSync(cacheKey) || { date: today, reached: false, used: 0 }
    if (cached.date !== today) {
      cached.date = today
      cached.used = 0
      cached.reached = false
    }
    cached.used = (cached.used || 0) + 1
    if (cached.used >= 100) {
      cached.reached = true
      this.setData({ dailyLimited: true })
    }
    wx.setStorageSync(cacheKey, cached)
  },

  // 本地缓存：标记今日已达上限（全局）
  markDailyReached() {
    const today = this.localTodayStr()
    const cacheKey = 'daily_limit'
    wx.setStorageSync(cacheKey, { date: today, reached: true, used: 100 })
    this.setData({ dailyLimited: true })
  },

  // 触发日限：回滚乐观消息，禁用输入
  handleDailyLimitReached() {
    // 移除最后一条乐观添加的用户消息
    const messages = this.data.messages.slice(0, -1)
    this.setData({
      messages,
      sending: false,
      aiTyping: false,
      chatStatus: 0,
      navTitle: this.data.figureName,
      inputValue: '',
      inputText: '',
      dailyLimited: true
    })
    wx.setNavigationBarTitle({ title: this.data.figureName })
    this.persistMessages(messages)
    this.markDailyReached()
    wx.showToast({ title: '已达到今日聊天次数上限，明天再来', icon: 'none' })
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
    this._lastScrollTop = e.detail.scrollTop
  },

  async onSend() {
    const text = (this.data.inputValue || '').trim()
    if (!text || this.data.sending) return
    if (this.data.dailyLimited) {
      wx.showToast({ title: '已达到今日聊天次数上限，明天再来', icon: 'none' })
      return
    }
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
      navTitle: '对方正在输入中...'
    })
    wx.setNavigationBarTitle({ title: '对方正在输入中...' })
    this.scrollToBottom()
    this.persistMessages(messages)
    this.bumpSession(text, now)

    if (this.data.isSystem) {
      // P1：青月走异步消息，不阻塞 UI；用户可离开房间，完成后红点提示
      this.sendQingyueAsync(text, userMsg._id)
      return
    }

    try {
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
      const aiContent = data && data.aiMsg && data.aiMsg.content
      if (!aiContent) throw new Error('AI_EMPTY_RESPONSE')
      this.incDailyUsed()
      this.addAiMessage(aiContent)
    } catch (e) {
      console.warn('[chat] send failed:', this.formatError(e))
      // 日限触发：回滚本地乐观消息，禁用输入
      if (e && e.message && e.message.indexOf('今日聊天次数上限') >= 0) {
        this.handleDailyLimitReached()
        return
      }
      // 所有角色报错不展示重试 UI，发一个😊表情
      this.addAiMessage('😊')
    }
  },

  // P1：青月异步发送（不 await，存 app.agentPromises）
  sendQingyueAsync(text, localMessageId) {
    const app = getApp()
    const figureId = this.data.figureId

    // 本地 session 标记 processing
    chatSession.markProcessing(figureId, localMessageId)

    const promise = requestCloud('qingyue-agent', 'send', {
      text,
      localMessageId
    }, { throwError: true, timeout: 60000 })

    app.setAgentPromise(figureId, promise)

    promise
      .then(data => {
        const aiContent = data && data.aiMsg && data.aiMsg.content
        if (!aiContent) throw new Error('AGENT_EMPTY_RESPONSE')
        // 本地 session 标记 done
        chatSession.markDone(figureId, aiContent)
        // 计数 +1
        this.incDailyUsed()
        // 用户还在房间页 → 直接追加 AI 消息
        // 用户已离开 → 累加未读（本地 + 云端）
        if (app.isPageActive('chat/room', figureId)) {
          this.addAiMessage(aiContent)
        } else {
          chatSession.incUnread(figureId)
          requestCloud('qingyue-agent', 'markUnread', {}, { throwError: false }).catch(() => {})
        }
      })
      .catch(e => {
        console.warn('[chat] qingyue async failed:', this.formatError(e))
        // 日限触发
        if (e && e.message && e.message.indexOf('今日聊天次数上限') >= 0) {
          chatSession.markFailed(figureId)
          if (app.isPageActive('chat/room', figureId)) {
            this.handleDailyLimitReached()
          } else {
            this.markDailyReached()
          }
          return
        }
        // 本地 session 标记 failed
        chatSession.markFailed(figureId)
        if (app.isPageActive('chat/room', figureId)) {
          this.addAiMessage('😊')
        } else {
          chatSession.incUnread(figureId)
          requestCloud('qingyue-agent', 'markUnread', {}, { throwError: false }).catch(() => {})
        }
      })
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
