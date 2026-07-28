const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')
const loginGuard = require('../../utils/loginGuard')

const app = getApp()

// 信使本地配置（与云函数同步，用于UI即时渲染）
const CARRIERS = [
  {
    key: 'qinghong',
    name: '轻鸿',
    emoji: '🕊️',
    speed: 95, speedLabel: '4小时',
    accuracy: 80, accuracyLabel: '80%',
    load: 30, loadLabel: '轻薄',
    rarity: 25, rarityLabel: '普通',
    tags: ['一日往返', '载物轻薄', '偶有迷途'],
    desc: '羽翼轻盈，乘风疾行。气力有限，只能捎带轻巧风物，偶尔会迷失时空。',
    aura: 'rgba(212,165,116,0.2)'
  },
  {
    key: 'guiyan',
    name: '归雁',
    emoji: '🦢',
    speed: 60, speedLabel: '12小时',
    accuracy: 100, accuracyLabel: '100%',
    load: 60, loadLabel: '中等',
    rarity: 55, rarityLabel: '精良',
    tags: ['两日往返', '定向必达', '稳妥可靠'],
    desc: '循亘古航路而行，守信不误，定向投递万无一失。所携风物品相适中。',
    aura: 'rgba(196,30,58,0.18)'
  },
  {
    key: 'daocao',
    name: '大雕',
    emoji: '🦅',
    speed: 30, speedLabel: '24小时',
    accuracy: 90, accuracyLabel: '90%',
    load: 100, loadLabel: '厚重',
    rarity: 90, rarityLabel: '稀有',
    tags: ['三日往返', '可负重宝', '偶会漂流'],
    desc: '翱翔云海，负重远行。运力超群，常带回厚重珍稀古物；偶有随风漂泊。',
    aura: 'rgba(15,52,96,0.35)'
  }
]

const DYNASTIES = [
  { key: 'random', name: '随机漂流' },
  { key: 'xianqin', name: '先秦' },
  { key: 'han', name: '汉' },
  { key: 'weijin', name: '魏晋' },
  { key: 'tang', name: '唐' },
  { key: 'song', name: '宋' },
  { key: 'yuan', name: '元' },
  { key: 'ming', name: '明' },
  { key: 'qing', name: '清' }
]

const GIFT_FILTERS = [
  { key: 'all', name: '全部' },
  { key: '笔墨纸砚', name: '笔墨纸砚' },
  { key: '茶酒食', name: '茶酒食' },
  { key: '玉器青铜', name: '玉器青铜' },
  { key: '古籍字画', name: '古籍字画' }
]

const MAX_LETTER_LEN = 500

// 信使 / 人物头像 emoji 统一映射（避免散落在 WXML 各处不一致）
const CARRIER_EMOJI = { qinghong: '🕊️', guiyan: '🦢', daocao: '🦅' }
const FIGURE_EMOJI = {
  'fig-kongzi': '🎓',
  'fig-simqian': '📜',
  'fig-caocao': '⚔️',
  'fig-taoqian': '🌼',
  'fig-libai': '🍶',
  'fig-baijuyi': '🖋️',
  'fig-wuzetian': '👑',
  'fig-sushi': '🍖',
  'fig-liqingzhao': '🌸',
  'fig-xinqiji': '🗡️',
  'fig-guanhanqing': '🎭',
  'fig-zhenghe': '⛵',
  'fig-wangyangming': '🕯️',
  'fig-nalan': '🍂',
  'fig-caoxueqin': '📕'
}

function figureEmoji(figureId) {
  return FIGURE_EMOJI[figureId] || '🏛️'
}

function carrierEmoji(carrierKey) {
  return CARRIER_EMOJI[carrierKey] || '🕊️'
}

// 人物兜底：云端 figures 接口失败时仍可选择收信人（与云函数 FIGURES 保持一致）
const FALLBACK_FIGURES = [
  { figureId: 'fig-kongzi', name: '孔子', title: '至圣先师', dynasty: 'xianqin', dynastyName: '春秋' },
  { figureId: 'fig-simqian', name: '司马迁', title: '太史公', dynasty: 'han', dynastyName: '西汉' },
  { figureId: 'fig-caocao', name: '曹操', title: '魏武帝', dynasty: 'han', dynastyName: '东汉末' },
  { figureId: 'fig-taoqian', name: '陶渊明', title: '五柳先生', dynasty: 'weijin', dynastyName: '东晋' },
  { figureId: 'fig-libai', name: '李白', title: '诗仙', dynasty: 'tang', dynastyName: '盛唐' },
  { figureId: 'fig-baijuyi', name: '白居易', title: '诗魔', dynasty: 'tang', dynastyName: '中唐' },
  { figureId: 'fig-wuzetian', name: '武则天', title: '则天大圣皇帝', dynasty: 'tang', dynastyName: '武周' },
  { figureId: 'fig-sushi', name: '苏轼', title: '东坡居士', dynasty: 'song', dynastyName: '北宋' },
  { figureId: 'fig-liqingzhao', name: '李清照', title: '易安居士', dynasty: 'song', dynastyName: '两宋之交' },
  { figureId: 'fig-xinqiji', name: '辛弃疾', title: '词中之龙', dynasty: 'song', dynastyName: '南宋' },
  { figureId: 'fig-guanhanqing', name: '关汉卿', title: '已斋叟', dynasty: 'yuan', dynastyName: '元' },
  { figureId: 'fig-zhenghe', name: '郑和', title: '三保太监', dynasty: 'ming', dynastyName: '明' },
  { figureId: 'fig-wangyangming', name: '王阳明', title: '文成公', dynasty: 'ming', dynastyName: '明' },
  { figureId: 'fig-nalan', name: '纳兰性德', title: '容若', dynasty: 'qing', dynastyName: '清' },
  { figureId: 'fig-caoxueqin', name: '曹雪芹', title: '芹溪', dynasty: 'qing', dynastyName: '清' }
]

Page({
  data: {
    statusBarHeight: 20,
    activeTab: 0, // 0雁书 1记录 2藏馆
    // 雁书Tab
    carrierIndex: 0,
    carriers: CARRIERS,
    dynasties: DYNASTIES,
    selectedDynasty: 'tang',
    figures: [],
    allFigures: [],
    selectedFigureId: '',
    selectedFigureName: '',
    letterContent: '',
    canSend: false,
    sending: false,
    // 记录Tab
    letters: [],
    travelingLetters: [],
    arrivedLetters: [],
    unreadCount: 0,
    // 藏馆Tab
    giftFilter: 'all',
    giftFilters: GIFT_FILTERS,
    collectedGifts: [],
    lockedGifts: [],
    collectionStats: { collected: 0, total: 0, rare: 0, completion: 0 },
    // 弹窗
    showDetail: false,
    detailLetter: null,
    // 倒计时
    countdownTimers: {}
  },

  onLoad() {
    const sysInfo = app.globalData || {}
    this.setData({ statusBarHeight: sysInfo.statusBarHeight || 20 })
    this.loadStaticData()
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
    this.loadLetters()
    if (this.data.activeTab === 2) this.loadCollection()
    this.startCountdownLoop()
  },

  onHide() {
    this.clearCountdownLoop()
  },

  onUnload() {
    this.clearCountdownLoop()
  },

  // 加载静态数据（人物列表），云端失败时使用本地兜底
  async loadStaticData() {
    const cached = storage.get('yan_figures')
    if (cached && Array.isArray(cached.figures) && cached.figures.length) {
      this.setData({ allFigures: cached.figures, dynasties: cached.dynasties || DYNASTIES })
      this.filterFigures(this.data.selectedDynasty)
    } else if (!this.data.allFigures.length) {
      this.setData({ allFigures: FALLBACK_FIGURES })
      this.filterFigures(this.data.selectedDynasty)
    }
    try {
      const data = await requestCloud('yan', 'figures', {}, { throwError: false })
      if (data && Array.isArray(data.figures) && data.figures.length) {
        this.setData({ allFigures: data.figures, dynasties: data.dynasties || DYNASTIES })
        storage.set('yan_figures', data, 3600)
        this.filterFigures(this.data.selectedDynasty)
      }
    } catch (e) {}
  },

  // 按朝代筛选人物
  filterFigures(dynasty) {
    let figures
    if (dynasty === 'random') {
      figures = []
    } else {
      figures = this.data.allFigures
        .filter(f => f.dynasty === dynasty)
        .map(f => ({ ...f, avatarEmoji: figureEmoji(f.figureId) }))
    }
    const selectedFigureId = figures.length ? figures[0].figureId : ''
    const selectedFigureName = figures.length ? figures[0].name : ''
    this.setData({ figures, selectedFigureId, selectedFigureName })
    this.updateCanSend()
  },

  // ====== Tab 切换 ======
  switchTab(e) {
    // dataset 可能为字符串，统一转数字避免严格比较失效
    const idx = Number(e.currentTarget.dataset.idx)
    if (idx === this.data.activeTab) return
    this.setData({ activeTab: idx })
    if (idx === 1) this.loadLetters()
    if (idx === 2) this.loadCollection()
  },

  // ====== 返回 ======
  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/discover/index' }) })
  },

  // ====== 鸿雁切换 ======
  switchCarrier(e) {
    const dir = e.currentTarget.dataset.dir
    let idx = this.data.carrierIndex + Number(dir)
    if (idx < 0) idx = CARRIERS.length - 1
    if (idx >= CARRIERS.length) idx = 0
    this.setData({ carrierIndex: idx })
  },

  onCarrierSwiperChange(e) {
    this.setData({ carrierIndex: e.detail.current })
  },

  goCarrier(e) {
    this.setData({ carrierIndex: Number(e.currentTarget.dataset.idx) })
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

  updateCanSend() {
    const { letterContent, selectedFigureId, selectedDynasty } = this.data
    const hasContent = letterContent.trim().length > 0
    const hasFigure = selectedFigureId || selectedDynasty === 'random'
    this.setData({ canSend: hasContent && hasFigure })
  },

  // ====== 发送雁书 ======
  async sendLetter() {
    const { canSend, carrierIndex, selectedDynasty, selectedFigureId, letterContent } = this.data
    if (!canSend || this.data.sending) return

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
        this.setData({
          letterContent: '',
          canSend: false,
          activeTab: 1,
          sending: false
        })
        this.loadLetters()
      } else {
        this.setData({ sending: false })
      }
    } catch (e) {
      this.setData({ sending: false })
    }
  },

  // ====== 加载记录 ======
  async loadLetters() {
    // 节流：生成回信中避免并发重复拉取
    if (this._loadingLetters) return
    this._loadingLetters = true
    try {
      const data = await requestCloud('yan', 'list', {}, { throwError: false })
      if (data) {
        const letters = data.letters || []
        // processing 视为旅途中展示，避免状态锁期间信件从列表消失
        const traveling = letters
          .filter(l => l.status === 'traveling' || l.status === 'processing')
          .map(l => ({
            ...l,
            avatarEmoji: carrierEmoji(l.carrier),
            sentAtText: this.formatTime(l.sentAt),
            remainText: this.formatCountdown(Math.max(0, l.arriveAt - Date.now())),
            progress: this.calcProgress(l)
          }))
        const arrived = letters
          .filter(l => l.status === 'arrived')
          .map(l => ({
            ...l,
            avatarEmoji: figureEmoji(l.figureId),
            arrivedAtText: this.formatTime(l.arriveAt)
          }))
        this.setData({
          letters,
          travelingLetters: traveling,
          arrivedLetters: arrived,
          unreadCount: data.unread || 0
        })
      }
    } catch (e) {} finally {
      this._loadingLetters = false
    }
  },

  formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const pad = n => (n < 10 ? '0' + n : n)
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  },

  calcProgress(l) {
    if (!l.arriveAt || !l.sentAt) return 0
    const now = Date.now()
    return Math.min(100, Math.round(((now - l.sentAt) / (l.arriveAt - l.sentAt)) * 100))
  },

  // ====== 倒计时循环 ======
  startCountdownLoop() {
    this.clearCountdownLoop()
    this._countdownTimer = setInterval(() => {
      if (this.data.travelingLetters.length === 0) return
      const now = Date.now()
      const updated = this.data.travelingLetters.map(l => {
        const remain = Math.max(0, l.arriveAt - now)
        const progress = l.arriveAt > l.sentAt ? Math.min(100, ((now - l.sentAt) / (l.arriveAt - l.sentAt)) * 100) : 100
        return { ...l, remainText: this.formatCountdown(remain), progress: Math.round(progress) }
      })
      this.setData({ travelingLetters: updated })
      // 检查是否有信件到期
      const arrived = updated.filter(l => l.remainText === '已到达')
      if (arrived.length > 0) {
        this.loadLetters()
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
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    if (m > 0) return `${m}:${String(sec).padStart(2, '0')}`
    return `${sec}秒`
  },

  // ====== 查看信件详情 ======
  async viewLetter(e) {
    const { id } = e.currentTarget.dataset
    try {
      const data = await requestCloud('yan', 'detail', { letterId: id }, { throwError: false })
      if (data) {
        this.setData({
          showDetail: true,
          detailLetter: { ...data, avatarEmoji: figureEmoji(data.figureId) }
        })
        if (data.status === 'arrived' && !data.read) {
          // 标记已读后同步本地列表与未读角标，避免返回列表仍显示未读
          requestCloud('yan', 'read', { letterId: id }, { throwError: false })
          this.syncReadLocal(id)
        }
      }
    } catch (e) {}
  },

  // 本地同步已读状态
  syncReadLocal(letterId) {
    const arrivedLetters = this.data.arrivedLetters.map(l =>
      l._id === letterId ? { ...l, read: true } : l
    )
    const unreadCount = arrivedLetters.filter(l => !l.read).length
    this.setData({ arrivedLetters, unreadCount })
  },

  closeDetail() {
    this.setData({ showDetail: false, detailLetter: null })
  },

  // ====== 领取风物 ======
  async claimGift(e) {
    const { id } = e.currentTarget.dataset
    try {
      const data = await requestCloud('yan', 'claim', { letterId: id }, { showLoading: true, loadingText: '收入藏馆...' })
      if (data) {
        wx.showToast({ title: '已收入藏馆', icon: 'success' })
        // 同步详情弹窗与列表的领取状态
        const detailLetter = this.data.detailLetter
          ? { ...this.data.detailLetter, claimed: true }
          : null
        const arrivedLetters = this.data.arrivedLetters.map(l =>
          l._id === id ? { ...l, claimed: true } : l
        )
        this.setData({ showDetail: false, detailLetter, arrivedLetters })
        // 藏馆数据惰性刷新：下次切到藏馆 Tab 时 loadCollection 会拉取
      }
    } catch (e) {}
  },

  // ====== 加载藏馆 ======
  async loadCollection() {
    try {
      const data = await requestCloud('yan', 'collection', { filter: this.data.giftFilter }, { throwError: false })
      if (data) {
        this.setData({
          collectedGifts: data.collected || [],
          lockedGifts: data.locked || [],
          collectionStats: data.stats || { collected: 0, total: 0, rare: 0, completion: 0 }
        })
      }
    } catch (e) {}
  },

  // ====== 藏馆筛选 ======
  filterGifts(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ giftFilter: key })
    this.loadCollection()
  },

  // 阻止冒泡
  stopProp() {}
})
