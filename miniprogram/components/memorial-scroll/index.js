Component({
  options: {
    multipleSlots: true,
    styleIsolation: 'apply-shared'
  },
  properties: {
    title: { type: String, value: '' },
    content: { type: String, value: '' },
    submitter: { type: String, value: '' },
    dynasty: { type: String, value: '' },
    zhupi: { type: String, value: '' },
    showZhuPi: { type: Boolean, value: true }
  },
  data: {},
  methods: {}
})
