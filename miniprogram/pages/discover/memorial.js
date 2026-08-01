// pages/discover/memorial.js
// 批奏折 - 列表页（三Tab：今日待批 / 朱批档案 / 历史小课堂）
// 注意：详情页独立为 memorial-detail，不再用浮层

var APP = getApp()
var { resolveAvatarUrl } = require('../../utils/helpers')
var { getUserInfo } = require('../../utils/auth')

Page({
  data: {
    // ========== 用户信息 ==========
    avatarSrc: '/images/icons/avatar.png',
    nickName: '朕',

    // ========== 页面容器 ==========
    activeTab: 'today', // today / archive / classroom

    // ========== 圣明指数 ==========
    wisdomIndex: 50,
    wisdomLevel: '中庸之君',

    // ========== 今日待批 Tab ==========
    dailyLoading: false,
    dailyDate: '',
    queue: [],           // [{memorial_id,order,type,title,official_name,official_title,carried,done}]
    completedCount: 0,
    dailyCount: 10,
    carryoverCount: 0,
    dailyClear: false,

    // ========== 档案库 Tab ==========
    archiveLoading: false,
    archiveItems: [],
    archivePage: 1,
    archivePageSize: 10,
    archiveTotal: 0,
    archiveNoMore: false,
    archiveFilterType: 'all',
    archiveStats: { total: 0, byType: {} },
    archiveTypes: [
      { key: 'all', label: '全部' },
      { key: '奏事折', label: '奏事折' },
      { key: '密折', label: '密折' },
      { key: '请安折', label: '请安折' },
      { key: '谢恩折', label: '谢恩折' },
      { key: '奇葩折', label: '奇葩折' }
    ]
  },

  onLoad: function() {
    this.loadUserInfo()
    if (wx.showShareMenu) {
      try { wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] }) } catch (e) {}
    }
    this.loadDaily()
  },

  loadUserInfo: function() {
    var self = this
    var cached = APP.globalData && APP.globalData.userInfo
    if (cached && cached.avatarUrl) {
      this._resolveAvatar(cached.avatarUrl)
      this.setData({ nickName: cached.nickName || '朕' })
      return
    }
    getUserInfo().then(function(info) {
      if (!info) return
      if (info.avatarUrl) self._resolveAvatar(info.avatarUrl)
      self.setData({ nickName: info.nickName || '朕' })
    }).catch(function() {})
  },

  _resolveAvatar: function(avatarUrl) {
    var self = this
    resolveAvatarUrl(avatarUrl).then(function(url) {
      self.setData({ avatarSrc: url })
    }).catch(function() {})
  },

  // 重点：从详情页返回后，自动刷新队列/档案，保证状态同步
  onShow: function() {
    if (this.data.activeTab === 'today') {
      this.loadDaily()
    } else if (this.data.activeTab === 'archive') {
      this.loadArchive(true)
    }
  },

  // ============================
  // Tab 切换
  // ============================
  switchTab: function(e) {
    var tab = e.currentTarget.dataset.tab
    if (!tab) return
    if (tab === this.data.activeTab) return
    this.setData({ activeTab: tab })
    if (tab === 'today') {
      this.loadDaily()
    } else if (tab === 'archive') {
      if (this.data.archiveItems.length === 0) this.loadArchive(true)
    }
  },

  // ============================
  // 今日待批 Tab
  // ============================
  loadDaily: function() {
    var self = this
    self.setData({ dailyLoading: true })
    wx.cloud.callFunction({
      name: 'memorial',
      data: { action: 'daily' },
      success: function(res) {
        var r = (res && res.result && res.result.data) || null
        if (!r) {
          self.setData({ dailyLoading: false })
          wx.showToast({ title: '加载失败', icon: 'none' })
          return
        }
        var rawQ = r.queue || []
        // 未批在前保持原顺序，已批放在后面
        var pending = []
        var doneList = []
        for (var i = 0; i < rawQ.length; i++) {
          if (rawQ[i] && rawQ[i].done) doneList.push(rawQ[i])
          else pending.push(rawQ[i])
        }
        var q = pending.concat(doneList)
        var comp = r.completed_count || 0
        self.setData({
          dailyLoading: false,
          dailyDate: r.date,
          queue: q,
          completedCount: comp,
          wisdomIndex: typeof r.wisdom_index === 'number' ? r.wisdom_index : 50,
          wisdomLevel: self.calcWisdomLevel(typeof r.wisdom_index === 'number' ? r.wisdom_index : 50),
          dailyCount: r.daily_count || 10,
          carryoverCount: r.carryover_count || 0,
          dailyClear: q.length > 0 && comp >= q.length
        })
      },
      fail: function() {
        self.setData({ dailyLoading: false })
        wx.showToast({ title: '网络异常', icon: 'none' })
      }
    })
  },

  // 点击队列中的某一封奏折 -> 跳独立详情页
  openMemorial: function(e) {
    var mid = e.currentTarget.dataset.mid
    if (!mid) return
    wx.navigateTo({
      url: '/pages/discover/memorial-detail?id=' + mid,
      fail: function() {
        wx.showToast({ title: '打开失败', icon: 'none' })
      }
    })
  },

  // ============================
  // 档案库 Tab
  // ============================
  switchArchiveType: function(e) {
    var key = e.currentTarget.dataset.key
    if (!key || key === this.data.archiveFilterType) return
    this.setData({ archiveFilterType: key })
    this.loadArchive(true)
  },

  loadArchive: function(reset) {
    var self = this
    if (self.data.archiveLoading) return
    var page = reset ? 1 : self.data.archivePage
    var pageSize = self.data.archivePageSize
    self.setData({ archiveLoading: true })
    wx.cloud.callFunction({
      name: 'memorial',
      data: {
        action: 'archive',
        filter_type: self.data.archiveFilterType,
        page: page, page_size: pageSize
      },
      success: function(res) {
        var r = (res && res.result && res.result.data) || null
        if (!r) {
          self.setData({ archiveLoading: false })
          wx.showToast({ title: '加载失败', icon: 'none' })
          return
        }
        var list = r.items || []
        var merged = reset ? list : self.data.archiveItems.concat(list)
        var total = (r.pagination && r.pagination.total) || 0
        self.setData({
          archiveLoading: false,
          archiveItems: merged,
          archivePage: page + 1,
          archiveTotal: total,
          archiveNoMore: merged.length >= total,
          archiveStats: r.stats || self.data.archiveStats
        })
      },
      fail: function() {
        self.setData({ archiveLoading: false })
        wx.showToast({ title: '网络异常', icon: 'none' })
      }
    })
  },

  loadMoreArchive: function() {
    if (this.data.archiveNoMore || this.data.archiveLoading) return
    this.loadArchive(false)
  },

  // 点击档案 -> 跳详情页（已批，只读展示结果）
  openArchiveItem: function(e) {
    var mid = e.currentTarget.dataset.mid
    if (!mid) return
    wx.navigateTo({
      url: '/pages/discover/memorial-detail?id=' + mid,
      fail: function() {
        wx.showToast({ title: '打开失败', icon: 'none' })
      }
    })
  },

  // ============================
  // 工具：圣明等级
  // ============================
  calcWisdomLevel: function(w) {
    if (w >= 90) return '圣明之君'
    if (w >= 75) return '贤明之主'
    if (w >= 55) return '中庸之君'
    if (w >= 30) return '平庸之主'
    return '昏聩之君'
  },

  // ============================
  // 分享
  // ============================
  onShareAppMessage: function() {
    var title = '朕今日批阅了' + this.data.completedCount + '道奏折，圣明指数' + this.data.wisdomIndex
    return {
      title: title,
      path: '/pages/discover/memorial'
    }
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    var self = this
    if (this.data.activeTab === 'today') {
      this.loadDaily()
    } else if (this.data.activeTab === 'archive') {
      this.loadArchive(true)
    }
    setTimeout(function() { try { wx.stopPullDownRefresh() } catch (_) {} }, 400)
  }
})
