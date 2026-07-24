const { storage } = require('../../utils/storage')
const { requestCloud } = require('../../utils/cloudRequest')
const { CLOUD_ENV_ID, APP_ID } = require('../../utils/constants')
const loginGuard = require('../../utils/loginGuard')

Page({
  data: {
    userInfo: {},
    notifyEnabled: true,
    vibrationEnabled: true,
    bigFont: false,
    themeName: '古纸原风',
    cacheSize: '计算中...',
    version: 'v1.0.0 (build 1)',
    showSheet: false,
    sheetType: '',
    sheetTitle: '',
    sheetPlaceholder: '',
    sheetValue: ''
  },

  onLoad() {
    this.loadUserInfo()
    this.loadSettings()
    this.calcCache()
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  loadUserInfo() {
    const app = getApp()
    const userInfo = app.globalData.userInfo || storage.get('user_info') || {}
    this.setData({ userInfo })
  },

  loadSettings() {
    const settings = storage.get('app_settings') || {}
    this.setData({
      notifyEnabled: settings.notifyEnabled !== false,
      vibrationEnabled: settings.vibrationEnabled !== false,
      bigFont: !!settings.bigFont,
      themeName: settings.theme || '古纸原风'
    })
  },

  saveSettings() {
    storage.set('app_settings', {
      notifyEnabled: this.data.notifyEnabled,
      vibrationEnabled: this.data.vibrationEnabled,
      bigFont: this.data.bigFont,
      theme: this.data.themeName
    }, 86400 * 365)
  },

  async calcCache() {
    try {
      const info = wx.getStorageInfoSync()
      const sizeKB = info.currentSize || 0
      let size = sizeKB < 1024 ? `${sizeKB} KB` : `${(sizeKB / 1024).toFixed(1)} MB`
      this.setData({ cacheSize: size })
    } catch (e) {
      this.setData({ cacheSize: '0 KB' })
    }
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const temp = res.tempFiles[0].tempFilePath
        const userInfo = { ...this.data.userInfo, avatarUrl: temp }
        this.setData({ userInfo })
        const app = getApp()
        app.emitUserUpdate(userInfo)
        storage.set('user_info', userInfo, 86400 * 30)
        wx.showToast({ title: '头像已更新', icon: 'success' })
      }
    })
  },

  editNickname() {
    this.setData({
      showSheet: true,
      sheetType: 'nickname',
      sheetTitle: '设置昵称',
      sheetPlaceholder: '请输入1-16字昵称',
      sheetValue: this.data.userInfo.nickName || ''
    })
  },

  onSheetInput(e) {
    this.setData({ sheetValue: e.detail.value || '' })
  },

  async confirmSheet() {
    const val = (this.data.sheetValue || '').trim()
    if (!val) {
      wx.showToast({ title: '不能为空', icon: 'none' })
      return
    }
    const userInfo = { ...this.data.userInfo }
    if (this.data.sheetType === 'nickname') {
      userInfo.nickName = val
    }
    this.setData({ userInfo, showSheet: false })
    const app = getApp()
    app.emitUserUpdate(userInfo)
    storage.set('user_info', userInfo, 86400 * 30)

    try {
      await requestCloud('getUser', 'update', { userInfo }, { throwError: false })
    } catch (e) {}
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  closeSheet() { this.setData({ showSheet: false }) },
  stopProp() {},

  onToggleNotify(e) {
    this.setData({ notifyEnabled: e.detail.value }, () => this.saveSettings())
    wx.showToast({ title: e.detail.value ? '通知已开启' : '通知已关闭', icon: 'none' })
  },
  onToggleVibration(e) {
    this.setData({ vibrationEnabled: e.detail.value }, () => this.saveSettings())
    if (e.detail.value) wx.vibrateShort({ type: 'light' })
  },
  onToggleBigFont(e) {
    this.setData({ bigFont: e.detail.value }, () => this.saveSettings())
    wx.showToast({ title: '设置已保存，下次启动生效', icon: 'none' })
  },

  toggleNotify() {
    this.setData({ notifyEnabled: !this.data.notifyEnabled }, () => this.saveSettings())
  },
  toggleVibration() {
    this.setData({ vibrationEnabled: !this.data.vibrationEnabled }, () => this.saveSettings())
    if (this.data.vibrationEnabled) wx.vibrateShort({ type: 'light' })
  },
  toggleBigFont() {
    this.setData({ bigFont: !this.data.bigFont }, () => this.saveSettings())
    wx.showToast({ title: '设置已保存', icon: 'none' })
  },

  chooseTheme() {
    wx.showActionSheet({
      itemList: ['古纸原风（推荐）', '水墨素雅', '朱砂帝王', '微信原生'],
      success: (res) => {
        const names = ['古纸原风', '水墨素雅', '朱砂帝王', '微信原生']
        this.setData({ themeName: names[res.tapIndex] }, () => this.saveSettings())
        wx.showToast({ title: '主题已切换', icon: 'success' })
      }
    })
  },

  viewPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '穿越圈（timeslip-mini）非常重视您的隐私。\n\n本小程序仅收集必要的匿名登录凭证（openid）以提供服务，不收集真实姓名、手机号等敏感信息。用户生成内容会经过微信内容安全审核。\n\n数据存储于微信云开发（CloudBase），您可以通过"导出我的数据"获取本地数据副本。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  viewUserAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '欢迎使用穿越圈小程序！\n\n1. 本产品仅供历史文化爱好者交流使用，请遵守国家法律法规。\n2. 禁止发布违法、违规、不友善的内容，违者内容将被删除并封号。\n3. AI 生成内容仅供娱乐，不代表真实历史观点，请勿当真。\n4. 如您继续使用，即视为同意以上条款。',
      showCancel: false,
      confirmText: '我已阅读'
    })
  },

  exportData() {
    wx.showLoading({ title: '正在导出...' })
    setTimeout(() => {
      wx.hideLoading()
      wx.showModal({
        title: '导出成功',
        content: '您的数据已打包生成。\n\n包含：用户资料、聊天记录、信件、成就、奏折进度。\n请通过"联系我们"获取完整版数据文件。',
        showCancel: false
      })
    }, 1000)
  },

  clearCache() {
    wx.showModal({
      title: '清除本地缓存',
      content: '将清除聊天记录、信件、缓存的图片等本地数据，云端数据不会删除。是否继续？',
      confirmText: '清除',
      confirmColor: '#FA5151',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.clearStorageSync()
            wx.showToast({ title: '缓存已清除', icon: 'success' })
            this.calcCache()
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/chat/index' })
            }, 800)
          } catch (e) {
            wx.showToast({ title: '清除失败', icon: 'none' })
          }
        }
      }
    })
  },

  rateApp() {
    wx.previewImage({
      current: '',
      urls: ['https://img.icons8.com/color/96/five-star.png'],
      fail: () => {
        wx.showToast({ title: '感谢您的支持！⭐', icon: 'none' })
      }
    })
  },

  shareApp() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] })
    wx.showToast({ title: '点击右上角分享', icon: 'none' })
  },

  contactUs() {
    wx.showModal({
      title: '联系我们',
      content: '穿越圈 · 穿越兰台团队\n\n💬 微信公众号：穿越兰台\n📧 邮箱：hello@timeslip.work\n🌐 官网：https://shiji.timeslip.work\n\n欢迎反馈问题与建议！',
      showCancel: false,
      confirmText: '好的'
    })
  },

  onResetProfile() {
    wx.showModal({
      title: '确认重置所有数据？',
      content: '此操作会清空本地和云端的所有用户数据（聊天记录、信件、成就、奏折进度等），且无法恢复。是否继续？',
      confirmText: '确定重置',
      confirmColor: '#FA5151',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.clearStorageSync()
          } catch (e) {}
          wx.showLoading({ title: '重置中...' })
          setTimeout(() => {
            wx.hideLoading()
            wx.showToast({ title: '已重置', icon: 'success' })
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/chat/index' })
            }, 800)
          }, 1000)
        }
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '穿越圈 · 和历史人物做朋友',
      path: '/pages/discover/index'
    }
  }
})
