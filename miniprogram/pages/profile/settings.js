const { storage } = require('../../utils/storage')

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
    const settings = {
      notifyEnabled: this.data.notifyEnabled,
      vibrationEnabled: this.data.vibrationEnabled,
      bigFont: this.data.bigFont,
      theme: this.data.themeName
    }
    storage.set('app_settings', settings, 86400 * 365)
    const app = getApp()
    if (app && app.applySettings) app.applySettings(settings)
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
    const v = e.detail.value
    if (v) {
      wx.requestSubscribeMessage({
        tmplIds: ['tmpl_achievement_unlocked', 'tmpl_letter_arrived'],
        success: () => {
          this.setData({ notifyEnabled: true }, this.saveSettings)
          wx.showToast({ title: '通知已开启', icon: 'none' })
        },
        fail: () => {
          this.setData({ notifyEnabled: false }, this.saveSettings)
          wx.showToast({ title: '通知开启失败', icon: 'none' })
        }
      })
    } else {
      this.setData({ notifyEnabled: false }, this.saveSettings)
      wx.showToast({ title: '通知已关闭', icon: 'none' })
    }
  },
  onToggleVibration: function (e) {
    this.setData({ vibrationEnabled: e.detail.value }, this.saveSettings)
    if (e.detail.value) wx.vibrateShort({ type: 'light' })
  },
  onToggleBigFont: function (e) {
    const v = e.detail.value
    this.setData({ bigFont: v }, () => {
      this.saveSettings()
      const app = getApp()
      if (app && app.applySettings) {
        app.applySettings({ bigFont: v })
      }
      wx.showToast({ title: '已生效', icon: 'none' })
    })
  },

  chooseTheme: function () {
    const self = this
    wx.showActionSheet({
      itemList: ['古纸原风（推荐）', '水墨素雅', '朱砂帝王', '微信原生'],
      success(res) {
        const names = ['古纸原风', '水墨素雅', '朱砂帝王', '微信原生']
        const name = names[res.tapIndex]
        self.setData({ themeName: name }, () => {
          self.saveSettings()
          const app = getApp()
          if (app && app.applySettings) app.applySettings({ themeName: name })
          wx.showToast({ title: '主题已切换', icon: 'success' })
        })
      }
    })
  },

  async exportData() {
    wx.showLoading({ title: '正在导出...' })
    try {
      const { requestCloud } = require('../../utils/cloudRequest')
      const data = await requestCloud('getUser', 'export', {}, { throwError: false })
      if (data && data.fileID) {
        const r = await wx.cloud.downloadFile({ fileID: data.fileID })
        wx.hideLoading()
        wx.openDocument({
          filePath: r.tempFilePath,
          fileType: 'json',
          success: () => {},
          fail: () => {
            wx.showToast({ title: '已保存到文件', icon: 'success' })
          }
        })
      } else {
        wx.hideLoading()
        wx.showToast({ title: '导出失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
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
    const self = this
    wx.showModal({
      title: '确认重置所有数据？',
      content: '此操作会清空云端的所有用户数据（聊天记录、信件、成就、奏折进度等），且无法恢复。是否继续？',
      confirmText: '确定重置',
      confirmColor: '#FA5151',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '重置中...' })
        try {
          const { requestCloud } = require('../../utils/cloudRequest')
          await requestCloud('getUser', 'reset', {}, { throwError: false })
          try { wx.clearStorageSync() } catch (e) {}
          wx.hideLoading()
          wx.showToast({ title: '已重置', icon: 'success' })
          setTimeout(() => wx.reLaunch({ url: '/pages/login/index' }), 800)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '重置失败', icon: 'none' })
        }
      }
    })
  }
})
