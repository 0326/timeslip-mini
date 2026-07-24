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
    posterShow: false,
    posterPath: '',
    posterGenerating: false,
    canvasReady: false,
    statusBarHeight: 20
  },

  _radarCanvas: null,
  _posterCanvas: null,

  onLoad(options) {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 20 })
    } catch (e) {}
    const recordId = options.recordId || ''
    if (!recordId) {
      this.setData({ loading: false, error: '记录不存在' })
      return
    }
    this.setData({ recordId })
    this.loadRecord()
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  async loadRecord() {
    try {
      const data = await requestCloud('dna', 'get-record', { recordId: this.data.recordId })
      if (!data) {
        this.setData({ loading: false, error: '记录不存在或已过期' })
        return
      }
      const result = data.resultData || {}
      const quiz = {
        title: data.quizTitle,
        icon: data.quizIcon,
        themeColor: data.quizThemeColor
      }
      // dimBars 用结果自带的 radar，比 dimLevels 更直观
      const dimBars = this.buildDimBars(result)
      this.setData({
        record: data,
        quiz,
        result,
        dimBars,
        loading: false
      })
      // 延后绘制雷达
      setTimeout(() => this.drawRadar(), 100)
    } catch (e) {
      this.setData({ loading: false, error: '加载失败' })
    }
  },

  buildDimBars(result) {
    const radar = result.radar || {}
    return Object.keys(radar).map(name => ({
      name,
      value: radar[name],
      percent: Math.min(100, Math.max(0, radar[name]))
    }))
  },

  // ===== 雷达图绘制（Canvas 2.0）=====
  drawRadar() {
    const query = wx.createSelectorQuery()
    query.select('#radarCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        const width = res[0].width
        const height = res[0].height
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)

        const radar = (this.data.result && this.data.result.radar) || {}
        const dims = Object.keys(radar)
        if (!dims.length) return

        const cx = width / 2
        const cy = height / 2
        const radius = Math.min(width, height) / 2 - 30
        const n = dims.length
        const levels = 4

        // 背景网格
        ctx.strokeStyle = 'rgba(201,162,77,0.2)'
        ctx.lineWidth = 1
        for (let l = 1; l <= levels; l++) {
          const r = radius * l / levels
          ctx.beginPath()
          for (let i = 0; i < n; i++) {
            const angle = -Math.PI / 2 + i * 2 * Math.PI / n
            const x = cx + r * Math.cos(angle)
            const y = cy + r * Math.sin(angle)
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.stroke()
        }

        // 轴线
        ctx.strokeStyle = 'rgba(201,162,77,0.3)'
        for (let i = 0; i < n; i++) {
          const angle = -Math.PI / 2 + i * 2 * Math.PI / n
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
          ctx.stroke()
        }

        // 数据多边形
        const themeColor = (this.data.result && this.data.result.themeColor) || '#C9A24D'
        ctx.beginPath()
        for (let i = 0; i < n; i++) {
          const angle = -Math.PI / 2 + i * 2 * Math.PI / n
          const value = radar[dims[i]] || 0
          const r = radius * value / 100
          const x = cx + r * Math.cos(angle)
          const y = cy + r * Math.sin(angle)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fillStyle = this.hexToRgba(themeColor, 0.4)
        ctx.fill()
        ctx.strokeStyle = themeColor
        ctx.lineWidth = 2
        ctx.stroke()

        // 顶点
        ctx.fillStyle = themeColor
        for (let i = 0; i < n; i++) {
          const angle = -Math.PI / 2 + i * 2 * Math.PI / n
          const value = radar[dims[i]] || 0
          const r = radius * value / 100
          const x = cx + r * Math.cos(angle)
          const y = cy + r * Math.sin(angle)
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.fill()
        }

        // 标签
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        for (let i = 0; i < n; i++) {
          const angle = -Math.PI / 2 + i * 2 * Math.PI / n
          const labelR = radius + 18
          const x = cx + labelR * Math.cos(angle)
          const y = cy + labelR * Math.sin(angle)
          ctx.fillText(dims[i], x, y)
        }

        this._radarCanvas = canvas
        this.setData({ canvasReady: true })
      })
  },

  hexToRgba(hex, alpha) {
    if (!hex || hex[0] !== '#') return `rgba(201,162,77,${alpha})`
    const h = hex.replace('#', '')
    const r = parseInt(h.substring(0, 2), 16) || 201
    const g = parseInt(h.substring(2, 4), 16) || 162
    const b = parseInt(h.substring(4, 6), 16) || 77
    return `rgba(${r},${g},${b},${alpha})`
  },

  // ===== 海报生成 =====
  onShowPoster() {
    if (this.data.posterPath) {
      this.setData({ posterShow: true })
      return
    }
    this.generatePoster()
  },

  generatePoster() {
    this.setData({ posterGenerating: true, posterShow: true })
    const query = wx.createSelectorQuery()
    query.select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          this.setData({ posterGenerating: false })
          wx.showToast({ title: '海报生成失败', icon: 'none' })
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        const PW = 375
        const PH = 667
        canvas.width = PW * dpr
        canvas.height = PH * dpr
        ctx.scale(dpr, dpr)

        const r = this.data.result || {}
        const themeColor = r.themeColor || '#B71C1C'
        const bgStart = r.bgStart || themeColor
        const bgEnd = r.bgEnd || '#1A1410'

        // 1. 渐变背景
        const grad = ctx.createLinearGradient(0, 0, PW, PH)
        grad.addColorStop(0, bgStart)
        grad.addColorStop(1, bgEnd)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, PW, PH)

        // 2. 顶部水印
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('— 穿越圈 · 历史人格DNA —', PW / 2, 50)

        // 3. 匹配度大字
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.font = 'bold 22px sans-serif'
        ctx.fillText('你的历史DNA · 匹配度', PW / 2, 100)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 80px sans-serif'
        const sim = (this.data.record && this.data.record.similarity) || 88
        ctx.fillText(sim + '%', PW / 2, 180)

        // 4. 装饰横线
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(PW / 2 - 60, 220)
        ctx.lineTo(PW / 2 + 60, 220)
        ctx.stroke()

        // 5. 人物名（大字）
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 56px "STKaiti", "KaiTi", serif'
        ctx.fillText(r.figureName || '历史人物', PW / 2, 290)

        // 6. 称号 + 朝代
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = '20px sans-serif'
        const subtitle = (r.figureTitle || '') + (r.dynastyName ? ' · ' + r.dynastyName : '')
        ctx.fillText(subtitle, PW / 2, 325)

        // 7. 结果标题
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = '16px sans-serif'
        ctx.fillText(r.title || '', PW / 2, 360)

        // 8. 简介卡片
        const cardY = 400
        const cardH = 130
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        this.roundRect(ctx, 30, cardY, PW - 60, cardH, 12)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'left'
        this.drawWrappedText(ctx, r.intro || r.desc || '', 50, cardY + 30, PW - 100, 20)

        // 9. 维度条（横向 mini 雷达）
        const radar = r.radar || {}
        const dims = Object.keys(radar)
        const barY = cardY + cardH + 30
        const barH = 14
        const barGap = 24
        ctx.textAlign = 'left'
        ctx.font = '13px sans-serif'
        dims.slice(0, 6).forEach((dim, i) => {
          const y = barY + i * barGap
          ctx.fillStyle = 'rgba(255,255,255,0.7)'
          ctx.fillText(dim, 30, y + 11)
          // 进度槽
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          this.roundRect(ctx, 90, y, 200, barH, 7)
          ctx.fill()
          // 进度
          ctx.fillStyle = '#fff'
          this.roundRect(ctx, 90, y, 200 * (radar[dim] || 0) / 100, barH, 7)
          ctx.fill()
          // 数值
          ctx.fillStyle = 'rgba(255,255,255,0.85)'
          ctx.textAlign = 'right'
          ctx.fillText(radar[dim] || 0, PW - 30, y + 11)
          ctx.textAlign = 'left'
        })

        // 10. 底部品牌
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('长按识别小程序码 · 测测你像谁', PW / 2, PH - 50)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 18px sans-serif'
        ctx.fillText('穿越圈', PW / 2, PH - 28)

        // 11. 小程序码占位（圆圈）
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(PW - 50, PH - 70, 30, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.font = '10px sans-serif'
        ctx.fillText('小程序', PW - 50, PH - 70 + 3)

        // 导出
        wx.canvasToTempFilePath({
          canvas,
          success: (res) => {
            this.setData({
              posterPath: res.tempFilePath,
              posterGenerating: false
            })
          },
          fail: () => {
            this.setData({ posterGenerating: false, posterShow: false })
            wx.showToast({ title: '海报生成失败', icon: 'none' })
          }
        }, this)
      })
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  },

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return
    // 简单按字符切，中英文混排
    let line = ''
    let yy = y
    const chars = text.split('')
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i]
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy)
        line = chars[i]
        yy += lineHeight
        if (yy - y > 100) break // 限高
      } else {
        line = test
      }
    }
    if (line) ctx.fillText(line, x, yy)
  },

  onHidePoster() {
    this.setData({ posterShow: false })
  },

  onSavePoster() {
    if (!this.data.posterPath) return
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterPath,
      success: () => {
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('auth') > -1) {
          wx.showModal({
            title: '需要授权',
            content: '保存图片需要相册授权',
            showCancel: false
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      }
    })
  },

  onRetry() {
    this.setData({ posterPath: '', posterShow: false })
    this.generatePoster()
  },

  onRetryAgain() {
    this.generatePoster()
  },

  // ===== 其他操作 =====
  onBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.redirectTo({ url: '/pages/discover/dna-hall/index' })
    }
  },

  onRetryQuiz() {
    const quizId = this.data.record && this.data.record.quizId
    if (quizId) {
      wx.redirectTo({
        url: '/pages/discover/dna-quiz/index?id=' + quizId
      })
    }
  },

  onBackToHall() {
    wx.redirectTo({
      url: '/pages/discover/dna-hall/index'
    })
  },

  onChatWithFigure() {
    const figureId = this.data.result && this.data.result.figureId
    if (!figureId) {
      wx.showToast({ title: '该人物暂未开放对话', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/chat/room/index?figureId=' + figureId,
      fail: () => {
        wx.showToast({ title: '对话页未就绪', icon: 'none' })
      }
    })
  },

  // ===== 3 层分享 =====
  onShareAppMessage() {
    const r = this.data.result || {}
    const sim = (this.data.record && this.data.record.similarity) || 88
    const title = `我的历史DNA是【${r.figureName || ''}${r.figureTitle ? '·' + r.figureTitle : ''}】匹配度${sim}%！你也来测测？`
    return {
      title,
      path: '/pages/discover/dna-result/index?recordId=' + this.data.recordId,
      imageUrl: this.data.posterPath || r.cover || ''
    }
  },

  onShareTimeline() {
    const r = this.data.result || {}
    const sim = (this.data.record && this.data.record.similarity) || 88
    return {
      title: `我的历史DNA是【${r.figureName || ''}】匹配度${sim}%！你也来测测？`,
      query: 'recordId=' + this.data.recordId,
      imageUrl: this.data.posterPath || ''
    }
  }
})
