const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')
const { sleep } = require('../../utils/helpers')
const loginGuard = require('../../utils/loginGuard')

const CHAPTERS = [
  { key: 'all', name: '全部' },
  { key: 'han', name: '大汉篇' },
  { key: 'sanguo', name: '三国篇' },
  { key: 'tang', name: '盛唐篇' },
  { key: 'song', name: '赵宋篇' },
  { key: 'ming', name: '朱明篇' }
]

Page({
  data: {
    loading: true,
    chapters: CHAPTERS,
    activeChapter: 'all',
    memorialList: [],
    memorial: null,
    selectedOpt: '',
    zhupi: '',
    simulating: false,
    simulationResult: null,
    nextMemorialId: null
  },

  onLoad() {
    this.loadMemorialList()
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  async loadMemorialList() {
    try {
      const data = await requestCloud('memorial', 'list', { chapter: this.data.activeChapter }, { throwError: false })
      let list = (data && data.list) || []
      const progress = storage.get('memorial_progress') || {}
      list = list.map(m => ({
        ...m,
        completed: !!progress[m._id],
        userChoice: progress[m._id] ? progress[m._id].choice : '',
        dynastyName: m.dynastyName || this.getDynastyName(m.dynasty)
      }))
      this.setData({ memorialList: list })
    } catch (e) {
      this.setData({ memorialList: [] })
    } finally {
      this.setData({ loading: false })
    }
  },

  getDynastyName(key) {
    const m = { han: '西汉', sanguo: '三国', tang: '唐', song: '宋', ming: '明', qing: '清' }
    return m[key] || key
  },

  selectChapter(e) {
    const { key } = e.currentTarget.dataset
    this.setData({ activeChapter: key })
    this.loadMemorialList()
  },

  selectMemorial(e) {
    const { id } = e.currentTarget.dataset
    const item = this.data.memorialList.find(m => m._id === id)
    if (!item || !item.unlocked) {
      wx.showToast({ title: '请先完成前置奏折', icon: 'none' })
      return
    }
    this.setData({
      memorial: item,
      selectedOpt: '',
      zhupi: '',
      simulationResult: null
    })
  },

  selectOption(e) {
    const { key } = e.currentTarget.dataset
    this.setData({ selectedOpt: key })
  },

  onZhupiInput(e) {
    this.setData({ zhupi: e.detail.value })
  },

  async onDecide() {
    const { selectedOpt, memorial, zhupi } = this.data
    if (!selectedOpt) return

    this.setData({ simulating: true })
    try {
      await sleep(2500)
      const data = await requestCloud('memorial', 'decide', {
        memorialId: memorial._id,
        decision: selectedOpt,
        zhupi: zhupi
      }, { throwError: false })

      if (!data) {
        this.setData({ simulating: false })
        wx.showToast({ title: '处理失败，请重试', icon: 'none' })
        return
      }
      const result = data
      const progress = storage.get('memorial_progress') || {}
      progress[memorial._id] = {
        choice: selectedOpt,
        zhupi,
        result: result,
        completedAt: Date.now()
      }
      storage.set('memorial_progress', progress, 86400 * 30)

      const idx = this.data.memorialList.findIndex(m => m._id === memorial._id)
      const nextMem = this.data.memorialList[idx + 1]
      this.setData({
        simulating: false,
        simulationResult: result,
        nextMemorialId: nextMem ? nextMem._id : null
      })
    } catch (e) {
      this.setData({ simulating: false })
      wx.showToast({ title: '处理失败，请重试', icon: 'none' })
    }
  },

  goNext() {
    const id = this.data.nextMemorialId
    if (!id) return
    this.setData({ memorial: null, simulationResult: null })
    setTimeout(() => {
      const item = this.data.memorialList.find(m => m._id === id)
      if (item) this.selectMemorial({ currentTarget: { dataset: { id } } })
    }, 100)
  },

  backToList() {
    this.setData({
      memorial: null,
      simulationResult: null,
      selectedOpt: '',
      zhupi: ''
    })
    this.loadMemorialList()
  }
})
