const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')
const loginGuard = require('../../utils/loginGuard')

const MOCK_CHAPTERS = [
  { id: 'c1', title: '五帝本纪第一', subtitle: '史记卷一', read: true, progress: 100 },
  { id: 'c2', title: '夏本纪第二', subtitle: '史记卷二', read: false, progress: 0 },
  { id: 'c3', title: '殷本纪第三', subtitle: '史记卷三', read: false, progress: 0 },
  { id: 'c4', title: '周本纪第四', subtitle: '史记卷四', read: true, progress: 60 },
  { id: 'c5', title: '秦本纪第五', subtitle: '史记卷五', read: false, progress: 0 },
  { id: 'c6', title: '秦始皇本纪第六', subtitle: '史记卷六', read: false, progress: 0 },
  { id: 'c7', title: '项羽本纪第七', subtitle: '史记卷七', read: true, progress: 100 },
  { id: 'c8', title: '高祖本纪第八', subtitle: '史记卷八', read: false, progress: 0 }
]

const MOCK_CONTENT = {
  original:
    '太史公曰：学者多称五帝，尚矣。然尚书独载尧以来；而百家言黄帝，其文不雅驯，荐绅先生难言之。\n\n孔子所传宰予问五帝德及帝系姓，儒者或不传。余尝西至空桐，北过涿鹿，东渐于海，南浮江淮矣，至长老皆各往往称黄帝、尧、舜之处，风教固殊焉，总之不离古文者近是。\n\n予观春秋、国语，其发明五帝德、帝系姓章矣，顾弟弗深考，其所表见皆不虚。书缺有间矣，其轶乃时时见于他说。非好学深思，心知其意，固难为浅见寡闻道也。余并论次，择其言尤雅者，故著为本纪书首。',
  translation:
    '太史公说：学者多称赞五帝，由来已久了。但是《尚书》只记载了唐尧以来的事；可是诸子百家谈论黄帝，他们的文字不够典雅纯正，士大夫们也难以明辨。\n\n孔子传下来的宰予问《五帝德》及《帝系姓》，儒生们有的不传习。我曾经西到空桐，北过涿鹿，东到大海，南渡长江、淮河，所到之处，老年长辈们每每谈到黄帝、唐尧、虞舜活动过的地方，风俗教化本来就不相同，总的来说，不背离古文记载的说法比较接近正确。\n\n我读《春秋》《国语》，它们对《五帝德》《帝系姓》的阐述是很清楚的，只是人们没有深入考察，其实这些记载都不是虚妄的。《尚书》残缺已久，它所散佚的内容，常常在其他著作中可以看到。不是好学深思、明了其中深意的人，本来就很难同见识浅陋、孤陋寡闻的人说明白。我综合研究，加以编排，选择那些言辞特别典雅纯正的，写成《五帝本纪》，作为全书的第一篇。',
  notes: [
    { keyword: '五帝', note: '通常指黄帝、颛顼、帝喾、唐尧、虞舜' },
    { keyword: '荐绅', note: '缙绅，指古代官吏的装束，引申为官员、士大夫' }
  ]
}

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
    safeBottom: 0
  },

  onLoad(options) {
    const id = options.id || 'shiji'
    const title = decodeURIComponent(options.title || '史记')
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ safeBottom: sys.safeAreaInsets ? sys.safeAreaInsets.bottom : 0 })
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

  async loadChapters(id) {
    const cached = storage.get('chapters_' + id)
    if (cached) {
      this.setData({ chapters: cached, chaptersLoading: false })
      return
    }
    try {
      const data = await requestCloud('shiji', 'chapters', { bookId: id }, { throwError: false })
      const list = (data && data.chapters) || MOCK_CHAPTERS
      storage.set('chapters_' + id, list, 86400)
      this.setData({ chapters: list, chaptersLoading: false })
    } catch (e) {
      this.setData({ chapters: MOCK_CHAPTERS, chaptersLoading: false })
    }
  },

  async openChapter(e) {
    const id = e.currentTarget.dataset.id
    const chapter = this.data.chapters.find(c => c.id === id)
    if (!chapter) return
    let content = storage.get('content_' + id)
    if (!content) {
      const data = await requestCloud('shiji', 'chapter-content', { chapterId: id }, { showLoading: true, loadingText: '加载正文...', throwError: false })
      content = (data && data.content) || MOCK_CONTENT
      if (data && data.content) storage.set('content_' + id, content, 86400)
    }
    this.setData({
      currentChapter: chapter,
      currentChapterId: id,
      content: {
        original: content.original || '',
        translation: content.translation || '',
        notes: normalizeNotes(content.notes)
      }
    })
  },

  backToCatalog() {
    this.setData({ currentChapter: null, currentChapterId: '' })
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

  addProgress() {
    if (!this.data.currentChapterId) return
    const chapters = this.data.chapters.map(c => {
      if (c.id === this.data.currentChapterId) {
        return { ...c, progress: Math.min(100, c.progress + 20), read: c.progress + 20 >= 80 }
      }
      return c
    })
    storage.set('chapters_' + this.data.bookId, chapters, 86400)
    this.setData({ chapters })
    wx.showToast({ title: '进度已更新', icon: 'none' })
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
