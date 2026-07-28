const { requestCloud } = require('../../utils/cloudRequest')
const loginGuard = require('../../utils/loginGuard')

const app = getApp()

const GIFT_FILTERS = [
  { key: 'all', name: '全部' },
  { key: '笔墨纸砚', name: '笔墨纸砚' },
  { key: '茶酒食', name: '茶酒食' },
  { key: '玉器青铜', name: '玉器青铜' },
  { key: '古籍字画', name: '古籍字画' }
]

Page({
  data: {
    statusBarHeight: 20,
    navHeight: 44,
    giftFilter: 'all',
    giftFilters: GIFT_FILTERS,
    collectedGifts: [],
    lockedGifts: [],
    collectionStats: { collected: 0, total: 0, rare: 0, completion: 0 },
    loading: true
  },

  onLoad() {
    const sysInfo = app.globalData || {}
    const statusBarHeight = sysInfo.statusBarHeight || 20
    let navHeight = 44
    try {
      const menuBtn = wx.getMenuButtonBoundingClientRect()
      if (menuBtn && menuBtn.height) {
        navHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height
      }
    } catch (e) {}
    this.setData({ statusBarHeight, navHeight })
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
    this.loadCollection()
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/discover/index' }) })
  },

  async loadCollection() {
    try {
      const data = await requestCloud('yan', 'collection', { filter: this.data.giftFilter }, { throwError: false })
      if (data) {
        this.setData({
          collectedGifts: data.collected || [],
          lockedGifts: data.locked || [],
          collectionStats: data.stats || { collected: 0, total: 0, rare: 0, completion: 0 },
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  filterGifts(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ giftFilter: key, loading: true })
    this.loadCollection()
  }
})
