const DYNASTY_MAP = {
  xianqin: '先秦', xia: '夏', shang: '商', zhou: '周', chunqiu: '春秋', zhanguo: '战国',
  han: '汉', xihan: '西汉', donghan: '东汉', sanguo: '三国',
  jin: '晋', nanbeichao: '南北',
  tang: '唐', wuzhou: '武周',
  song: '宋', beisong: '北宋', nansong: '南宋',
  yuan: '元', ming: '明', qing: '清'
}

const DYNASTY_BG = {
  han: ['#8B4513', '#CD853F'],
  tang: ['#8B008B', '#DB7093'],
  song: ['#228B22', '#6B8E23'],
  sanguo: ['#2F4F4F', '#708090'],
  ming: ['#8B0000', '#CD5C5C'],
  qing: ['#B8860B', '#DAA520'],
  xianqin: ['#4B0082', '#7B68EE'],
  default: ['#6b7280', '#9ca3af']
}

Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    figure: { type: Object, value: {} },
    size: { type: String, value: 'md' },
    shape: { type: String, value: 'circle' },
    locked: { type: Boolean, value: false },
    showBorder: { type: Boolean, value: false },
    showDynasty: { type: Boolean, value: false },
    lazyLoad: { type: Boolean, value: true },
    round: { type: Boolean, value: false }
  },
  data: {
    initials: '',
    dynastyShort: '',
    bgStyle: '',
    shapeClass: 'circle',
    imageError: false,
    showImage: false,
    avatarSrc: ''
  },
  observers: {
    'figure, size, shape, round': function () {
      this.updateView()
    }
  },
  lifetimes: {
    attached() {
      this.updateView()
    }
  },
  methods: {
    getRawAvatarSrc(f) {
      if (!f) return ''
      // 按优先级尝试所有可能的头像字段名（优先使用mini_avatar_url小头像）
      return f.mini_avatar_url
        || f.miniAvatarUrl
        || f.avatar_url
        || f.avatarUrl
        || f.avatar
        || f.portrait
        || f.portraitUrl
        || f.image
        || f.img
        || ''
    },

    normalizeAndResolveAvatar(rawSrc) {
      if (!rawSrc || typeof rawSrc !== 'string') {
        this.setData({ avatarSrc: '', showImage: false })
        return
      }
      let value = rawSrc.trim()
      if (!value) {
        this.setData({ avatarSrc: '', showImage: false })
        return
      }

      // 过滤临时文件路径
      if (/^(wxfile|http:\/\/tmp|https?:\/\/tmp|https?:\/\/127\.0\.0\.1|https?:\/\/localhost|\/tmp\/|tmp\/)/i.test(value)) {
        this.setData({ avatarSrc: '', showImage: false })
        return
      }

      // 处理 /api/asset/ 开头的路径
      if (value.startsWith('/api/asset/')) {
        value = `https://timeslip.work${value}`
        this.setData({ avatarSrc: value, showImage: true, imageError: false })
        return
      }

      // 已经是 http/https 开头的URL
      if (/^https?:\/\//i.test(value)) {
        this.setData({ avatarSrc: value, showImage: true, imageError: false })
        return
      }

      // 本地路径 /images/...
      if (value.startsWith('/')) {
        this.setData({ avatarSrc: value, showImage: true, imageError: false })
        return
      }

      // cloud:// 开头的云存储 fileID，需要换取临时URL
      if (value.indexOf('cloud://') === 0) {
        this.resolveCloudUrl(value)
        return
      }

      // 其他情况不显示图片，显示文字头像
      this.setData({ avatarSrc: '', showImage: false })
    },

    resolveCloudUrl(fileID) {
      try {
        wx.cloud.getTempFileURL({
          fileList: [fileID],
          success: (res) => {
            if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
              this.setData({
                avatarSrc: res.fileList[0].tempFileURL,
                showImage: true,
                imageError: false
              })
            } else {
              this.setData({ avatarSrc: '', showImage: false })
            }
          },
          fail: () => {
            console.warn('[figure-avatar] 云文件URL获取失败:', fileID)
            this.setData({ avatarSrc: '', showImage: false })
          }
        })
      } catch (e) {
        console.warn('[figure-avatar] wx.cloud 不可用:', e)
        this.setData({ avatarSrc: '', showImage: false })
      }
    },

    updateView() {
      const f = this.properties.figure || {}
      const name = f.figureName || f.name || ''
      const initials = name ? name.slice(0, 1) : '古'
      const dynasty = f.dynasty || f.dynastyKey || ''
      const dynastyShort = (DYNASTY_MAP[dynasty] || '').slice(0, 2) || ''
      const bg = DYNASTY_BG[dynasty] || DYNASTY_BG.default
      const bgStyle = `background: linear-gradient(135deg, ${bg[0]} 0%, ${bg[1]} 100%);`
      const isSquare = this.properties.shape === 'square'
      const shapeClass = isSquare ? 'shape-square' : 'shape-circle'

      this.setData({ initials, dynastyShort, bgStyle, shapeClass })

      const rawAvatar = this.getRawAvatarSrc(f)
      this.normalizeAndResolveAvatar(rawAvatar)
    },

    onImageError() {
      console.warn('[figure-avatar] 头像图片加载失败，回退到文字头像:', this.data.avatarSrc)
      this.setData({ imageError: true, showImage: false })
      this.triggerEvent('error', { figure: this.properties.figure })
    },

    onTap(e) {
      this.triggerEvent('tap', { figure: this.properties.figure }, e)
    }
  }
})
