Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    autoplay: { type: Boolean, value: true },
    size: { type: String, value: 'md' },
    showLetter: { type: Boolean, value: true },
    showTrail: { type: Boolean, value: false },
    showText: { type: Boolean, value: false }
  },
  data: {
    flying: false,
    sizeStyle: ''
  },
  observers: {
    'autoplay, size': function (ap, sz) {
      const sizes = {
        sm: '--sz: 80rpx;',
        md: '--sz: 120rpx;',
        lg: '--sz: 180rpx;',
        xl: '--sz: 240rpx;'
      }
      this.setData({
        flying: !!ap,
        sizeStyle: sizes[sz] || sizes.md
      })
    }
  },
  lifetimes: {
    attached() {
      if (this.properties.autoplay) {
        setTimeout(() => this.setData({ flying: true }), 100)
      }
    }
  },
  methods: {
    play() { this.setData({ flying: true }) },
    pause() { this.setData({ flying: false }) },
    restart() {
      this.setData({ flying: false })
      setTimeout(() => this.setData({ flying: true }), 50)
    }
  }
})
