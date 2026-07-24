const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')

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

Page({
  data: {
    bookId: 'shiji',
    bookTitle: '史记',
    chapters: [],
    currentChapter: null,
    currentChapterId: '',
    showTranslation: false,
    content: { original: '', translation: '', notes: [] },
    fontSize: 30,
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
    this.loadChapters(id)
  },

  async loadChapters(id) {
    const cached = storage.get('chapters_' + id)
    if (cached) {
      this.setData({ chapters: cached })
      return
    }
    try {
      const data = await requestCloud('shiji', 'chapters', { bookId: id }, { throwError: false })
      const list = (data && data.chapters) || MOCK_CHAPTERS
      storage.set('chapters_' + id, list, 86400)
      this.setData({ chapters: list })
    } catch (e) {
      this.setData({ chapters: MOCK_CHAPTERS })
    }
  },

  openChapter(e) {
    const id = e.currentTarget.dataset.id
    const chapter = this.data.chapters.find(c => c.id === id)
    if (!chapter) return
    const content = storage.get('content_' + id) || MOCK_CONTENT
    this.setData({
      currentChapter: chapter,
      currentChapterId: id,
      content
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
  }
})
