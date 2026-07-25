const { requestCloud } = require('../../utils/cloudRequest')
const { formatChatTime } = require('../../utils/date')
const { storage } = require('../../utils/storage')
const { AI_CONFIG } = require('../../utils/constants')
const { uid, sleep } = require('../../utils/helpers')
const loginGuard = require('../../utils/loginGuard')

const MOCK_MESSAGES = [
  { _id: 'm1', role: 'figure', figureId: 'simaqian', content: '吾乃司马迁，太史公司马迁是也。承蒙足下相邀，愿与君促膝长谈。不知君欲从何史问起？', createdAt: Date.now() - 3600000 * 2 },
  { _id: 'm2', role: 'user', content: '太史公，史记一百三十篇，您最钟爱哪一篇？', createdAt: Date.now() - 3600000 * 1.5 },
  { _id: 'm3', role: 'figure', figureId: 'simaqian', content: '哈哈，足下此问，正中吾心。每一篇皆吾心血所注，然最动人心魄者，莫过《项羽本纪》。乌江自刎一折，每思及此，未尝不废书而叹也！', createdAt: Date.now() - 3600000 }
]

Page({
  data: {
    figureId: '',
    figureName: '司马迁',
    figureTitle: '太史公',
    avatar: 'https://img.icons8.com/color/96/emperor.png',
    messages: [],
    inputValue: '',
    inputText: '',
    sending: false,
    scrollTop: 0,
    scrollTo: '',
    aiTyping: false,
    safeBottom: 0,
    chatStatus: 0,
    showTools: false,
    manualScroll: false,
    footerBoxHeight: 92,
    inputBoxHeight: 44
  },

  onLoad(options) {
    const figureId = options.figureId || 'simaqian'
    const figureName = decodeURIComponent(options.figureName || '司马迁')
    const [name, title] = figureName.split(' · ')
    try {
      const sys = wx.getSystemInfoSync()
      const pxPerRpx = sys.windowWidth / 750
      const safeBottomPx = sys.safeAreaInsets ? sys.safeAreaInsets.bottom : 0
      this.setData({
        safeBottom: Math.round(safeBottomPx / pxPerRpx),
        footerBoxHeight: Math.round(65 + safeBottomPx + 12 * pxPerRpx)
      })
    } catch (e) {}
    this.setData({
      figureId,
      figureName: name,
      figureTitle: title || ''
    })
    wx.setNavigationBarTitle({ title: figureName })
    this.loadHistory()
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
    const app = getApp()
    app.setCurrentTab(this, 0)
  },

  async loadHistory() {
    const cacheKey = `chat_${this.data.figureId}`
    const cached = storage.get(cacheKey)
    if (cached && cached.length) {
      this.setData({ messages: cached })
      this.scrollToBottom()
      return
    }
    try {
      const data = await requestCloud('chat', 'history', { figureId: this.data.figureId }, { throwError: false })
      const messages = (data && data.messages) || MOCK_MESSAGES
      this.setData({ messages })
      storage.set(cacheKey, messages, 300)
    } catch (e) {
      this.setData({ messages: MOCK_MESSAGES })
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

  handleLineChange(e) {
    const { height } = e.detail
    if (height) {
      const h = Math.max(44, Math.min(160, height))
      this.setData({ inputBoxHeight: h })
    }
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
          const cacheKey = `chat_${this.data.figureId}`
          storage.remove(cacheKey)
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
    const cacheKey = `chat_${this.data.figureId}`
    storage.set(cacheKey, this.data.messages, 600)
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

    const userMsg = {
      _id: uid('u_'),
      role: 'user',
      content: text,
      createdAt: Date.now()
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

    try {
      await sleep(800)
      const data = await requestCloud('chat', 'send', {
        figureId: this.data.figureId,
        figureName: this.data.figureName,
        figureTitle: this.data.figureTitle,
        userInput: text,
        history: this.data.messages.slice(-AI_CONFIG.maxHistoryPairs * 2)
      }, { throwError: false })

      let aiContent = (data && data.content) || this.generateMockReply(text, this.data.figureName)
      this.addAiMessage(aiContent)
    } catch (e) {
      const fallback = this.generateMockReply(text, this.data.figureName)
      this.addAiMessage(fallback)
    }
  },

  addAiMessage(content) {
    const fullMsg = {
      _id: uid('a_'),
      role: 'figure',
      figureId: this.data.figureId,
      content: '',
      createdAt: Date.now()
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
      const cacheKey = `chat_${this.data.figureId}`
      storage.set(cacheKey, this.data.messages, 600)
      return
    }
    const messages = this.data.messages.map(m =>
      m._id === msgId ? { ...m, content: content.slice(0, i + 1) } : m
    )
    this.setData({ messages })
    if (i % 5 === 0 && !this.data.manualScroll) this.scrollToBottom()
    this._typeTimer = setTimeout(() => this.typeEffect(msgId, content, i + 1), speed)
  },

  generateMockReply(text, name) {
    const replies = [
      '善哉斯言！君之所问，诚为知史之论。',
      '此事说来话长，容某细细道来...',
      '以史为镜，可以知兴替。君其勉之！',
      '君不见当年之事，已作尘埃矣。',
      '非也非也，君有所不知，其中另有隐情。'
    ]
    return replies[Math.floor(Math.random() * replies.length)] + '\n（注：云函数未部署，此为本地模拟回复）'
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
