const { requestCloud } = require('../../../utils/cloudRequest')
const dnaEngine = require('../../../utils/dna-engine')
const loginGuard = require('../../../utils/loginGuard')

Page({
  data: {
    recordId: '',
    record: null,
    quiz: null,
    result: null,
    dimBars: [],
    loading: true,
    error: '',
    figureExists: false,
    figureAvatar: '',
    statusBarHeight: 20
  },

  _radarCanvas: null,

  onLoad(options) {
    try {
      var sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 20 })
    } catch (e) {}
    var recordId = options.recordId || ''
    if (!recordId) {
      this.setData({ loading: false, error: '记录不存在' })
      return
    }
    this.setData({ recordId: recordId })
    this.loadRecord()
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  async loadRecord() {
    try {
      var data = await requestCloud('dna', 'get-record', { recordId: this.data.recordId })
      if (!data) {
        this.setData({ loading: false, error: '记录不存在或已过期' })
        return
      }
      var result = data.resultData || {}
      var quiz = {
        title: data.quizTitle,
        icon: data.quizIcon,
        cover: data.quizCover || '',
        themeColor: data.quizThemeColor
      }
      var dimBars = this.buildDimBars(result)
      this.setData({
        record: data,
        quiz: quiz,
        result: result,
        dimBars: dimBars,
        figureExists: data.figureExists || false,
        figureAvatar: data.figureAvatar || '',
        loading: false
      })
      // 延后绘制雷达
      setTimeout(this.drawRadar.bind(this), 100)
      // 如果云函数未返回头像，尝试从本地缓存获取
      if (!this.data.figureAvatar && result.figureId) {
        this.loadFigureAvatar(result.figureId)
      }
    } catch (e) {
      this.setData({ loading: false, error: '加载失败' })
    }
  },

  loadFigureAvatar(figureId) {
    try {
      var storage = require('../../../utils/storage')
      var fig = storage.get('figure_' + figureId)
      if (fig && fig.avatar) {
        this.setData({ figureAvatar: fig.avatar })
      }
    } catch (e) {}
  },

  buildDimBars(result) {
    var radar = result.radar || {}
    return Object.keys(radar).map(function (name) {
      return {
        name: name,
        value: radar[name],
        percent: Math.min(100, Math.max(0, radar[name]))
      }
    })
  },

  // ===== 雷达图绘制（Canvas 2.0）=====
  drawRadar() {
    var self = this
    var query = wx.createSelectorQuery()
    query.select('#radarCanvas')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) return
        var canvas = res[0].node
        var ctx = canvas.getContext('2d')
        var dpr = wx.getSystemInfoSync().pixelRatio
        var width = res[0].width
        var height = res[0].height
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)

        var radar = (self.data.result && self.data.result.radar) || {}
        var dims = Object.keys(radar)
        if (!dims.length) return

        var cx = width / 2
        var cy = height / 2
        var radius = Math.min(width, height) / 2 - 30
        var n = dims.length
        var levels = 4

        // 背景网格
        ctx.strokeStyle = 'rgba(201,162,77,0.2)'
        ctx.lineWidth = 1
        for (var l = 1; l <= levels; l++) {
          var r = radius * l / levels
          ctx.beginPath()
          for (var i = 0; i < n; i++) {
            var angle = -Math.PI / 2 + i * 2 * Math.PI / n
            var x = cx + r * Math.cos(angle)
            var y = cy + r * Math.sin(angle)
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.stroke()
        }

        // 轴线
        ctx.strokeStyle = 'rgba(201,162,77,0.3)'
        for (var i2 = 0; i2 < n; i2++) {
          var angle2 = -Math.PI / 2 + i2 * 2 * Math.PI / n
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + radius * Math.cos(angle2), cy + radius * Math.sin(angle2))
          ctx.stroke()
        }

        // 数据多边形
        var themeColor = (self.data.result && self.data.result.themeColor) || '#C9A24D'
        ctx.beginPath()
        for (var i3 = 0; i3 < n; i3++) {
          var angle3 = -Math.PI / 2 + i3 * 2 * Math.PI / n
          var value = radar[dims[i3]] || 0
          var r3 = radius * value / 100
          var x3 = cx + r3 * Math.cos(angle3)
          var y3 = cy + r3 * Math.sin(angle3)
          if (i3 === 0) ctx.moveTo(x3, y3)
          else ctx.lineTo(x3, y3)
        }
        ctx.closePath()
        ctx.fillStyle = self.hexToRgba(themeColor, 0.4)
        ctx.fill()
        ctx.strokeStyle = themeColor
        ctx.lineWidth = 2
        ctx.stroke()

        // 顶点
        ctx.fillStyle = themeColor
        for (var i4 = 0; i4 < n; i4++) {
          var angle4 = -Math.PI / 2 + i4 * 2 * Math.PI / n
          var value4 = radar[dims[i4]] || 0
          var r4 = radius * value4 / 100
          var x4 = cx + r4 * Math.cos(angle4)
          var y4 = cy + r4 * Math.sin(angle4)
          ctx.beginPath()
          ctx.arc(x4, y4, 4, 0, Math.PI * 2)
          ctx.fill()
        }

        // 标签
        ctx.fillStyle = '#666'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        for (var i5 = 0; i5 < n; i5++) {
          var angle5 = -Math.PI / 2 + i5 * 2 * Math.PI / n
          var labelR = radius + 18
          var x5 = cx + labelR * Math.cos(angle5)
          var y5 = cy + labelR * Math.sin(angle5)
          ctx.fillText(dims[i5], x5, y5)
        }

        self._radarCanvas = canvas
      })
  },

  hexToRgba(hex, alpha) {
    if (!hex || hex[0] !== '#') return 'rgba(201,162,77,' + alpha + ')'
    var h = hex.replace('#', '')
    var r = parseInt(h.substring(0, 2), 16) || 201
    var g = parseInt(h.substring(2, 4), 16) || 162
    var b = parseInt(h.substring(4, 6), 16) || 77
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')'
  },

  // ===== 其他操作 =====
  onBack() {
    var pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.redirectTo({ url: '/pages/discover/dna-hall/index' })
    }
  },

  onRetryQuiz() {
    var quizId = this.data.record && this.data.record.quizId
    if (quizId) {
      wx.redirectTo({
        url: '/pages/discover/dna-quiz/index?id=' + quizId
      })
    }
  },

  onChatWithFigure() {
    var figureId = this.data.result && this.data.result.figureId
    if (!figureId) return
    wx.navigateTo({
      url: '/pages/chat/room?figureId=' + figureId,
      fail: function () {
        wx.showToast({ title: '对话页未就绪', icon: 'none' })
      }
    })
  },

  // ===== 分享 =====
  onShareAppMessage() {
    var r = this.data.result || {}
    var sim = (this.data.record && this.data.record.similarity) || 88
    var title = '我的历史DNA是【' + (r.figureName || '') + (r.figureTitle ? '·' + r.figureTitle : '') + '】匹配度' + sim + '%！你也来测测？'
    return {
      title: title,
      path: '/pages/discover/dna-result/index?recordId=' + this.data.recordId,
      imageUrl: this.data.figureAvatar || r.cover || ''
    }
  },

  onShareTimeline() {
    var r = this.data.result || {}
    var sim = (this.data.record && this.data.record.similarity) || 88
    return {
      title: '我的历史DNA是【' + (r.figureName || '') + '】匹配度' + sim + '%！你也来测测？',
      query: 'recordId=' + this.data.recordId
    }
  }
})
