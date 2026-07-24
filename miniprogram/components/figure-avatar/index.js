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
  qing: ['#FFD700', '#DAA520'],
  xianqin: ['#4B0082', '#7B68EE'],
  default: ['#8B4513', '#CD853F']
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
    fallback: {
      type: String,
      value: 'https://img.icons8.com/color/96/emperor.png'
    }
  },
  data: {
    initials: '',
    dynastyShort: '',
    bgStyle: ''
  },
  observers: {
    'figure, size': function () {
      const f = this.properties.figure || {}
      const name = f.figureName || f.name || ''
      const initials = name ? name.slice(0, 1) : '古'
      const dynasty = f.dynasty || ''
      const dynastyShort = (DYNASTY_MAP[dynasty] || '').slice(0, 2) || ''
      const bg = DYNASTY_BG[dynasty] || DYNASTY_BG.default
      const bgStyle = `background: linear-gradient(135deg, ${bg[0]} 0%, ${bg[1]} 100%);`
      this.setData({ initials, dynastyShort, bgStyle })
    }
  },
  methods: {
    onTap(e) {
      this.triggerEvent('tap', { figure: this.properties.figure }, e)
    }
  }
})
