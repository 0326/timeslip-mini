Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    poll: {
      type: Object,
      value: {}
    },
    voted: {
      type: Boolean,
      value: false
    },
    results: {
      type: Object,
      value: null
    }
  },
  data: {
    selectedOption: -1
  },
  observers: {},
  methods: {
    onSelect(e) {
      const index = e.currentTarget.dataset.index
      this.setData({ selectedOption: index })
    },
    onVote() {
      if (this.data.selectedOption < 0) return
      this.triggerEvent('vote', { optionIndex: this.data.selectedOption })
    }
  }
})
