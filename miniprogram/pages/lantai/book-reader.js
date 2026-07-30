const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')
const loginGuard = require('../../utils/loginGuard')

// 把各种可能结构的注释（按段分组 / 键名不一 / 纯对象）统一展平为 [{keyword, note}]
function normalizeNotes(raw) {
  if (!raw || !Array.isArray(raw)) return []
  const out = []
  function pushKV(keyword, note) {
    if (!keyword && !note) return
    out.push({ keyword: String(keyword || '').slice(0, 50), note: String(note || '').slice(0, 500) })
  }
  function collectFromObject(obj, fallbackKey) {
    if (!obj || typeof obj !== 'object') return false
    // 标准结构 1: {keyword/term/name: string, note/definition/meaning/desc/text: string}
    const keyField = typeof obj.keyword === 'string' ? obj.keyword
      : typeof obj.term === 'string' ? obj.term
      : typeof obj.name === 'string' ? obj.name : ''
    const valField = typeof obj.note === 'string' ? obj.note
      : typeof obj.definition === 'string' ? obj.definition
      : typeof obj.meaning === 'string' ? obj.meaning
      : typeof obj.desc === 'string' ? obj.desc
      : typeof obj.text === 'string' ? obj.text : ''
    if ((keyField || fallbackKey) && valField) {
      pushKV(keyField || fallbackKey || '', valField)
      return true
    }
    // 按段分组: {keyword: "第N段", note: [{term,text}/...]} 或 {paragraph, items:[...]}
    const sectionTitle = typeof obj.keyword === 'string' ? obj.keyword
      : obj.paragraph !== undefined ? '第' + obj.paragraph + '段'
      : typeof obj.section === 'string' ? obj.section
      : typeof obj.title === 'string' ? obj.title : ''
    const itemsArray = Array.isArray(obj.note) ? obj.note
      : Array.isArray(obj.items) ? obj.items
      : Array.isArray(obj.list) ? obj.list
      : Array.isArray(obj.notes) ? obj.notes : null
    if (itemsArray) {
      itemsArray.forEach((item) => {
        let termKey = ''
        let termVal = ''
        if (typeof item === 'string') {
          termVal = item
        } else if (item && typeof item === 'object') {
          termKey = typeof item.term === 'string' ? item.term
            : typeof item.keyword === 'string' ? item.keyword
            : typeof item.name === 'string' ? item.name : ''
          termVal = typeof item.text === 'string' ? item.text
            : typeof item.note === 'string' ? item.note
            : typeof item.definition === 'string' ? item.definition
            : typeof item.meaning === 'string' ? item.meaning
            : typeof item.desc === 'string' ? item.desc : ''
          // 如果子项本身还有数组，回退 normalizeSingle
          if (!termVal && (Array.isArray(item.note) || Array.isArray(item.items) || Array.isArray(item.notes))) {
            normalizeSingle(item, sectionTitle ? (sectionTitle + '｜' + termKey) : fallbackKey)
            return
          }
        }
        const finalKey = sectionTitle
          ? (termKey ? (sectionTitle + '·' + termKey) : sectionTitle)
          : (termKey || fallbackKey || '')
        if (finalKey || termVal) {
          pushKV(finalKey, termVal)
        }
      })
      return true
    }
    // { [keyword]: note } 纯对象字典
    const keys = Object.keys(obj).filter(k => typeof obj[k] === 'string' && !['keyword','term','name','note','definition','meaning','desc','text','paragraph','section','items','list','notes','title'].includes(k))
    if (keys.length >= 1) {
      keys.forEach(k => pushKV(k, obj[k]))
      return true
    }
    // 对象里有字符串字段但没命中以上任何模式，兜底拼接
    const strs = Object.keys(obj).filter(k => typeof obj[k] === 'string').map(k => obj[k])
    if (strs.length >= 1) {
      pushKV(fallbackKey || obj.keyword || obj.term || obj.name || '注释', strs.join('；').slice(0, 300))
      return true
    }
    return false
  }
  function normalizeSingle(item, fallbackKey) {
    if (item === null || item === undefined) return
    if (typeof item === 'string') {
      pushKV(fallbackKey || '', item)
      return
    }
    if (Array.isArray(item)) {
      item.forEach((sub, i) => normalizeSingle(sub, fallbackKey ? (fallbackKey + '-' + (i + 1)) : ''))
      return
    }
    if (typeof item === 'object') {
      if (collectFromObject(item, fallbackKey)) return
      // 兜底：把所有字符串值拼起来
      const bits = Object.values(item).filter(v => typeof v === 'string')
      if (bits.length) pushKV(fallbackKey || '注释', bits.join('；').slice(0, 300))
      else pushKV(fallbackKey || '注释', JSON.stringify(item).slice(0, 200))
    }
  }
  raw.forEach((item, i) => normalizeSingle(item, ''))
  return out
}

Page({
  data: {
    bookId: 'shiji',
    bookTitle: '史记',
    chapters: [],
    chaptersLoading: true,
    currentChapter: null,
    currentChapterId: '',
    showTranslation: false,
    content: { original: '', translation: '', notes: [] },
    fontSize: 30,
    isFavorite: false,
    safeBottom: 0,
    scrollProgress: 0,
    hasPrev: false,
    hasNext: false
  },

  onLoad(options) {
    const id = options.id || 'shiji'
    const title = decodeURIComponent(options.title || '史记')
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ safeBottom: sys.safeAreaInsets ? sys.safeAreaInsets.bottom : 0 })
      this._windowHeight = sys.windowHeight
    } catch (e) {}
    wx.setNavigationBarTitle({ title })
    this.setData({ bookId: id, bookTitle: title })
    const savedFont = storage.get('reader_fontSize')
    if (savedFont) this.setData({ fontSize: savedFont })
    this.loadChapters(id)
    this.loadFavoriteStatus(id)
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  onPageScroll(e) {
    this._scrollTop = e.scrollTop
    if (this.data.currentChapter && this._maxScroll > 0) {
      const pct = Math.min(100, Math.round(e.scrollTop / this._maxScroll * 100))
      if (pct > this.data.scrollProgress) {
        this.setData({ scrollProgress: pct })
      }
    }
  },

  onBackPress() {
    if (this.data.currentChapter) {
      this.backToCatalog()
      return true
    }
    return false
  },

  onNavBack() {
    if (this.data.currentChapter) {
      this.backToCatalog()
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

  async openChapter(e) {
    const id = e.currentTarget.dataset.id
    await this.loadChapter(id)
    this._catalogScrollTop = this._scrollTop || 0
  },

  async loadChapter(id) {
    const chapter = this.data.chapters.find(c => c.id === id)
    if (!chapter) return

    let content = storage.get('content_' + id)
    if (!content) {
      const data = await requestCloud('shiji', 'chapter-content', { chapterId: id }, { showLoading: true, loadingText: '加载正文...', throwError: false })
      content = (data && data.content) || { original: '', translation: '', notes: [] }
      if (data && data.content) storage.set('content_' + id, content, 86400)
    }

    const idx = this.data.chapters.findIndex(c => c.id === id)
    const progressKey = 'chapters_progress_' + this.data.bookId
    const savedProgress = storage.get(progressKey) || {}
    const savedScroll = savedProgress[id + '_scroll'] || 0

    this.setData({
      currentChapter: chapter,
      currentChapterId: id,
      scrollProgress: chapter.progress || 0,
      hasPrev: idx > 0,
      hasNext: idx < this.data.chapters.length - 1,
      content: {
        original: content.original || '',
        translation: content.translation || '',
        notes: normalizeNotes(content.notes)
      }
    })

    wx.pageScrollTo({ scrollTop: 0, duration: 0 })

    setTimeout(() => {
      wx.createSelectorQuery()
        .select('.content-wrap')
        .boundingClientRect(rect => {
          if (rect && rect.height > 0) {
            const navOffset = rect.top
            this._maxScroll = rect.height + navOffset - this._windowHeight
            if (this._maxScroll < 0) this._maxScroll = 0

            if (savedScroll > 0 && this._maxScroll > 0) {
              const restoreTop = Math.min(savedScroll, this._maxScroll)
              wx.pageScrollTo({ scrollTop: restoreTop, duration: 300 })
            }
          }
        })
        .exec()
    }, 400)
  },

  async prevChapter() {
    if (!this.data.hasPrev) return
    const idx = this.data.chapters.findIndex(c => c.id === this.data.currentChapterId)
    if (idx <= 0) return
    this.saveCurrentScrollProgress()
    await this.loadChapter(this.data.chapters[idx - 1].id)
  },

  async nextChapter() {
    if (!this.data.hasNext) return
    const idx = this.data.chapters.findIndex(c => c.id === this.data.currentChapterId)
    if (idx < 0 || idx >= this.data.chapters.length - 1) return
    this.saveCurrentScrollProgress()
    await this.loadChapter(this.data.chapters[idx + 1].id)
  },

  saveCurrentScrollProgress() {
    const chapterId = this.data.currentChapterId
    if (!chapterId) return
    const progressKey = 'chapters_progress_' + this.data.bookId
    const savedProgress = storage.get(progressKey) || {}
    const chapter = this.data.chapters.find(c => c.id === chapterId)
    const currentProgress = chapter ? chapter.progress : 0
    const scrollPct = this.data.scrollProgress
    const finalProgress = Math.max(currentProgress, scrollPct)
    savedProgress[chapterId] = finalProgress
    savedProgress[chapterId + '_scroll'] = this._scrollTop || 0
    storage.set(progressKey, savedProgress, 86400 * 30)
    this.updateChapterProgress(chapterId, finalProgress)
  },

  backToCatalog() {
    this.saveCurrentScrollProgress()

    this._maxScroll = 0
    this.setData({ currentChapter: null, currentChapterId: '', scrollProgress: 0 })

    setTimeout(() => {
      wx.pageScrollTo({
        scrollTop: this._catalogScrollTop || 0,
        duration: 0
      })
    }, 100)
  },

  toggleTranslation() {
    this.setData({ showTranslation: !this.data.showTranslation })
  },

  changeFontSize(e) {
    const type = e.currentTarget.dataset.type
    const cur = this.data.fontSize
    const next = type === 'plus' ? Math.min(44, cur + 2) : Math.max(22, cur - 2)
    this.setData({ fontSize: next })
    storage.set('reader_fontSize', next)
  },

  updateChapterProgress(chapterId, progress) {
    const chapters = this.data.chapters.map(c => {
      if (c.id === chapterId) {
        return { ...c, progress, read: progress >= 80 }
      }
      return c
    })
    const progressKey = 'chapters_progress_' + this.data.bookId
    const savedProgress = storage.get(progressKey) || {}
    savedProgress[chapterId] = progress
    storage.set(progressKey, savedProgress, 86400 * 30)
    storage.set('chapters_' + this.data.bookId, chapters, 86400)
    this.setData({ chapters })
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
