Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    value: { type: String, value: '' },
    placeholder: { type: String, value: '说点什么...' },
    maxLength: { type: Number, value: 500 },
    safeBottom: { type: Number, value: 0 },
    disabled: { type: Boolean, value: false },
    canSend: { type: Boolean, value: false },
    showVoice: { type: Boolean, value: false },
    showImage: { type: Boolean, value: false },
    showEmoji: { type: Boolean, value: true },
    quickReplies: { type: Array, value: [] }
  },
  data: {
    focused: false
  },
  methods: {
    onInput(e) {
      const value = e.detail.value
      this.triggerEvent('input', { value })
      this.triggerEvent('change', { value })
    },
    onFocus(e) {
      this.setData({ focused: true })
      this.triggerEvent('focus', e.detail)
    },
    onBlur(e) {
      setTimeout(() => this.setData({ focused: false }), 150)
      this.triggerEvent('blur', e.detail)
    },
    onConfirm() {
      if (!this.data.canSend || this.data.disabled) return
      this.triggerEvent('send', { value: this.data.value })
    },
    onSend() {
      if (!this.data.canSend || this.data.disabled) return
      this.triggerEvent('send', { value: this.data.value })
    },
    onQuick(e) {
      const text = e.currentTarget.dataset.text
      this.triggerEvent('quick', { text })
      this.triggerEvent('send', { value: text })
    },
    onVoice() { this.triggerEvent('voice') },
    onImage() { this.triggerEvent('image') },
    onEmoji() { this.triggerEvent('emoji') }
  }
})
