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
      const f = this.properties.figure || {}
      const name = f.figureName || f.name || ''
      const initials = name ? name.slice(0, 1) : '古'
      const dynasty = f.dynasty || ''
      const dynastyShort = (DYNASTY_MAP[dynasty] || '').slice(0, 2) || ''
      const bg = DYNASTY_BG[dynasty] || DYNASTY_BG.default
      const bgStyle = `background: linear-gradient(135deg, ${bg[0]} 0%, ${bg[1]} 100%);`
      const isSquare = this.properties.shape === 'square'
      const shapeClass = isSquare ? 'shape-square' : 'shape-circle'
      const avatarSrc = this.normalizeAvatarSrc(f.avatar || f.avatarUrl || f.miniAvatarUrl || '')
      const imageError = avatarSrc === this.data.avatarSrc ? this.data.imageError : false
      const showImage = !!avatarSrc && !imageError
      this.setData({ initials, dynastyShort, bgStyle, shapeClass, avatarSrc, imageError, showImage })
    }
  },
  lifetimes: {
    attached() {
      const f = this.properties.figure || {}
      const avatarSrc = this.normalizeAvatarSrc(f.avatar || f.avatarUrl || f.miniAvatarUrl || '')
      this.setData({ avatarSrc, showImage: !!avatarSrc && !this.data.imageError })
    }
  },
  methods: {
    normalizeAvatarSrc(src) {
      if (!src || typeof src !== 'string') return ''
      const value = src.trim()
      if (/^(wxfile|http:\/\/tmp|https?:\/\/tmp|https?:\/\/127\.0\.0\.1|https?:\/\/localhost|\/tmp\/|tmp\/)/i.test(value)) {
        return ''
      }
      if (/^(https?:\/\/|cloud:\/\/)/i.test(value)) return value
      return ''
    },
    onImageError() {
      this.setData({ imageError: true, showImage: false })
      this.triggerEvent('error', { figure: this.properties.figure })
    },
    onTap(e) {
      this.triggerEvent('tap', { figure: this.properties.figure }, e)
    }
  }
})
