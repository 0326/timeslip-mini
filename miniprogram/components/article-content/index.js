Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    content: {
      type: Array,
      value: []
    }
  },
  data: {},
  observers: {},
  methods: {
    onFigureTap(e) {
      this.triggerEvent('figuretap', { id: e.currentTarget.dataset.id })
    }
  }
})
