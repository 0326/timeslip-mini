Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    article: {
      type: Object,
      value: {}
    }
  },
  data: {},
  observers: {},
  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.properties.article._id })
    }
  }
})
