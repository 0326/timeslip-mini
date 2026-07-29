const { db, _ } = require('../../utils/db')
const { getDynastyInfo } = require('../../utils/date')
const { storage } = require('../../utils/storage')
const loginGuard = require('../../utils/loginGuard')
const { getPinyinInitial } = require('../../utils/pinyin')

const PAGE_SIZE = 20
const FIGURES_CACHE_KEY = 'figures_star5_v4'
const BOOKS_CACHE_KEY = 'books_v2'
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
    initial: f.initial || getPinyinInitial(name) || '#',
    unlocked: true
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
    const letter = (f.initial || getPinyinInitial(f.name || f.figureName) || '#').toUpperCase()
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
    loading: true,
    refreshing: false,
    loadError: false,
    isLoggedIn: false
  },

  onLoad() {
    this.loadFigures()
    this.loadBooks()
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 1)
    this.setData({ isLoggedIn: loginGuard.isLoggedIn() })
  },

  onPullDownRefresh() {
    this.loadFigures(true)
    this.loadBooks(true)
  },

  async loadFigures(force = false) {
    const cached = storage.get(FIGURES_CACHE_KEY)

    if (cached && !force) {
      this.applyFilter(cached)
      this.setData({ refreshing: true })
      this.fetchAndUpdateFigures()
      return
    }

    this.setData({ refreshing: true })
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
      // 仅在数据有变化时刷新 UI，避免相同数据导致重渲染闪烁
      if (!unchanged) {
        this.applyFilter(newFigures)
      }
    } catch (e) {
      if (!this.data.figures.length) {
        this.setData({ figures: [], groups: [], letters: [], loadError: true })
      }
    } finally {
      this.setData({ refreshing: false })
      wx.stopPullDownRefresh()
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
      loading: false,
      loadError: false
    })
    wx.stopPullDownRefresh()
  },

  async loadBooks(force = false) {
    const cached = storage.get(BOOKS_CACHE_KEY)

    if (cached && !force) {
      this.setData({ books: cached })
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
      // 仅在数据有变化时刷新 UI
      if (!unchanged) {
        this.setData({ books: newBooks })
        this.filterBooks(this.data.searchText)
      }
    } catch (e) {
      if (!this.data.books.length) {
        this.setData({ books: [] })
        this.filterBooks(this.data.searchText)
      }
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
    const figure = this.data.figures.find(f => f._id === id) || {}
    // 未解锁 / 未登录 都给提示，但未登录引导去登录
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/index' })
      return
    }
    if (!figure.unlocked) {
      wx.showToast({ title: '该人物尚未解锁', icon: 'none' })
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
