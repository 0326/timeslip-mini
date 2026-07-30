const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')
const loginGuard = require('../../utils/loginGuard')

Page({
  data: {
    bookId: 'shiji',
    bookTitle: '史记',
    chapters: [],
    chaptersLoading: true,
    isFavorite: false
  },

  onLoad(options) {
    const id = options.id || 'shiji'
    const title = decodeURIComponent(options.title || '史记')
    wx.setNavigationBarTitle({ title })
    this.setData({ bookId: id, bookTitle: title })
    this.loadChapters(id)
    this.loadFavoriteStatus(id)
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
    const progressKey = 'chapters_progress_' + this.data.bookId
    const savedProgress = storage.get(progressKey) || {}
    const hasAnyProgress = Object.values(savedProgress).some(p => typeof p === 'number' && p > 0)
    if (hasAnyProgress && this.data.chapters.length) {
      const merged = this.data.chapters.map(c => ({
        ...c,
        progress: savedProgress[c.id] !== undefined ? savedProgress[c.id] : c.progress || 0,
        read: (savedProgress[c.id] || 0) >= 80
      }))
      this.setData({ chapters: merged })
    }
  },

  async loadChapters(id) {
    const progressKey = 'chapters_progress_' + id
    const savedProgress = storage.get(progressKey) || {}
    const cached = storage.get('chapters_' + id)
    if (cached) {
      const merged = cached.map(c => ({
        ...c,
        progress: savedProgress[c.id] !== undefined ? savedProgress[c.id] : 0,
        read: (savedProgress[c.id] || 0) >= 80
      }))
      this.setData({ chapters: merged, chaptersLoading: false })
      return
    }
    try {
      const data = await requestCloud('shiji', 'chapters', { bookId: id }, { throwError: false })
      const list = ((data && data.chapters) || []).map(c => ({
        ...c,
        progress: savedProgress[c.id] !== undefined ? savedProgress[c.id] : 0,
        read: (savedProgress[c.id] || 0) >= 80
      }))
      storage.set('chapters_' + id, list, 86400)
      this.setData({ chapters: list, chaptersLoading: false })
    } catch (e) {
      this.setData({ chapters: [], chaptersLoading: false })
    }
  },

  openChapter(e) {
    const id = e.currentTarget.dataset.id
    const idx = this.data.chapters.findIndex(c => c.id === id)
    if (idx < 0) return
    wx.navigateTo({
      url: `/pages/lantai/book-chapter?bookId=${this.data.bookId}`
        + `&bookTitle=${encodeURIComponent(this.data.bookTitle)}`
        + `&chapters=${encodeURIComponent(JSON.stringify(this.data.chapters))}`
        + `&chapterIndex=${idx}`
    })
  },

  async loadFavoriteStatus(bookId) {
    try {
      const data = await requestCloud('shiji', 'book-favorites', {}, { throwError: false })
      if (data && data.list) {
        const fav = data.list.some(b => b.bookId === bookId)
        this.setData({ isFavorite: fav })
      }
    } catch (e) {}
  },

  async toggleFavorite() {
    const bookId = this.data.bookId
    if (!bookId) return
    try {
      const data = await requestCloud('shiji', 'book-favoriteToggle', { bookId }, { throwError: false })
      if (data) {
        this.setData({ isFavorite: !!data.favorite })
        wx.showToast({ title: data.favorite ? '已收藏' : '已取消', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  }
})
