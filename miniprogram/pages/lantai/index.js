const { requestCloud } = require('../../utils/cloudRequest')
const { getDynastyInfo } = require('../../utils/date')
const { storage } = require('../../utils/storage')
const loginGuard = require('../../utils/loginGuard')

function buildGroups(list) {
  const map = {}
  list.forEach(f => {
    const letter = (f.initial || '#').toUpperCase()
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

Page({
  data: {
    tab: 'figures',
    figures: [],
    groups: [],
    letters: [],
    toLetter: '',
    books: [],
    searchText: '',
    loading: true,
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
    try {
      let figures
      if (!force) {
        const cached = storage.get('figures')
        if (cached) figures = cached
      }
      if (!figures) {
        const data = await requestCloud('shiji', 'figures', {}, { throwError: false })
        figures = Array.isArray(data) ? data : []
        if (figures.length) storage.set('figures', figures, 86400)
      }
      this.applyFilter(figures)
    } catch (e) {
      this.setData({ figures: [], groups: [], letters: [], loading: false, loadError: true })
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
    const cached = !force ? storage.get('books') : null
    if (cached) {
      this.setData({ books: cached })
      return
    }
    try {
      const data = await requestCloud('shiji', 'books', {}, { throwError: false })
      const books = Array.isArray(data) ? data : []
      if (books.length) storage.set('books', books, 86400)
      this.setData({ books })
    } catch (e) {
      this.setData({ books: [] })
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab })
  },

  onSearchInput(e) {
    this.setData({ searchText: e.detail.value })
    this.applyFilter(this.data.figures)
  },

  onLetterTap(e) {
    const letter = e.currentTarget.dataset.letter
    this.setData({ toLetter: 'letter-' + letter })
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
