const { login } = require('../../utils/auth')
const { isLoggedIn } = require('../../utils/loginGuard')
const { storage } = require('../../utils/storage')
const { requestCloud } = require('../../utils/cloudRequest')
const { isTemporaryFileUrl } = require('../../utils/helpers')
const { canIUseChooseAvatar } = require('../../utils/platform')

function uploadAvatarFile(filePath) {
  return new Promise((resolve, reject) => {
    if (!filePath || !isTemporaryFileUrl(filePath)) {
      resolve(filePath || '')
      return
    }

    const extMatch = filePath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
    const ext = (extMatch && extMatch[1]) || 'jpg'
    const cloudPath = `avatar/login/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res) => {
        if (res && res.fileID) resolve(res.fileID)
        else reject(new Error('头像上传失败'))
      },
      fail: reject
    })
  })
}

Page({
  data: {
    form: {
      avatarUrl: '',
      nickName: '',
      agreed: false
    },
    canSubmit: false,
    submitting: false,
    showRegister: false,
    profileRepair: false,
    redirect: '',
    needLogin: true,
    canUseChooseAvatar: canIUseChooseAvatar()
  },

  onLoad(options) {
    this.setData({
      redirect: options.redirect || '',
      needLogin: options.needLogin !== 'false'
    })
    this.checkUserStatus()
  },

  onShow() {
    if (isLoggedIn()) {
      this.goTarget()
      return
    }
    if (this.data.showRegister) {
      this.updateCanSubmit()
    }
  },

  async checkUserStatus() {
    try {
      const data = await requestCloud('getUser', 'get', {}, { throwError: false })
      if (data && data._openid && data.nickName && data.avatarUrl && !isTemporaryFileUrl(data.avatarUrl)) {
        const app = getApp()
        if (!app.globalData) app.globalData = {}
        app.globalData.openid = data._openid
        app.globalData.userInfo = data
        app.globalData.points = data.points || 0
        app.globalData.memberLevel = data.memberLevel || '普通会员'
        app.globalData.crossNo = data.crossNo || ''
        storage.set('userInfo', data, 86400)
        if (app.emitUserUpdate) app.emitUserUpdate(data)

        setTimeout(() => { this.goTarget() }, 600)
        return
      }
      if (data && data._openid) {
        this.setData({
          profileRepair: true,
          'form.nickName': data.nickName || '',
          'form.agreed': true
        })
      }
    } catch (e) {}

    if (!this.data.needLogin) {
      setTimeout(() => { this.goBack() }, 600)
      return
    }

    setTimeout(() => {
      this.setData({ showRegister: true })
      this.updateCanSubmit()
    }, 400)
  },

  goTarget() {
    const redirect = this.data.redirect
    if (redirect) {
      try {
        const decoded = decodeURIComponent(redirect)
        if (decoded.indexOf('tab:') === 0) {
          wx.switchTab({ url: decoded.replace('tab:', '') })
        } else {
          wx.redirectTo({
            url: decoded,
            fail: () => { wx.switchTab({ url: '/pages/chat/index' }) }
          })
        }
        return
      } catch (e) {}
    }
    wx.switchTab({ url: '/pages/chat/index' })
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ fail: () => { wx.switchTab({ url: '/pages/chat/index' }) } })
    } else {
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

  // Donut App/H5 端：使用 chooseMedia / chooseImage 选择本地图片作为头像
  onChooseAvatarLocal() {
    const done = (filePath) => {
      if (!filePath) return
      this.setData({ 'form.avatarUrl': filePath }, () => this.updateCanSubmit())
    }
    try {
      if (typeof wx.chooseMedia === 'function') {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: (res) => {
            const f = res && res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
            done(f)
          },
          fail: () => {}
        })
        return
      }
      if (typeof wx.chooseImage === 'function') {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: (res) => {
            done(res && res.tempFilePaths && res.tempFilePaths[0])
          },
          fail: () => {}
        })
        return
      }
      wx.showToast({ title: '当前环境无法选择图片', icon: 'none' })
    } catch (e) {
      wx.showToast({ title: '选择图片失败', icon: 'none' })
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
      const stableAvatarUrl = await uploadAvatarFile(avatarUrl)
      const result = await login(trimmedNick, stableAvatarUrl)
      wx.hideLoading()
      if (result.ok) {
        wx.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => { this.goTarget() }, 500)
      } else {
        wx.showToast({ title: result.message || '登录失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err && err.message ? err.message : '登录异常', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
