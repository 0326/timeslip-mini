const { login } = require('../../utils/auth')
const { isLoggedIn } = require('../../utils/loginGuard')
const { storage } = require('../../utils/storage')
const { requestCloud } = require('../../utils/cloudRequest')

Page({
  data: {
    form: {
      avatarUrl: '',
      nickName: '',
      agreed: false
    },
    canSubmit: false,
    submitting: false,
    checking: true
  },

  onLoad() {
    this.tryAutoLogin()
  },

  onShow() {
    if (isLoggedIn()) {
      wx.switchTab({ url: '/pages/chat/index' })
      return
    }
    if (!this.data.checking) {
      this.updateCanSubmit()
    }
  },

  async tryAutoLogin() {
    try {
      const data = await requestCloud('getUser', 'get', {}, { throwError: false })
      if (data && data._openid && data.nickName && data.avatarUrl) {
        // 已注册，恢复登录态
        const app = getApp()
        if (!app.globalData) app.globalData = {}
        app.globalData.openid = data._openid
        app.globalData.userInfo = data
        app.globalData.points = data.points || 0
        app.globalData.memberLevel = data.memberLevel || '普通会员'
        app.globalData.crossNo = data.crossNo || ''
        storage.set('userInfo', data, 3600)
        if (app.emitUserUpdate) app.emitUserUpdate(data)

        wx.showToast({ title: '欢迎回来', icon: 'success' })
        setTimeout(() => {
          wx.switchTab({ url: '/pages/chat/index' })
        }, 400)
        return
      }
    } catch (e) {
      // 用户不存在或网络错误，正常显示登录页
    }
    this.setData({ checking: false })
    this.updateCanSubmit()
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
