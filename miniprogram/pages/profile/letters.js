const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')
const { formatRelative, formatChatTime } = require('../../utils/date')
const loginGuard = require('../../utils/loginGuard')

const FILTERS = [
  { key: 'all', name: '全部' },
  { key: 'simaqian', name: '司马迁' },
  { key: 'libai', name: '李白' },
  { key: 'sushi', name: '苏轼' },
  { key: 'zhugeliang', name: '诸葛亮' },
  { key: 'other', name: '其他' }
]

// pigeon 集合不存储 figureTitle，前端补充
const FIGURE_TITLES = {
  libai: '诗仙',
  sushi: '东坡居士',
  xiangyu: '西楚霸王',
  caocao: '魏武帝',
  wuzetian: '则天大圣皇帝',
  mulan: '巾帼英雄',
  simaqian: '太史公',
  kongzi: '儒家圣人',
  zhenghe: '三保太监',
  baijuyi: '诗魔'
}

Page({
  data: {
    letters: [],
    filteredLetters: [],
    filterList: FILTERS,
    filter: 'all',
    totalCount: 0,
    figuresCount: 0,
    firstDate: '--'
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
    this.loadLetters()
  },

  async loadLetters() {
    // 先展示本地缓存
    let cached = storage.get('pigeon_letters') || []
    if (cached.length) {
      this.renderLetters(cached)
    }

    // 拉取云端数据
    try {
      const data = await requestCloud('pigeon', 'inbox', { type: 'all' }, { throwError: false })
      if (data && Array.isArray(data) && data.length) {
        const letters = this.pairLetters(data)
        storage.set('pigeon_letters', letters, 86400 * 30)
        this.renderLetters(letters)
      }
    } catch (e) {
      // 云端失败时保留缓存数据，不回退 mock
    }
  },

  // 将 outbox（去信）与 inbox（回信）配对组合成展示模型
  pairLetters(rawLetters) {
    const outbox = rawLetters.filter(l => l.type === 'outbox')
    const inbox = rawLetters.filter(l => l.type === 'inbox')
    const pairs = []
    const usedInbox = new Set()

    const toTs = (t) => {
      if (!t) return 0
      if (typeof t === 'number') return t
      const d = new Date(t)
      return isNaN(d.getTime()) ? 0 : d.getTime()
    }

    outbox.forEach(out => {
      // 找同 figureId 且时间最近的未使用 inbox
      const match = inbox
        .filter(i => i.figureId === out.figureId && !usedInbox.has(i._id))
        .sort((a, b) => Math.abs(toTs(a.createdAt) - toTs(out.createdAt)) - Math.abs(toTs(b.createdAt) - toTs(out.createdAt)))[0]

      if (match) {
        usedInbox.add(match._id)
        pairs.push({
          _id: match._id,
          figureId: out.figureId,
          figureName: out.figureName,
          figureTitle: FIGURE_TITLES[out.figureId] || '',
          content: out.content,
          replyContent: match.content,
          subject: out.subject || '',
          createdAt: toTs(match.createdAt) || toTs(out.createdAt)
        })
      } else {
        pairs.push({
          _id: out._id,
          figureId: out.figureId,
          figureName: out.figureName,
          figureTitle: FIGURE_TITLES[out.figureId] || '',
          content: out.content,
          replyContent: '',
          subject: out.subject || '',
          createdAt: toTs(out.createdAt)
        })
      }
    })

    // 兜底：未配对的 inbox 单独展示
    inbox.forEach(i => {
      if (!usedInbox.has(i._id)) {
        pairs.push({
          _id: i._id,
          figureId: i.figureId,
          figureName: i.figureName,
          figureTitle: FIGURE_TITLES[i.figureId] || '',
          content: '',
          replyContent: i.content,
          subject: i.subject || '',
          createdAt: toTs(i.createdAt)
        })
      }
    })

    return pairs
  },

  renderLetters(letters) {
    letters = letters
      .map(l => ({ ...l, displayTime: formatRelative(l.createdAt), expanded: false }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    const figureIds = new Set(letters.map(l => l.figureId))
    const earliest = letters.length ? formatChatTime(letters[letters.length - 1].createdAt).split(' ')[0] : '--'

    this.setData({
      letters,
      totalCount: letters.length,
      figuresCount: figureIds.size,
      firstDate: earliest
    }, () => this.applyFilter())
  },

  applyFilter() {
    const { letters, filter } = this.data
    let filtered = letters
    if (filter !== 'all') {
      if (filter === 'other') {
        const main = ['simaqian', 'libai', 'sushi', 'zhugeliang']
        filtered = letters.filter(l => !main.includes(l.figureId))
      } else {
        filtered = letters.filter(l => l.figureId === filter)
      }
    }
    this.setData({ filteredLetters: filtered })
  },

  selectFilter(e) {
    const { key } = e.currentTarget.dataset
    this.setData({ filter: key }, () => this.applyFilter())
  },

  toggleExpand(e) {
    const { id } = e.currentTarget.dataset
    const filtered = this.data.filteredLetters.map(l =>
      l._id === id ? { ...l, expanded: !l.expanded } : l
    )
    const letters = this.data.letters.map(l =>
      l._id === id ? { ...l, expanded: !l.expanded } : l
    )
    this.setData({ filteredLetters: filtered, letters })
  },

  writeAgain(e) {
    const figure = e.currentTarget.dataset.figure || {}
    wx.redirectTo({
      url: `/pages/discover/pigeon?figureId=${figure.figureId || ''}`
    })
  },

  deleteLetter(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      confirmText: '删除',
      confirmColor: '#FA5151',
      success: async (res) => {
        if (res.confirm) {
          // 调用云函数删除
          await requestCloud('pigeon', 'delete', { _id: id }, { throwError: false })
          // 更新本地缓存
          const letters = (storage.get('pigeon_letters') || []).filter(l => l._id !== id)
          storage.set('pigeon_letters', letters, 86400 * 30)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.renderLetters(letters)
        }
      }
    })
  },

  goPigeon() {
    wx.switchTab({
      url: '/pages/discover/index',
      success: () => {
        setTimeout(() => {
          wx.navigateTo({ url: '/pages/discover/pigeon' })
        }, 100)
      }
    })
  }
})
