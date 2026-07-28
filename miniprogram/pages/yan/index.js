const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')
const loginGuard = require('../../utils/loginGuard')

const app = getApp()

// 云存储路径前缀
const CLOUD_PREFIX = 'cloud://cloud1-d0gunpzup215cfd87.636c-cloud1-d0gunpzup215cfd87-1457646459/mini-assets/yan/'

// 信使本地配置（与云函数同步，用于UI即时渲染）
const CARRIERS = [
  {
    key: 'qinghong',
    name: '轻鸿',
    image: CLOUD_PREFIX + 'qinghong.jpg',
    flyImage: CLOUD_PREFIX + 'qinghong-fly.jpg',
    speed: 95, speedLabel: '4小时',
    accuracy: 80, accuracyLabel: '80%',
    load: 30, loadLabel: '轻薄',
    rarity: 25, rarityLabel: '普通', rarityType: 'common',
    tags: ['一日往返', '载物轻薄', '偶有迷途'],
    desc: '羽翼轻盈，乘风疾行。气力有限，只能捎带轻巧风物，偶尔会迷失时空。',
    aura: 'rgba(212,165,116,0.2)'
  },
  {
    key: 'guiyan',
    name: '归雁',
    image: CLOUD_PREFIX + 'guiyan.jpg',
    flyImage: CLOUD_PREFIX + 'guiyan-fly.jpg',
    speed: 60, speedLabel: '12小时',
    accuracy: 100, accuracyLabel: '100%',
    load: 60, loadLabel: '中等',
    rarity: 55, rarityLabel: '精良', rarityType: 'fine',
    tags: ['两日往返', '定向必达', '稳妥可靠'],
    desc: '循亘古航路而行，守信不误，定向投递万无一失。所携风物品相适中。',
    aura: 'rgba(196,30,58,0.18)'
  },
  {
    key: 'daocao',
    name: '大雕',
    image: CLOUD_PREFIX + 'daocao.jpg',
    flyImage: CLOUD_PREFIX + 'dadiao-fly.png',
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

// 空朝代兜底（云端返回前显示）
const FALLBACK_DYNASTIES = [
  { key: 'random', name: '随机漂流' }
]

Page({
  data: {
    statusBarHeight: 20,
    navHeight: 44,
    // 右上角悬浮图标区的top位置（胶囊按钮下方）
    floatIconsTop: 100,
    floatIconsRight: 16,
    carrierIndex: 0,
    carriers: CARRIERS,
    dynasties: FALLBACK_DYNASTIES,
    selectedDynasty: '',
    figures: [],
    allFigures: [],
    selectedFigureId: '',
    selectedFigureName: '',
    letterContent: '',
    canSend: false,
    sending: false,
    // 鸿雁忙碌状态：记录每个信使是否有正在送信中的信件
    carrierBusy: {},
    // 当前鸿雁的旅行信件详情（用于展示进度条）
    currentTraveling: null
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    const statusBarHeight = sysInfo.statusBarHeight || 20
    const windowWidth = sysInfo.windowWidth || 375
    // 计算导航栏高度，与微信胶囊按钮对齐
    let navHeight = 44
    let floatIconsTop = statusBarHeight + 44 + 12
    let floatIconsRight = 16
    try {
      const menuBtn = wx.getMenuButtonBoundingClientRect()
      if (menuBtn && menuBtn.height) {
        navHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height
        // 悬浮图标放在胶囊按钮正下方
        floatIconsTop = menuBtn.bottom + 12
        // 右边距与胶囊按钮右边对齐
        floatIconsRight = Math.max(12, (windowWidth - menuBtn.right))
      }
    } catch (e) {}
    this.setData({ statusBarHeight, navHeight, floatIconsTop, floatIconsRight })
    this.loadStaticData()
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
    this.checkCarrierBusy()
    this.startCountdownLoop()
  },

  onHide() {
    this.clearCountdownLoop()
  },

  onUnload() {
    this.clearCountdownLoop()
  },

  // 加载人物数据（朝代+人物列表从云端获取，朝代以数据库为准）
  async loadStaticData() {
    const cached = storage.get('yan_figures')
    if (cached && Array.isArray(cached.figures) && cached.figures.length) {
      this.setData({
        allFigures: cached.figures,
        dynasties: cached.dynasties || FALLBACK_DYNASTIES
      })
      if (!this.data.selectedDynasty && this.data.dynasties.length > 1) {
        const firstNonRandom = this.data.dynasties.find(d => d.key !== 'random')
        if (firstNonRandom) {
          this.setData({ selectedDynasty: firstNonRandom.key })
        }
      }
      this.filterFigures(this.data.selectedDynasty)
    }
    try {
      const data = await requestCloud('yan', 'figures', {}, { throwError: false })
      if (data && Array.isArray(data.figures) && data.figures.length) {
        this.setData({
          allFigures: data.figures,
          dynasties: data.dynasties || FALLBACK_DYNASTIES
        })
        storage.set('yan_figures', data, 3600)
        if (!this.data.selectedDynasty || !this.data.dynasties.some(d => d.key === this.data.selectedDynasty)) {
          const firstNonRandom = this.data.dynasties.find(d => d.key !== 'random')
          if (firstNonRandom) {
            this.setData({ selectedDynasty: firstNonRandom.key })
          } else {
            this.setData({ selectedDynasty: 'random' })
          }
        }
        this.filterFigures(this.data.selectedDynasty)
      }
    } catch (e) {}
  },

  // 按朝代筛选人物
  filterFigures(dynasty) {
    let figures
    if (dynasty === 'random' || !dynasty) {
      figures = []
    } else {
      figures = this.data.allFigures.filter(f => f.dynasty === dynasty)
    }
    const selectedFigureId = figures.length ? figures[0].figureId : ''
    const selectedFigureName = figures.length ? figures[0].name : ''
    this.setData({ figures, selectedFigureId, selectedFigureName })
    this.updateCanSend()
  },

  // 检查鸿雁忙碌状态（查询当前用户旅行中的信件）
  async checkCarrierBusy() {
    try {
      const data = await requestCloud('yan', 'list', { tab: 'traveling' }, { throwError: false })
      if (data && Array.isArray(data.letters)) {
        const carrierBusy = {}
        const travelingMap = {} // key -> letter
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

  // 更新当前选中鸿雁的旅行信件详情
  updateCurrentTraveling(travelingMap) {
    const map = travelingMap || this._travelingMap || {}
    if (travelingMap) this._travelingMap = travelingMap
    const carrierKey = CARRIERS[this.data.carrierIndex].key
    const letter = map[carrierKey]
    if (letter) {
      this.setData({
        currentTraveling: {
          ...letter,
          remainText: this.formatCountdown(Math.max(0, letter.arriveAt - Date.now())),
          progress: this.calcProgress(letter),
          sentAtText: this.formatTime(letter.sentAt)
        }
      })
    } else {
      this.setData({ currentTraveling: null })
    }
  },

  // 倒计时循环
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
      // 到达后刷新
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
    const d = new Date(ts)
    const pad = n => (n < 10 ? '0' + n : n)
    return d.getMonth() + 1 + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  },

  calcProgress(l) {
    if (!l.arriveAt || !l.sentAt) return 0
    const now = Date.now()
    return Math.min(100, Math.round(((now - l.sentAt) / (l.arriveAt - l.sentAt)) * 100))
  },

  // ====== 返回 ======
  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/discover/index' }) })
  },

  // ====== 跳转记录页 ======
  goRecords() {
    wx.navigateTo({ url: '/pages/yan/records' })
  },

  // ====== 跳转藏馆页 ======
  goCollection() {
    wx.navigateTo({ url: '/pages/yan/collection' })
  },

  // ====== 鸿雁切换 ======
  switchCarrier(e) {
    const dir = Number(e.currentTarget.dataset.dir)
    let idx = this.data.carrierIndex + dir
    if (idx < 0) idx = CARRIERS.length - 1
    if (idx >= CARRIERS.length) idx = 0
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

  // ====== 朝代选择 ======
  selectDynasty(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ selectedDynasty: key })
    this.filterFigures(key)
  },

  // ====== 角色选择 ======
  selectFigure(e) {
    const id = e.currentTarget.dataset.id
    const fig = this.data.figures.find(f => f.figureId === id)
    this.setData({ selectedFigureId: id, selectedFigureName: fig ? fig.name : '' })
    this.updateCanSend()
  },

  // ====== 信笺输入 ======
  onLetterInput(e) {
    const content = e.detail.value || ''
    this.setData({ letterContent: content })
    this.updateCanSend()
  },

  // 判断当前鸿雁是否忙碌
  isCurrentCarrierBusy() {
    const carrierKey = CARRIERS[this.data.carrierIndex].key
    return !!this.data.carrierBusy[carrierKey]
  },

  updateCanSend() {
    const { letterContent, selectedFigureId, selectedDynasty } = this.data
    const hasContent = letterContent.trim().length > 0
    const hasFigure = selectedFigureId || selectedDynasty === 'random'
    const notBusy = !this.isCurrentCarrierBusy()
    this.setData({ canSend: hasContent && hasFigure && notBusy })
  },

  // ====== 发送雁书 ======
  async sendLetter() {
    const { canSend, carrierIndex, selectedDynasty, selectedFigureId, letterContent } = this.data
    // 防空判定：内容为空
    if (!letterContent || !letterContent.trim()) {
      wx.showToast({ title: '请先书写信笺内容', icon: 'none' })
      return
    }
    // 防空判定：未选择收信人（且非随机漂流）
    if (selectedDynasty !== 'random' && !selectedFigureId) {
      wx.showToast({ title: '请选择收信人', icon: 'none' })
      return
    }
    // 防空判定：当前鸿雁忙碌
    if (this.isCurrentCarrierBusy()) {
      wx.showToast({ title: '此鸿雁正在送信中，请切换其他鸿雁', icon: 'none' })
      return
    }
    if (this.data.sending) return

    // 署名：优先用户昵称，兜底「远方友人」
    const userInfo = (app.globalData && app.globalData.userInfo) || {}
    const fromName = (userInfo.nickName || '').trim().slice(0, 20) || '远方友人'

    this.setData({ sending: true })
    try {
      const data = await requestCloud('yan', 'send', {
        carrier: CARRIERS[carrierIndex].key,
        dynasty: selectedDynasty,
        figureId: selectedFigureId || 'random',
        content: letterContent,
        fromName
      }, { showLoading: true, loadingText: '托付信使...' })

      if (data) {
        wx.showToast({ title: '鸿雁已启程', icon: 'success' })
        // 标记当前鸿雁为忙碌状态，并重新拉取旅行信件
        const carrierKey = CARRIERS[carrierIndex].key
        const carrierBusy = { ...this.data.carrierBusy, [carrierKey]: true }
        this.setData({
          letterContent: '',
          sending: false,
          carrierBusy
        })
        this.updateCanSend()
        // 重新拉取旅行信件，更新进度条
        this.checkCarrierBusy()
      } else {
        this.setData({ sending: false })
      }
    } catch (e) {
      this.setData({ sending: false })
    }
  },

  // 头像加载失败时清除 avatar 字段，触发 fallback 显示首字
  onAvatarError(e) {
    const index = e.currentTarget.dataset.index
    if (index === undefined) return
    const figures = this.data.figures.slice()
    if (figures[index]) {
      figures[index] = Object.assign({}, figures[index], { avatar: '', avatarError: true })
      this.setData({ figures })
    }
  },

  // 阻止冒泡
  stopProp() {}
})
