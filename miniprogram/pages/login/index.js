const { login } = require('../../utils/auth')
const { isLoggedIn } = require('../../utils/loginGuard')

Page({
  data: {
    form: {
      avatarUrl: '',
      nickName: '',
      agreed: false
    },
    canSubmit: false,
    submitting: false
  },

  onLoad() {
    if (isLoggedIn()) {
      wx.switchTab({ url: '/pages/chat/index' })
    }
    this.updateCanSubmit()
  },

  onShow() {
    if (isLoggedIn()) {
      wx.switchTab({ url: '/pages/chat/index' })
    }
  },

  updateCanSubmit() {
    const { avatarUrl, nickName, agreed } = this.data.form
    this.setData({
      canSubmit: !!(avatarUrl && nickName && nickName.trim() && agreed)
    })
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    if (avatarUrl) {
      this.setData({ 'form.avatarUrl': avatarUrl }, () => this.updateCanSubmit())
    }
  },

  onNicknameInput(e) {
    const v = (e.detail.value || '').trim()
    this.setData({ 'form.nickName': v }, () => this.updateCanSubmit())
  },

  onNicknameBlur(e) {
    const v = (e.detail.value || '').trim()
    if (v && v !== this.data.form.nickName) {
      this.setData({ 'form.nickName': v }, () => this.updateCanSubmit())
    }
  },

  onToggleAgree() {
    this.setData({ 'form.agreed': !this.data.form.agreed }, () => this.updateCanSubmit())
  },

  onOpenAgreement() {
    wx.navigateTo({ url: '/pages/login/agreement' })
  },

  async onSubmit() {
    if (this.data.submitting) return
    if (!this.data.canSubmit) {
      if (!this.data.form.avatarUrl) {
        wx.showToast({ title: '请选择头像', icon: 'none' })
      } else if (!this.data.form.nickName || !this.data.form.nickName.trim()) {
        wx.showToast({ title: '请填写昵称', icon: 'none' })
      } else if (!this.data.form.agreed) {
        wx.showToast({ title: '请先勾选并阅读协议', icon: 'none' })
      }
      return
    }

    const { avatarUrl, nickName } = this.data.form
    const trimmedNick = nickName.trim()

    this.setData({ submitting: true })
    wx.showLoading({ title: '登录中...', mask: true })
    try {
      const result = await login(trimmedNick, avatarUrl)
      wx.hideLoading()
      if (result.ok) {
        wx.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => {
          wx.switchTab({ url: '/pages/chat/index' })
        }, 400)
      } else {
        wx.showToast({ title: result.message || '登录失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '登录异常', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
