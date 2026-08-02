const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')
const loginGuard = require('../../utils/loginGuard')

const app = getApp()

// 本地兜底（云端拉取失败时使用）
const CARRIERS_CACHE_KEY = 'yan_carriers_v1'
const CARRIERS_TTL = 3600
const DRAFT_KEY = 'yan_letter_draft_v1'
const DRAFT_SAVE_DEBOUNCE = 300
const DRAFT_AUTO_RECOVER_WINDOW = 24 * 3600 * 1000
const DRAFT_MAX_TTL = 7 * 24 * 3600 * 1000

const CLOUD_PREFIX = 'cloud://cloud1-d0gunpzup215cfd87.636c-cloud1-d0gunpzup215cfd87-1457646459/mini-assets/yan/'
const FALLBACK_CARRIERS = [
  {
    key: 'qinghong', name: '轻鸿',
    image: CLOUD_PREFIX + 'qinghong.jpg', flyImage: CLOUD_PREFIX + 'qinghong-fly.jpg',
    speed: 95, speedLabel: '4小时',
    accuracy: 80, accuracyLabel: '80%',
    load: 30, loadLabel: '轻薄',
    rarity: 25, rarityLabel: '普通', rarityType: 'common',
    tags: ['一日往返', '载物轻薄', '偶有迷途'],
    desc: '羽翼轻盈，乘风疾行。气力有限，只能捎带轻巧风物，偶尔会迷失时空。',
    aura: 'rgba(212,165,116,0.2)'
  },
  {
    key: 'guiyan', name: '归雁',
    image: CLOUD_PREFIX + 'guiyan.jpg', flyImage: CLOUD_PREFIX + 'guiyan-fly.jpg',
    speed: 60, speedLabel: '12小时',
    accuracy: 100, accuracyLabel: '100%',
    load: 60, loadLabel: '中等',
    rarity: 55, rarityLabel: '精良', rarityType: 'fine',
    tags: ['两日往返', '定向必达', '稳妥可靠'],
    desc: '循亘古航路而行，守信不误，定向投递万无一失。所携风物品相适中。',
    aura: 'rgba(196,30,58,0.18)'
  },
  {
    key: 'daocao', name: '大雕',
    image: CLOUD_PREFIX + 'daocao.jpg', flyImage: CLOUD_PREFIX + 'daocao-fly.jpg',
    speed: 30, speedLabel: '24小时',
    accuracy: 90, accuracyLabel: '90%',
    load: 100, loadLabel: '厚重',
    rarity: 90, rarityLabel: '稀有', rarityType: 'rare',
    tags: ['三日往返', '可负重宝', '偶会漂流'],
    desc: '翱翔云海，负重远行。运力超群，常带回厚重珍稀古物；偶有随风漂泊。',
    aura: 'rgba(15,52,96,0.35)'
  }
]

const MAX_LETTER_LEN = 500
const FALLBACK_DYNASTIES = [{ key: 'random', name: '随机漂流' }]

// 订阅消息模板ID（TODO：公众平台后台创建模板后替换）
const SUBSCRIBE_TEMPLATE_IDS = [
  // 示例：请将实际模板 tmplIds 填入下方数组
  // 'PLACEHOLDER_TEMPLATE_ID_REPLACE_ME'
]

Page({
  data: {
    statusBarHeight: 20,
    navHeight: 44,
    floatIconsTop: 100,
    floatIconsRight: 16,
    carrierIndex: 0,
    carriers: FALLBACK_CARRIERS,
    dynasties: FALLBACK_DYNASTIES,
    selectedDynasty: '',
    figures: [],
    allFigures: [],
    selectedFigureId: '',
    selectedFigureName: '',
    letterContent: '',
    canSend: false,
    sending: false,
    carrierBusy: {},
    currentTraveling: null,
    // P1-3 草稿
    showDraftHint: false,
    savedDraftAt: '',
    // P1-5a 跳转参数
    jumpFigureId: '',
    jumpFigureName: ''
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    const statusBarHeight = sysInfo.statusBarHeight || 20
    const windowWidth = sysInfo.windowWidth || 375
    let navHeight = 44
    let floatIconsTop = statusBarHeight + 44 + 12
    let floatIconsRight = 16
    try {
      const menuBtn = wx.getMenuButtonBoundingClientRect()
      if (menuBtn && menuBtn.height) {
        navHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height
        floatIconsTop = menuBtn.bottom + 12
        floatIconsRight = Math.max(12, (windowWidth - menuBtn.right))
      }
    } catch (e) {}

    // P1-5a：解析跳转参数（figureId + figureName）
    const jumpFigureId = (options && (options.figureId || options.figureid)) ? String(options.figureId || options.figureid || '') : ''
    const jumpFigureName = options && options.figureName ? decodeURIComponent(options.figureName) : ''

    this.setData({ statusBarHeight, navHeight, floatIconsTop, floatIconsRight, jumpFigureId, jumpFigureName })

    // P1-3：先尝试恢复草稿（再加载静态数据，避免在 restoreDraftContent 中找不到人物）
    const recovered = this.restoreDraft()
    this.loadStaticData(recovered ? { dynasty: this._pendingDraftDynasty, figureId: this._pendingDraftFigureId } : null)
    if (recovered && this._pendingDraftContent) {
      this.setData({ letterContent: this._pendingDraftContent })
      delete this._pendingDraftContent
      delete this._pendingDraftDynasty
      delete this._pendingDraftFigureId
    }

    // P1-5a：若带 figureId 参数，优先于草稿（覆盖人物/朝代选择）
    if (jumpFigureId) {
      this._autoSelectFigureId = jumpFigureId
      this._autoSelectFigureName = jumpFigureName
    }
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
    this.checkCarrierBusy()
    this.startCountdownLoop()
  },

  onHide() {
    this.clearCountdownLoop()
    this.flushDraftSave()
  },

  onUnload() {
    this.clearCountdownLoop()
    this.clearDraftDebounce()
  },

  // ====== 草稿相关 ======
  restoreDraft() {
    try {
      const raw = wx.getStorageSync(DRAFT_KEY)
      if (!raw) return false
      const draft = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!draft || !draft.savedAt) return false
      const age = Date.now() - draft.savedAt
      if (age > DRAFT_MAX_TTL) {
        this.discardDraft()
        return false
      }
      const within24h = age <= DRAFT_AUTO_RECOVER_WINDOW
      if (!draft.content && !draft.fromName) return false
      // 暂存待加载完静态数据后恢复
      this._pendingDraftContent = draft.content || ''
      this._pendingDraftDynasty = draft.selectedDynasty || ''
      this._pendingDraftFigureId = draft.selectedFigureId || ''
      this._pendingDraftFromName = draft.fromName || ''
      const d = new Date(draft.savedAt)
      const pad = n => (n < 10 ? '0' + n : n)
      this.setData({
        showDraftHint: true,
        savedDraftAt: (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
      })
      return within24h
    } catch (e) {
      return false
    }
  },

  discardDraft() {
    try { wx.removeStorageSync(DRAFT_KEY) } catch (e) {}
    this.setData({ showDraftHint: false, savedDraftAt: '' })
    this.clearDraftDebounce()
  },

  clearDraftDebounce() {
    if (this._draftTimer) {
      clearTimeout(this._draftTimer)
      this._draftTimer = null
    }
  },

  debounceSaveDraft() {
    if (this._draftTimer) clearTimeout(this._draftTimer)
    this._draftTimer = setTimeout(() => this.saveDraftNow(), DRAFT_SAVE_DEBOUNCE)
  },

  flushDraftSave() {
    this.clearDraftDebounce()
    this.saveDraftNow()
  },

  saveDraftNow() {
    try {
      const { letterContent, selectedDynasty, selectedFigureId } = this.data
      if (!letterContent || !letterContent.trim()) {
        try { wx.removeStorageSync(DRAFT_KEY) } catch (e) {}
        this.setData({ showDraftHint: false, savedDraftAt: '' })
        return
      }
      const userInfo = (app.globalData && app.globalData.userInfo) || {}
      const fromName = (userInfo.nickName || '').trim().slice(0, 20) || '远方友人'
      const savedAt = Date.now()
      wx.setStorageSync(DRAFT_KEY, JSON.stringify({
        content: letterContent,
        selectedDynasty,
        selectedFigureId,
        fromName,
        savedAt
      }))
      const d = new Date(savedAt)
      const pad = n => (n < 10 ? '0' + n : n)
      this.setData({
        savedDraftAt: (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
      })
    } catch (e) {}
  },

  // ====== 静态数据加载 ======
  async loadStaticData(draftHint) {
    // 1. 先拉缓存的信使
    const cachedCarriers = storage.get(CARRIERS_CACHE_KEY)
    if (cachedCarriers && Array.isArray(cachedCarriers) && cachedCarriers.length) {
      this.setData({ carriers: cachedCarriers })
    }
    // 2. 拉缓存的人物
    const cachedFigures = storage.get('yan_figures')
    if (cachedFigures && Array.isArray(cachedFigures.figures) && cachedFigures.figures.length) {
      this.setData({
        allFigures: cachedFigures.figures,
        dynasties: cachedFigures.dynasties || FALLBACK_DYNASTIES
      })
      this.applyInitialSelection(cachedFigures.dynasties || FALLBACK_DYNASTIES, cachedFigures.figures, draftHint)
    }
    // 3. 异步云端拉取信使 + 人物
    try {
      const [carriersRes, figuresRes] = await Promise.all([
        requestCloud('yan', 'carriers', {}, { throwError: false }),
        requestCloud('yan', 'figures', {}, { throwError: false })
      ])
      if (carriersRes && Array.isArray(carriersRes) && carriersRes.length) {
        this.setData({ carriers: carriersRes })
        storage.set(CARRIERS_CACHE_KEY, carriersRes, CARRIERS_TTL)
      }
      if (figuresRes && Array.isArray(figuresRes.figures) && figuresRes.figures.length) {
        this.setData({
          allFigures: figuresRes.figures,
          dynasties: figuresRes.dynasties || FALLBACK_DYNASTIES
        })
        storage.set('yan_figures', figuresRes, 3600)
        this.applyInitialSelection(figuresRes.dynasties || FALLBACK_DYNASTIES, figuresRes.figures, draftHint)
      }
    } catch (e) {}
  },

  applyInitialSelection(dynasties, figures, draftHint) {
    let dynasty = this.data.selectedDynasty
    let figureId = this.data.selectedFigureId

    // 优先级：跳转参数 > 草稿 > 默认首个非 random 朝代
    if (this._autoSelectFigureId) {
      const fig = figures.find(f => String(f.figureId) === String(this._autoSelectFigureId))
      if (fig && fig.dynasty) {
        dynasty = fig.dynasty
        figureId = fig.figureId
      }
    } else if (draftHint && draftHint.figureId && figures.some(f => f.figureId === draftHint.figureId)) {
      figureId = draftHint.figureId
      const fig = figures.find(f => f.figureId === draftHint.figureId)
      if (fig) dynasty = draftHint.dynasty || fig.dynasty || dynasty
    } else if (draftHint && draftHint.dynasty && dynasties.some(d => d.key === draftHint.dynasty)) {
      dynasty = draftHint.dynasty
    }

    if (!dynasty || !dynasties.some(d => d.key === dynasty)) {
      const firstNonRandom = dynasties.find(d => d.key !== 'random')
      dynasty = firstNonRandom ? firstNonRandom.key : 'random'
    }

    this.setData({ selectedDynasty: dynasty })
    this.filterFigures(dynasty, figureId)
  },

  filterFigures(dynasty, forcedFigureId) {
    let figures
    if (dynasty === 'random' || !dynasty) {
      figures = []
    } else {
      figures = this.data.allFigures.filter(f => f.dynasty === dynasty)
    }
    let selectedFigureId = forcedFigureId || this.data.selectedFigureId
    if (!selectedFigureId || !figures.some(f => f.figureId === selectedFigureId)) {
      selectedFigureId = figures.length ? figures[0].figureId : ''
    }
    const fig = figures.find(f => f.figureId === selectedFigureId)
    this.setData({
      figures,
      selectedFigureId,
      selectedFigureName: fig ? fig.name : (this._autoSelectFigureName || '')
    })
    this.updateCanSend()
  },

  // ====== 鸿雁状态 ======
  async checkCarrierBusy() {
    try {
      const data = await requestCloud('yan', 'list', { tab: 'traveling' }, { throwError: false })
      if (data && Array.isArray(data.letters)) {
        const carrierBusy = {}
        const travelingMap = {}
        data.letters.forEach(l => {
          if (l.status === 'traveling' || l.status === 'processing') {
            carrierBusy[l.carrier] = true
            travelingMap[l.carrier] = l
          }
        })
        this.setData({ carrierBusy })
        this.updateCurrentTraveling(travelingMap)
        this.updateCanSend()
      }
    } catch (e) {}
  },

  updateCurrentTraveling(travelingMap) {
    const map = travelingMap || this._travelingMap || {}
    if (travelingMap) this._travelingMap = travelingMap
    const carriers = this.data.carriers || FALLBACK_CARRIERS
    const carrierKey = carriers[this.data.carrierIndex] ? carriers[this.data.carrierIndex].key : 'qinghong'
    const letter = map[carrierKey]
    if (letter) {
      const arriveTs = Number(letter.arriveAt) || 0
      const arriveDate = arriveTs ? new Date(arriveTs) : null
      let arriveAtText = '--'
      if (arriveDate && arriveDate.getTime()) {
        const pad = n => (n < 10 ? '0' + n : n)
        arriveAtText = (arriveDate.getMonth() + 1) + '月' + arriveDate.getDate() + '日 ' + pad(arriveDate.getHours()) + ':' + pad(arriveDate.getMinutes())
      }
      this.setData({
        currentTraveling: {
          ...letter,
          remainText: this.formatCountdown(Math.max(0, arriveTs - Date.now())),
          progress: this.calcProgress(letter),
          sentAtText: this.formatTime(letter.sentAt),
          arriveAtText
        }
      })
    } else {
      this.setData({ currentTraveling: null })
    }
  },

  startCountdownLoop() {
    this.clearCountdownLoop()
    this._countdownTimer = setInterval(() => {
      const ct = this.data.currentTraveling
      if (!ct || !ct.arriveAt) return
      const now = Date.now()
      const remain = Math.max(0, ct.arriveAt - now)
      const progress = ct.arriveAt > ct.sentAt ? Math.min(100, ((now - ct.sentAt) / (ct.arriveAt - ct.sentAt)) * 100) : 100
      this.setData({
        currentTraveling: {
          ...ct,
          remainText: this.formatCountdown(remain),
          progress: Math.round(progress)
        }
      })
      if (remain <= 0) {
        this.checkCarrierBusy()
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

  formatTime(ts) {
    if (!ts) return ''
    const d = new Date(Number(ts))
    const pad = n => (n < 10 ? '0' + n : n)
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  },

  calcProgress(l) {
    if (!l.arriveAt || !l.sentAt) return 0
    const now = Date.now()
    return Math.min(100, Math.round(((now - l.sentAt) / (l.arriveAt - l.sentAt)) * 100))
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/discover/index' }) })
  },

  goRecords() {
    wx.navigateTo({ url: '/pages/yan/records' })
  },

  goCollection() {
    wx.navigateTo({ url: '/pages/yan/collection' })
  },

  switchCarrier(e) {
    const carriers = this.data.carriers || FALLBACK_CARRIERS
    const dir = Number(e.currentTarget.dataset.dir)
    let idx = this.data.carrierIndex + dir
    if (idx < 0) idx = carriers.length - 1
    if (idx >= carriers.length) idx = 0
    this.setData({ carrierIndex: idx })
    this.updateCurrentTraveling()
    this.updateCanSend()
  },

  onCarrierSwiperChange(e) {
    this.setData({ carrierIndex: e.detail.current })
    this.updateCurrentTraveling()
    this.updateCanSend()
  },

  goCarrier(e) {
    this.setData({ carrierIndex: Number(e.currentTarget.dataset.idx) })
    this.updateCurrentTraveling()
    this.updateCanSend()
  },

  selectDynasty(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ selectedDynasty: key })
    this.filterFigures(key)
  },

  selectFigure(e) {
    const id = e.currentTarget.dataset.id
    const fig = this.data.figures.find(f => f.figureId === id)
    this.setData({ selectedFigureId: id, selectedFigureName: fig ? fig.name : '' })
    this.updateCanSend()
  },

  onLetterInput(e) {
    const content = e.detail.value || ''
    this.setData({ letterContent: content })
    this.updateCanSend()
    this.debounceSaveDraft()
  },

  isCurrentCarrierBusy() {
    const carriers = this.data.carriers || FALLBACK_CARRIERS
    const carrierKey = carriers[this.data.carrierIndex] ? carriers[this.data.carrierIndex].key : 'qinghong'
    return !!this.data.carrierBusy[carrierKey]
  },

  updateCanSend() {
    const { letterContent, selectedFigureId, selectedDynasty } = this.data
    const hasContent = letterContent.trim().length > 0
    const hasFigure = selectedFigureId || selectedDynasty === 'random'
    const notBusy = !this.isCurrentCarrierBusy()
    this.setData({ canSend: hasContent && hasFigure && notBusy })
  },

  // ====== 订阅消息（P1-4） ======
  async requestSubscribeBeforeSend() {
    const ids = (SUBSCRIBE_TEMPLATE_IDS || []).filter(Boolean)
    if (!ids.length) {
      // 未配置模板，视为不订阅
      return { subscribed: false }
    }
    return new Promise(resolve => {
      try {
        wx.requestSubscribeMessage({
          tmplIds: ids,
          success: (res) => {
            let ok = false
            ids.forEach(id => {
              if (res[id] === 'accept') ok = true
            })
            resolve({ subscribed: ok })
          },
          fail: () => resolve({ subscribed: false })
        })
      } catch (e) {
        resolve({ subscribed: false })
      }
    })
  },

  // ====== 发送雁书 ======
  async sendLetter() {
    const { canSend, carrierIndex, selectedDynasty, selectedFigureId, letterContent } = this.data
    if (!letterContent || !letterContent.trim()) {
      wx.showToast({ title: '请先书写信笺内容', icon: 'none' })
      return
    }
    if (selectedDynasty !== 'random' && !selectedFigureId) {
      wx.showToast({ title: '请选择收信人', icon: 'none' })
      return
    }
    if (this.isCurrentCarrierBusy()) {
      wx.showToast({ title: '此鸿雁正在送信中，请切换其他鸿雁', icon: 'none' })
      return
    }
    if (this.data.sending) return

    // P1-4：先引导订阅（不阻塞发送，失败也放行）
    const subRes = await this.requestSubscribeBeforeSend()
    const subscribed = subRes.subscribed

    const carriers = this.data.carriers || FALLBACK_CARRIERS
    const userInfo = (app.globalData && app.globalData.userInfo) || {}
    const fromName = (userInfo.nickName || '').trim().slice(0, 20) || '远方友人'

    this.setData({ sending: true })
    try {
      const data = await requestCloud('yan', 'send', {
        carrier: carriers[carrierIndex].key,
        dynasty: selectedDynasty,
        figureId: selectedFigureId || 'random',
        content: letterContent,
        fromName,
        subscribed
      }, { showLoading: true, loadingText: '托付信使...' })

      if (data) {
        wx.showToast({ title: '鸿雁已启程', icon: 'success' })
        // P1-3：发送成功，清空草稿
        this.discardDraft()
        const carrierKey = carriers[carrierIndex].key
        const carrierBusy = { ...this.data.carrierBusy, [carrierKey]: true }
        this.setData({
          letterContent: '',
          sending: false,
          carrierBusy
        })
        this.updateCanSend()
        this.checkCarrierBusy()
      } else {
        this.setData({ sending: false })
      }
    } catch (e) {
      this.setData({ sending: false })
    }
  },

  onAvatarError(e) {
    const index = e.currentTarget.dataset.index
    if (index === undefined) return
    const figures = this.data.figures.slice()
    if (figures[index]) {
      figures[index] = Object.assign({}, figures[index], { avatar: '', avatarError: true })
      this.setData({ figures })
    }
  },

  stopProp() {}
})
