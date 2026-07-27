const { requestCloud } = require('../../utils/cloudRequest')
const { formatChatTime } = require('../../utils/date')
const loginGuard = require('../../utils/loginGuard')

Page({
  data: {
    achievementList: [],
    unlockedCount: 0,
    totalCount: 0,
    progressPercent: 0,
    categoryProgress: { beginner: '0/4', communicate: '0/4', explore: '0/4', legend: '0/3' },
    showModal: false,
    detailData: null
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
    this.loadAchievements()
  },

  async loadAchievements() {
    const data = await requestCloud('getUser', 'achievements', {}, { throwError: false })
    if (!data) {
      this.setData({
        achievementList: [],
        unlockedCount: 0,
        totalCount: 0,
        progressPercent: 0,
        categoryProgress: { beginner: '0/4', communicate: '0/4', explore: '0/4', legend: '0/3' }
      })
      wx.showToast({ title: '成就数据加载失败', icon: 'none' })
      return
    }

    const list = (data.list || []).map(a => ({
      ...a,
      unlockTime: a.unlockedAt ? formatChatTime(a.unlockedAt).split(' ')[0] : ''
    }))

    const totalCount = data.totalCount || 0
    const unlockedCount = data.unlockedCount || 0
    this.setData({
      achievementList: list,
      unlockedCount,
      totalCount,
      progressPercent: totalCount ? Math.round(unlockedCount / totalCount * 100) : 0,
      categoryProgress: data.categoryProgress || { beginner: '0/4', communicate: '0/4', explore: '0/4', legend: '0/3' }
    })
  },

  showDetail(e) {
    const { item } = e.currentTarget.dataset
    if (!item) return
    const detail = {
      ...item,
      unlockCondition: item.unlockCondition || '完成指定任务后自动解锁'
    }
    this.setData({ showModal: true, detailData: detail })
  },
  closeModal() { this.setData({ showModal: false, detailData: null }) },
  stopProp() {}
})
