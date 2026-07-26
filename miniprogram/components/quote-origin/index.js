Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    original: {
      type: String,
      value: ''
    },
    translation: {
      type: String,
      value: ''
    },
    source: {
      type: String,
      value: ''
    }
  },
  data: {
    expanded: true
  },
  observers: {},
  methods: {
    toggleTranslation() {
      this.setData({ expanded: !this.data.expanded })
    }
  }
})
