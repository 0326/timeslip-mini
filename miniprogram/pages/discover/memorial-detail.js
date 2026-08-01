// pages/discover/memorial-detail.js
// 批奏折 - 详情独立页（取代原浮层）

var APP = getApp()
var { resolveAvatarUrl } = require('../../utils/helpers')
var { getUserInfo } = require('../../utils/auth')

// 分类类型对应的颜色
var TYPE_STYLE = {
  '奏事折': { bg: '#F1F0FF', color: '#5E4CE6', label: '奏事' },
  '密折':   { bg: '#FFEEF6', color: '#D4387F', label: '密折' },
  '请安折': { bg: '#FFF7E0', color: '#C78A00', label: '请安' },
  '谢恩折': { bg: '#E6F7EF', color: '#1E9B6A', label: '谢恩' },
  '奇葩折': { bg: '#FFEBE6', color: '#E6562C', label: '奇葩' }
}

// 朱批模板
var VERMILION_TEMPLATES = [
  { key: 'v1', label: '朕知道了', text: '知道了' },
  { key: 'v2', label: '依议',       text: '依议' },
  { key: 'v3', label: '该部知道',   text: '该部知道' },
  { key: 'v4', label: '甚是嘉许',   text: '所奏甚是，嘉许' },
  { key: 'v5', label: '严行申饬',   text: '所奏非是，严饬！' },
  { key: 'v6', label: '从长计议',   text: '事体重大，著九卿会议具奏' }
]

Page({
  data: {
    memorialId: '',
    // 加载/阶段：detail 加载中 / 未批(可决策) / 已批(只读结果) / 提交中 / 结果
    stage: 'loading', // loading | deciding | answered_already | submitting | result
    loadingText: '展开奏折中...',

    // 用户信息
    avatarSrc: '/images/icons/avatar.png',
    nickName: '朕',
    wisdomIndex: 50,
    wisdomLevel: '中庸之君',

    // 奏折详情
    memorial: null,
    typeStyle: {},
    // 已批阅过的原始答案（供只读展示）
    answeredInfo: null,

    // 决策相关
    selectedDecision: '',
    customZhupi: '',
    vermilionTemplates: VERMILION_TEMPLATES,
    showZhupiPanel: false,
    templateKey: '',

    // 提交中
    submitLoading: false,

    // 结果
    result: null,
    // 下一个未批折子的id（用于下一折按钮跳转）
    nextMemorialId: ''
  },

  onLoad: function(options) {
    var self = this
    var mid = options && (options.id || options.mid)
    if (!mid) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(function() { wx.navigateBack() }, 800)
      return
    }
    this.setData({ memorialId: mid })
    this.loadUserInfo()
    this.loadDetail(mid)
    if (wx.showShareMenu) {
      try { wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] }) } catch (e) {}
    }
  },

  onShow: function() {
    // 从下一折返回时重新加载（理论上不会发生，保持稳定）
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

  // ============================
  // 加载详情
  // ============================
  loadDetail: function(mid) {
    var self = this
    self.setData({ stage: 'loading', loadingText: '展开奏折中...' })
    wx.cloud.callFunction({
      name: 'memorial',
      data: { action: 'detail', memorial_id: mid },
      success: function(res) {
        var r = (res && res.result && res.result.data) || null
        if (!r) {
          wx.showToast({ title: '加载失败', icon: 'none' })
          setTimeout(function() { wx.navigateBack() }, 800)
          return
        }
        var ts = TYPE_STYLE[r.type] || TYPE_STYLE['奏事折']
        // 已批阅过：展示结果卡（只读）
        if (r.answered && r.my_answer) {
          self.setData({
            stage: 'answered_already',
            memorial: r,
            typeStyle: ts,
            answeredInfo: r.my_answer,
            wisdomIndex: typeof r.my_answer.new_wisdom === 'number' ? r.my_answer.new_wisdom : 50,
            wisdomLevel: self.calcWisdomLevel(typeof r.my_answer.new_wisdom === 'number' ? r.my_answer.new_wisdom : 50)
          })
          // 加载下一个未批id（供"下一折"）
          self.loadNextMemorialId()
          return
        }
        // 未批阅：可决策
        self.setData({
          stage: 'deciding',
          memorial: r,
          typeStyle: ts,
          selectedDecision: '',
          customZhupi: '',
          templateKey: '',
          showZhupiPanel: false
        })
        // 加载下一个未批id
        self.loadNextMemorialId()
      },
      fail: function() {
        wx.showToast({ title: '网络异常', icon: 'none' })
        setTimeout(function() { wx.navigateBack() }, 800)
      }
    })
  },

  // 加载当前用户今日队列中下一个未批的id（给下一折按钮用）
  loadNextMemorialId: function() {
    var self = this
    var currentId = this.data.memorialId
    wx.cloud.callFunction({
      name: 'memorial',
      data: { action: 'daily' },
      success: function(res) {
        var r = (res && res.result && res.result.data) || null
        if (!r) return
        var q = r.queue || []
        var nextId = ''
        // 优先找下一个排在current后面的未批
        var curIdx = -1
        for (var i = 0; i < q.length; i++) {
          if (q[i].memorial_id === currentId) { curIdx = i; break }
        }
        if (curIdx >= 0) {
          for (var j = curIdx + 1; j < q.length; j++) {
            if (!q[j].done) { nextId = q[j].memorial_id; break }
          }
        }
        if (!nextId) {
          for (var k = 0; k < q.length; k++) {
            if (!q[k].done && q[k].memorial_id !== currentId) {
              nextId = q[k].memorial_id
              break
            }
          }
        }
        self.setData({ nextMemorialId: nextId })
      },
      fail: function() {}
    })
  },

  // ============================
  // 决策选择
  // ============================
  selectDecision: function(e) {
    var key = e.currentTarget.dataset.key
    if (!key) return
    var mem = this.data.memorial
    if (!mem) return
    if (key === 'preset_quick' && (mem.type === '请安折' || mem.type === '谢恩折')) {
      this.setData({
        selectedDecision: 'preset_quick',
        customZhupi: mem.preset_vermilion || ''
      })
      return
    }
    this.setData({ selectedDecision: key })
  },

  // ============================
  // 朱批模板 & 输入
  // ============================
  toggleVermilionPanel: function() {
    this.setData({ showZhupiPanel: !this.data.showZhupiPanel })
  },

  selectTemplate: function(e) {
    var tk = e.currentTarget.dataset.key
    var t = VERMILION_TEMPLATES.find(function(x) { return x.key === tk })
    if (!t) return
    this.setData({
      templateKey: tk,
      customZhupi: this.data.customZhupi ? (this.data.customZhupi + ' ' + t.text) : t.text
    })
  },

  onZhupiInput: function(e) {
    this.setData({ customZhupi: e.detail.value || '' })
  },

  // ============================
  // 提交批阅
  // ============================
  onSubmitDecide: function() {
    var self = this
    if (self.data.submitLoading) return
    if (self.data.stage !== 'deciding') return
    var mem = self.data.memorial
    if (!mem) return
    var decision = self.data.selectedDecision
    if (!decision) {
      wx.showToast({ title: '请先选择朱批', icon: 'none' })
      return
    }
    var payloadDecision = decision
    var payloadPreset = false
    if (decision === 'preset_quick') {
      payloadDecision = 'preset'
      payloadPreset = true
    }
    self.setData({ submitLoading: true, stage: 'submitting' })

    wx.cloud.callFunction({
      name: 'memorial',
      data: {
        action: 'decide',
        memorial_id: mem._id,
        decision: payloadDecision,
        custom_zhupi: self.data.customZhupi || '',
        preset_quick: payloadPreset
      },
      success: function(res) {
        var code = res && res.result && res.result.code
        var data = res && res.result && res.result.data
        if (code === 3) {
          // 已批阅过 → 重新加载显示为answered_already
          self.setData({ submitLoading: false })
          wx.showToast({ title: '此折已批阅过', icon: 'none' })
          self.loadDetail(self.data.memorialId)
          return
        }
        if (code === 2) {
          self.setData({ submitLoading: false, stage: 'deciding' })
          wx.showToast({ title: (res.result && res.result.message) || '朱批内容不当', icon: 'none' })
          return
        }
        if (code !== 0 || !data) {
          self.setData({ submitLoading: false, stage: 'deciding' })
          wx.showToast({ title: (res && res.result && res.result.message) || '提交失败', icon: 'none' })
          return
        }
        // 成功 → 展示结果
        var newWisdom = typeof data.new_wisdom === 'number' ? data.new_wisdom : self.data.wisdomIndex
        var resultObj = {
          memorial_id: data.memorial_id,
          memorial_title: mem.title,
          memorial_type: mem.type,
          decision: data.decision,
          decision_label: data.decision_label,
          zhupi: data.zhupi,
          retained: !!data.retained,
          wisdom_delta: data.wisdom_delta,
          new_wisdom: newWisdom,
          consequence: data.consequence,
          follow_up: data.follow_up,
          historical_fact: data.historical_fact,
          fun_fact: data.fun_fact,
          trivia: data.trivia,
          trivia_topic: data.trivia_topic,
          unlocks: data.unlocks || []
        }
        // 1.2s延迟：营造推演仪式感
        setTimeout(function() {
          self.setData({
            submitLoading: false,
            stage: 'result',
            result: resultObj,
            wisdomIndex: newWisdom,
            wisdomLevel: self.calcWisdomLevel(newWisdom)
          })
          if (data.unlocks && data.unlocks.length) {
            var total = data.unlocks.reduce(function(s, u) { return s + (u.reward || 0) }, 0)
            setTimeout(function() {
              wx.showToast({ title: '成就解锁！积分+' + total, icon: 'success', duration: 2200 })
            }, 800)
          }
        }, 1200)
      },
      fail: function() {
        self.setData({ submitLoading: false, stage: 'deciding' })
        wx.showToast({ title: '网络异常', icon: 'none' })
      }
    })
  },

  // ============================
  // 结果页动作
  // ============================
  backToList: function() {
    wx.navigateBack({ delta: 1 })
  },

  goNextMemorial: function() {
    var self = this
    var nextId = self.data.nextMemorialId
    if (!nextId) {
      // 没下一折 → 提示后返回
      wx.showToast({ title: '今日奏折已全部批阅完毕', icon: 'success', duration: 1600 })
      setTimeout(function() { wx.navigateBack({ delta: 1 }) }, 1500)
      return
    }
    // 跳到下一个详情页（redirectTo避免堆叠太深）
    wx.redirectTo({
      url: '/pages/discover/memorial-detail?id=' + nextId,
      fail: function() {
        wx.navigateTo({ url: '/pages/discover/memorial-detail?id=' + nextId })
      }
    })
  },

  // ============================
  // 工具
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
    var title = '朕正在批奏折，圣明指数' + this.data.wisdomIndex
    var r = this.data.result
    var a = this.data.answeredInfo
    if (r) {
      title = '朕朱批：' + (r.zhupi || '知道了') + ' · 邀你一起批奏折'
    } else if (a) {
      title = '朕朱批：' + (a.zhupi || '知道了') + ' · 邀你一起批奏折'
    }
    return {
      title: title,
      path: '/pages/discover/memorial'
    }
  }
})
