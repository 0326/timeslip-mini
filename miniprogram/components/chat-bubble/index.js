Component({
  options: {
    multipleSlots: true,
    styleIsolation: 'apply-shared'
  },
  properties: {
    msgId: { type: String, value: '' },
    isUser: { type: Boolean, value: false },
    content: { type: String, value: '' },
    figure: { type: Object, value: {} },
    userAvatar: { type: String, value: '' },
    showName: { type: Boolean, value: true },
    showTime: { type: Boolean, value: false },
    displayTime: { type: String, value: '' },
    typing: { type: Boolean, value: false }
  },
  data: {
    multiLine: false
  },
  observers: {
    'content': function (val) {
      this.setData({ multiLine: (val || '').includes('\n') || (val || '').length > 40 })
    }
  }
})
