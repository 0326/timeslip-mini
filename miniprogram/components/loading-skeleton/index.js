Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    rows: { type: Array, value: [] },
    count: { type: Number, value: 4 },
    active: { type: Boolean, value: true },
    title: { type: String, value: '' }
  },
  data: {
    displayRows: []
  },
  observers: {
    'count, rows': function (count, rows) {
      if (rows && rows.length) return
      this.setData({ displayRows: new Array(count).fill(0) })
    }
  }
})
