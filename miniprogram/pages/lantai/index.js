const { db, _ } = require('../../utils/db')
const { getDynastyInfo } = require('../../utils/date')
const { storage } = require('../../utils/storage')
const loginGuard = require('../../utils/loginGuard')
const { getPinyinInitial } = require('../../utils/pinyin')
const { requestCloud } = require('../../utils/cloudRequest')

const PAGE_SIZE = 20
const FIGURES_CACHE_KEY = 'figures_star5_v5'
const BOOKS_CACHE_KEY = 'books_v3'
const CACHE_TTL_SECONDS = 86400

function normalizeAssetUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//.test(url) || /^cloud:\/\//.test(url)) return url
  if (url.startsWith('/api/asset/')) return `https://timeslip.work${url}`
  return ''
}

function normalizeFigure(f) {
  const id = f.id || f._id
  const name = f.name || f.figureName || ''
  return {
    ...f,
    _id: id,
    id,
    figureId: id,
    figureName: name,
    name,
    title: f.identity || f.title || '',
    bio: f.bio_summary || f.bio || '',
    avatar: normalizeAssetUrl(f.mini_avatar_url || f.avatar_url || f.avatar),
    // 不用数据库存的 f.initial 字段做首选——历史版本用 localeCompare('zh-Hans-CN') 算，
    // 真机上会退化成 Unicode 码点比较，导致"刘(L)被判定成 J"等错误。
    // 强制用 pinyin.js 的 COMMON_CHAR_MAP 硬编码重新计算，保证真模 100% 一致。
    initial: (getPinyinInitial(name) || (f.initial && f.initial.toUpperCase()) || '#').toUpperCase()
  }
}

function normalizeBook(b) {
  return {
    ...b,
    _id: b._id || b.id,
    id: b.id || b._id,
    title: b.name || b.title || '',
    author: b.author || '',
    dynasty: b.dynasty || b.dynastyName || '',
    chapters: b.volume_count || b.chapters || 0,
    desc: b.type ? `${b.type} · ${b.status === 'active' ? '已收录' : '整理中'}` : (b.desc || '')
  }
}

async function loadAll(queryFactory, pageSize = PAGE_SIZE, max = 300) {
  const all = []
  for (let skip = 0; skip < max; skip += pageSize) {
    const res = await queryFactory()
      .skip(skip)
      .limit(pageSize)
      .get()
    const rows = res.data || []
    Array.prototype.push.apply(all, rows)
    if (rows.length < pageSize) break
  }
  return all
}

function buildGroups(list) {
  const map = {}
  list.forEach(f => {
    const letter = (getPinyinInitial(f.name || f.figureName) || f.initial || '#').toUpperCase()
    if (!map[letter]) map[letter] = []
    map[letter].push({
      ...f,
      dynastyInfo: getDynastyInfo(f.dynasty)
    })
  })
  const letters = Object.keys(map).sort((a, b) => {
    if (a === '#') return 1
    if (b === '#') return -1
    return a < b ? -1 : 1
  })
  return letters.map(letter => ({ letter, items: map[letter] }))
}

// 影响 UI 的关键字段
const FIGURE_KEY_FIELDS = ['_id', 'figureId', 'name', 'avatar', 'title', 'dynasty', 'initial', 'bio']
const BOOK_KEY_FIELDS = ['_id', 'id', 'title', 'author', 'dynasty', 'chapters', 'desc', 'cover_url']

// O(n) 对比：用 _id 建 Map 索引，逐项字段对比，短路返回，不创建临时对象
function listEqualByKey(a, b, fields) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  const mapB = new Map()
  for (let i = 0; i < b.length; i++) {
    mapB.set(String(b[i]._id), b[i])
  }
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i]
    const itemB = mapB.get(String(itemA._id))
    if (!itemB) return false
    for (let j = 0; j < fields.length; j++) {
      if (itemA[fields[j]] !== itemB[fields[j]]) return false
    }
  }
  return true
}

Page({
  data: {
    tab: 'figures',
    figures: [],
    groups: [],
    letters: [],
    toLetter: '',
    books: [],
    filteredBooks: [],
    searchText: '',
    figuresLoading: true,
    booksLoading: true,
    // 使用 scroll-view 自带的 refresher 做下拉刷新
    figureRefresherTriggered: false,
    bookRefresherTriggered: false,
    loadError: false,
    isLoggedIn: false
  },

  // 刷新互斥锁，避免短时间多次触发重复请求
  _refreshingFigures: false,
  _refreshingBooks: false,

  onLoad() {
    this.cleanupLegacyCacheOnce()
    this.loadFigures()
    this.loadBooks()
    this.unlockFirstVisit()
  },

  unlockFirstVisit() {
    requestCloud('getUser', 'unlockAchievement', { key: 'first_visit' }, { throwError: false })
      .catch(() => {})
  },

  // 一次性清理历史遗留缓存（解决手机端永远显示旧人物列表的问题）
  // 包括：无 TTL 的裸键、旧版本带号缓存、旧 detail 前缀等
  cleanupLegacyCacheOnce() {
    const CLEANUP_FLAG = 'lantai_cache_cleanup_done_v20260731'
    if (storage.get(CLEANUP_FLAG)) return
    try {
      const info = wx.getStorageInfoSync()
      const PREFIX = 'timeslip_'
      // 要清除的缓存键名模式（不含 PREFIX）
      const patterns = [
        // 人物：裸键 + 旧版本（v1~v4 都清，v5 是当前新版）
        /^figures$/,
        /^figures_star5_v[1-4]$/,
        // 典籍：裸键 + 旧版本（v1~v2）
        /^books$/,
        /^books_v[1-2]$/,
        // 旧版人物详情裸前缀 figure_ / figure_v1_
        /^figure_v1_/,
        // DNA 裸键
        /^dna_questions$/,
        // 通用公共缓存：figures 裸键已在上面，这里再补 app 预加载的其他裸键
      ]
      const removed = []
      info.keys.forEach(k => {
        if (!k.startsWith(PREFIX)) return
        const rawKey = k.slice(PREFIX.length)
        // CLEANUP_FLAG 自己不要删
        if (rawKey === CLEANUP_FLAG) return
        // userInfo / user_info 不要删，否则会把登录态清掉（chat/room 还依赖 user_info 兜底）
        if (rawKey === 'userInfo' || rawKey === 'user_info') return
        // 聊天会话和聊天消息、阅读进度、字体设置等用户数据不要碰
        if (
          rawKey.startsWith('chat_') ||
          rawKey.startsWith('sessions') ||
          rawKey.startsWith('reader_') ||
          rawKey.startsWith('chapters_') ||
          rawKey.startsWith('content_') ||
          rawKey.startsWith('progress_') ||
          rawKey.startsWith('app_settings') ||
          rawKey.startsWith('pigeon_') ||
          rawKey.startsWith('memorial_') ||
          rawKey.startsWith('letters') ||
          rawKey.startsWith('yan_')
        ) return
        // 匹配模式即删除；对于 figures_star5_v* 和 books_v*，直接按前缀扫（比模式匹配更保险）
        const matchedByPattern = patterns.some(p => p.test(rawKey))
        const matchedByPrefix =
          rawKey.startsWith('figures_star5_v') ||
          rawKey.startsWith('books_v') ||
          rawKey.startsWith('figure_')
        if (matchedByPattern || matchedByPrefix) {
          try {
            wx.removeStorageSync(k)
            removed.push(rawKey)
          } catch (_) {}
        }
      })
      storage.set(CLEANUP_FLAG, true, 0) // 永久标记已清理
    } catch (e) {
      // 静默失败，不影响主流程
    }
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 1)
    this.setData({ isLoggedIn: loginGuard.isLoggedIn() })
  },

  // 人物列表的 scroll-view 下拉刷新
  async onFigureRefresherRefresh() {
    // 先把状态切到 true 让下拉动画出现（有时组件会自己切，但手动保险）
    this.setData({ figureRefresherTriggered: true })
    await this._refreshFigures(true)
    this.setData({ figureRefresherTriggered: false })
  },

  // 典籍列表的 scroll-view 下拉刷新
  async onBookRefresherRefresh() {
    this.setData({ bookRefresherTriggered: true })
    await this._refreshBooks(true)
    this.setData({ bookRefresherTriggered: false })
  },

  async _refreshFigures(force) {
    if (this._refreshingFigures) return
    this._refreshingFigures = true
    try {
      await this.loadFigures(force)
    } finally {
      this._refreshingFigures = false
    }
  },

  async _refreshBooks(force) {
    if (this._refreshingBooks) return
    this._refreshingBooks = true
    try {
      await this.loadBooks(force)
    } finally {
      this._refreshingBooks = false
    }
  },

  async loadFigures(force = false) {
    const cached = storage.get(FIGURES_CACHE_KEY)

    if (cached && !force) {
      this.applyFilter(cached)
      // 后台静默刷新，不打扰用户（不再使用 refreshing 状态，避免 UI 抖动）
      this.fetchAndUpdateFigures()
      return
    }

    await this.fetchAndUpdateFigures()
  },

  async fetchAndUpdateFigures() {
    try {
      const rows = await loadAll(
        () => db.collection('figures')
          .where({ star: _.eq(5) }),
        PAGE_SIZE,
        200
      )
      const newFigures = rows
        .map(normalizeFigure)
        .sort((a, b) => {
          const initA = a.initial || '#'
          const initB = b.initial || '#'
          if (initA !== initB) return initA < initB ? -1 : 1
          return (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN')
        })

      const cached = storage.get(FIGURES_CACHE_KEY) || []
      const unchanged = listEqualByKey(newFigures, cached, FIGURE_KEY_FIELDS)

      if (newFigures.length) {
        storage.set(FIGURES_CACHE_KEY, newFigures, CACHE_TTL_SECONDS)
      }
      // 无论数据是否变化，都要刷新 UI 状态（loading、refresherTriggered 等）
      if (!unchanged) {
        this.applyFilter(newFigures)
      } else {
        // 数据未变时，手动更新 loading/refresher 状态，避免 UI 卡在「加载中」或下拉动画不消失
        this.setData({
          figuresLoading: false,
          loadError: false,
          figureRefresherTriggered: false
        })
      }
    } catch (e) {
      if (!this.data.figures.length) {
        this.setData({ figures: [], groups: [], letters: [], loadError: true })
      }
    } finally {
      this.setData({ figureRefresherTriggered: false })
    }
  },

  applyFilter(figures) {
    const { searchText } = this.data
    let list = (figures || []).slice()
    if (searchText) {
      const kw = searchText.toLowerCase()
      list = list.filter(f =>
        (f.name || '').toLowerCase().includes(kw) ||
        (f.title || '').toLowerCase().includes(kw) ||
        (f.bio || '').toLowerCase().includes(kw)
      )
    }
    const groups = buildGroups(list)
    this.setData({
      figures,
      groups,
      letters: groups.map(g => g.letter),
      figuresLoading: false,
      loadError: false
    })
  },

  async loadBooks(force = false) {
    const cached = storage.get(BOOKS_CACHE_KEY)

    if (cached && !force) {
      this.setData({ books: cached, booksLoading: false })
      this.filterBooks(this.data.searchText)
      this.fetchAndUpdateBooks()
      return
    }

    await this.fetchAndUpdateBooks()
  },

  async fetchAndUpdateBooks() {
    try {
      const rows = await loadAll(
        () => db.collection('books').orderBy('sort_order', 'asc'),
        PAGE_SIZE,
        100
      )
      const newBooks = rows.map(normalizeBook)

      const cached = storage.get(BOOKS_CACHE_KEY) || []
      const unchanged = listEqualByKey(newBooks, cached, BOOK_KEY_FIELDS)

      if (newBooks.length) {
        storage.set(BOOKS_CACHE_KEY, newBooks, CACHE_TTL_SECONDS)
      }
      // 无论数据是否变化，都要刷新 UI 状态
      if (!unchanged) {
        this.setData({ books: newBooks, booksLoading: false })
        this.filterBooks(this.data.searchText)
      } else {
        this.setData({ booksLoading: false, bookRefresherTriggered: false })
      }
    } catch (e) {
      if (!this.data.books.length) {
        this.setData({ books: [], booksLoading: false })
        this.filterBooks(this.data.searchText)
      }
    } finally {
      this.setData({ bookRefresherTriggered: false })
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab })
  },

  onSearchInput(e) {
    const searchText = e.detail.value
    this.setData({ searchText })
    this.applyFilter(this.data.figures)
    this.filterBooks(searchText)
  },

  filterBooks(keyword) {
    if (!keyword) {
      this.setData({ filteredBooks: this.data.books })
      return
    }
    const kw = keyword.toLowerCase()
    const filtered = (this.data.books || []).filter(b =>
      (b.title || '').toLowerCase().includes(kw) ||
      (b.author || '').toLowerCase().includes(kw) ||
      (b.desc || '').toLowerCase().includes(kw)
    )
    this.setData({ filteredBooks: filtered })
  },

  onLetterTap(e) {
    const letter = e.currentTarget.dataset.letter
    this.setData({ toLetter: '' })
    wx.nextTick(() => {
      this.setData({ toLetter: 'letter-' + letter })
    })
  },

  onFigureTap(e) {
    const id = e.currentTarget.dataset.id
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/index' })
      return
    }
    wx.navigateTo({
      url: `/pages/lantai/figure-detail?id=${id}`
    })
  },

  onBookTap(e) {
    const id = e.currentTarget.dataset.id
    const book = this.data.books.find(b => b.id === id)
    if (!book) return
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/index' })
      return
    }
    wx.navigateTo({
      url: `/pages/lantai/book-reader?id=${id}&title=${encodeURIComponent(book.title)}`
    })
  }
})
