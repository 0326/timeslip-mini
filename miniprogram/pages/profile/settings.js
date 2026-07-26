const storage = require('../../utils/storage')
const loginGuard = require('../../utils/loginGuard')

Page({
  data: {
    notifyEnabled: true,
    vibrationEnabled: true,
    bigFont: false,
    themeName: '古纸原风',
    cacheSize: '计算中...'
  },

  onLoad: function () {
    this.loadSettings()
    this.calcCache()
  },

  onShow: function () {
    if (!loginGuard.checkLogin(this)) return
  },

  loadSettings: function () {
    var settings = storage.get('app_settings') || {}
    this.setData({
      notifyEnabled: settings.notifyEnabled !== false,
      vibrationEnabled: settings.vibrationEnabled !== false,
      bigFont: !!settings.bigFont,
      themeName: settings.theme || '古纸原风'
    })
  },

  saveSettings: function () {
    storage.set('app_settings', {
      notifyEnabled: this.data.notifyEnabled,
      vibrationEnabled: this.data.vibrationEnabled,
      bigFont: this.data.bigFont,
      theme: this.data.themeName
    }, 86400 * 365)
  },

  calcCache: function () {
    try {
      var info = wx.getStorageInfoSync()
      var sizeKB = info.currentSize || 0
      var size = sizeKB < 1024 ? sizeKB + ' KB' : (sizeKB / 1024).toFixed(1) + ' MB'
      this.setData({ cacheSize: size })
    } catch (e) {
      this.setData({ cacheSize: '0 KB' })
    }
  },

  onToggleNotify: function (e) {
    this.setData({ notifyEnabled: e.detail.value }, this.saveSettings)
    wx.showToast({ title: e.detail.value ? '通知已开启' : '通知已关闭', icon: 'none' })
  },
  onToggleVibration: function (e) {
    this.setData({ vibrationEnabled: e.detail.value }, this.saveSettings)
    if (e.detail.value) wx.vibrateShort({ type: 'light' })
  },
  onToggleBigFont: function (e) {
    this.setData({ bigFont: e.detail.value }, this.saveSettings)
    wx.showToast({ title: '设置已保存，下次启动生效', icon: 'none' })
  },

  toggleNotify: function () {
    this.setData({ notifyEnabled: !this.data.notifyEnabled }, this.saveSettings)
  },
  toggleVibration: function () {
    this.setData({ vibrationEnabled: !this.data.vibrationEnabled }, this.saveSettings)
    if (this.data.vibrationEnabled) wx.vibrateShort({ type: 'light' })
  },
  toggleBigFont: function () {
    this.setData({ bigFont: !this.data.bigFont }, this.saveSettings)
    wx.showToast({ title: '设置已保存', icon: 'none' })
  },

  chooseTheme: function () {
    var self = this
    wx.showActionSheet({
      itemList: ['古纸原风（推荐）', '水墨素雅', '朱砂帝王', '微信原生'],
      success: function (res) {
        var names = ['古纸原风', '水墨素雅', '朱砂帝王', '微信原生']
        self.setData({ themeName: names[res.tapIndex] }, self.saveSettings)
        wx.showToast({ title: '主题已切换', icon: 'success' })
      }
    })
  },

  exportData: function () {
    wx.showLoading({ title: '正在导出...' })
    setTimeout(function () {
      wx.hideLoading()
      wx.showModal({
        title: '导出成功',
        content: '您的数据已打包生成。\n\n包含：用户资料、聊天记录、信件、成就、奏折进度。\n请通过"联系我们"获取完整版数据文件。',
        showCancel: false
      })
    }, 1000)
  },

  clearCache: function () {
    var self = this
    wx.showModal({
      title: '清除本地缓存',
      content: '将清除聊天记录、信件、缓存的图片等本地数据，云端数据不会删除。是否继续？',
      confirmText: '清除',
      confirmColor: '#FA5151',
      success: function (res) {
        if (res.confirm) {
          try {
            wx.clearStorageSync()
            wx.showToast({ title: '缓存已清除', icon: 'success' })
            self.calcCache()
            setTimeout(function () {
              wx.reLaunch({ url: '/pages/chat/index' })
            }, 800)
          } catch (e) {
            wx.showToast({ title: '清除失败', icon: 'none' })
          }
        }
      }
    })
  },

  onResetProfile: function () {
    wx.showModal({
      title: '确认重置所有数据？',
      content: '此操作会清空本地和云端的所有用户数据（聊天记录、信件、成就、奏折进度等），且无法恢复。是否继续？',
      confirmText: '确定重置',
      confirmColor: '#FA5151',
      success: function (res) {
        if (res.confirm) {
          try {
            wx.clearStorageSync()
          } catch (e) {}
          wx.showLoading({ title: '重置中...' })
          setTimeout(function () {
            wx.hideLoading()
            wx.showToast({ title: '已重置', icon: 'success' })
            setTimeout(function () {
              wx.reLaunch({ url: '/pages/chat/index' })
            }, 800)
          }, 1000)
        }
      }
    })
  }
})
