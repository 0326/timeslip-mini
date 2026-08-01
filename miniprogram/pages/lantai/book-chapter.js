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
    const keys = Object.keys(obj).filter(k => typeof obj[k] === 'string' && !['keyword','term','name','note','definition','meaning','desc','text','paragraph','section','items','list','notes','title'].includes(k))
    if (keys.length >= 1) {
      keys.forEach(k => pushKV(k, obj[k]))
      return true
    }
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
    bookTitle: '',
    chapters: [],
    chapterIndex: -1,
    currentChapter: null,
    currentChapterId: '',
    showTranslation: false,
    content: { original: '', translation: '', notes: [] },
    fontSize: 30,
    safeBottom: 0,
    scrollProgress: 0,
    hasPrev: false,
    hasNext: false
  },

  onLoad(options) {
    const bookId = options.bookId || 'shiji'
    const bookTitle = decodeURIComponent(options.bookTitle || '')
    const chapterIndex = options.chapterIndex !== undefined ? Number(options.chapterIndex) : -1
    const chapters = wx.getStorageSync(`book_chapters_${bookId}`) || []
    if (chapters.length) wx.removeStorageSync(`book_chapters_${bookId}`)

    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ safeBottom: sys.safeAreaInsets ? sys.safeAreaInsets.bottom : 0 })
      this._windowHeight = sys.windowHeight
    } catch (e) {}
    const savedFont = storage.get('reader_fontSize')
    if (savedFont) this.setData({ fontSize: savedFont })

    const targetChapter = chapters[chapterIndex]
    const navTitle = targetChapter ? targetChapter.title : bookTitle || '章节详情'
    wx.setNavigationBarTitle({ title: navTitle })

    this.setData({
      bookId,
      bookTitle,
      chapters,
      chapterIndex,
      hasPrev: chapterIndex > 0,
      hasNext: chapters.length > 0 && chapterIndex < chapters.length - 1
    })

    if (targetChapter) {
      this.loadChapter(targetChapter)
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' })
    }
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  onUnload() {
    this.saveCurrentScrollProgress()
  },

  onPageScroll(e) {
    this._scrollTop = e.scrollTop
    if (this._maxScroll > 0) {
      const pct = Math.min(100, Math.round(e.scrollTop / this._maxScroll * 100))
      if (pct > this.data.scrollProgress) {
        this.setData({ scrollProgress: pct })
      }
    }
  },

  async loadChapter(chapter) {
    const id = chapter.id
    let content = storage.get('content_' + id)
    if (!content) {
      const data = await requestCloud('shiji', 'chapter-content', { chapterId: id }, { showLoading: true, loadingText: '加载正文...', throwError: false })
      content = (data && data.content) || { original: '', translation: '', notes: [] }
      if (data && data.content) storage.set('content_' + id, content, 86400)
    }

    const progressKey = 'chapters_progress_' + this.data.bookId
    const savedProgress = storage.get(progressKey) || {}
    const savedScroll = savedProgress[id + '_scroll'] || 0
    const savedPct = savedProgress[id] || 0

    this.setData({
      currentChapter: chapter,
      currentChapterId: id,
      scrollProgress: savedPct,
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

  prevChapter() {
    if (!this.data.hasPrev) return
    this.saveCurrentScrollProgress()
    const newIdx = this.data.chapterIndex - 1
    const chapter = this.data.chapters[newIdx]
    if (!chapter) return
    this.setData({
      chapterIndex: newIdx,
      currentChapterId: chapter.id,
      currentChapter: chapter,
      hasPrev: newIdx > 0,
      hasNext: newIdx < this.data.chapters.length - 1,
      scrollProgress: 0
    })
    wx.setNavigationBarTitle({ title: chapter.title })
    this.loadChapter(chapter)
  },

  nextChapter() {
    if (!this.data.hasNext) return
    this.saveCurrentScrollProgress()
    const newIdx = this.data.chapterIndex + 1
    const chapter = this.data.chapters[newIdx]
    if (!chapter) return
    this.setData({
      chapterIndex: newIdx,
      currentChapterId: chapter.id,
      currentChapter: chapter,
      hasPrev: newIdx > 0,
      hasNext: newIdx < this.data.chapters.length - 1,
      scrollProgress: 0
    })
    wx.setNavigationBarTitle({ title: chapter.title })
    this.loadChapter(chapter)
  },

  saveCurrentScrollProgress() {
    const chapterId = this.data.currentChapterId
    if (!chapterId) return
    const progressKey = 'chapters_progress_' + this.data.bookId
    const savedProgress = storage.get(progressKey) || {}
    const scrollPct = this.data.scrollProgress
    const storedPct = savedProgress[chapterId] || 0
    const finalProgress = Math.max(storedPct, scrollPct)
    savedProgress[chapterId] = finalProgress
    savedProgress[chapterId + '_scroll'] = this._scrollTop || 0
    storage.set(progressKey, savedProgress, 86400 * 30)
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
  }
})
