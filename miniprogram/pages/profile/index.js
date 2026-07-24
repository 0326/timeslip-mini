const { ensureUser, updateUserInfo } = require('../../utils/auth')
const { requestCloud } = require('../../utils/cloudRequest')
const loginGuard = require('../../utils/loginGuard')

const MENU_LIST = [
  { key: 'letters', icon: '🕊️', name: '信鸽驿站', desc: '历史信件往来', url: '/pages/profile/letters', right: '›' },
  { key: 'settings', icon: '⚙️', name: '设置', desc: '隐私与偏好', url: '/pages/profile/settings', right: '›' }
]

const STAT_MENUS = [
  { key: 'chatCount', num: 0, label: '对话次数', icon: '💬' },
  { key: 'letterCount', num: 0, label: '飞鸽书信', icon: '🕊️' },
  { key: 'memorialCount', num: 0, label: '奏折批阅', icon: '📜' }
]

Page({
  data: {
    userInfo: null,
    menus: MENU_LIST,
    stats: STAT_MENUS
  },

  onLoad() {
    this.refreshUser()
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 3)
    if (!loginGuard.checkLogin(this)) return
    this.refreshUser()
    this.loadStats()
  },

  async refreshUser() {
    try {
      const userInfo = await ensureUser(this)
      if (userInfo) this.setData({ userInfo })
    } catch (e) {
      console.warn('refreshUser failed:', e)
    }
  },

  async loadStats() {
    try {
      const data = await requestCloud('getUser', 'stats', {}, { throwError: false })
      if (data) {
        const stats = this.data.stats.map(s => ({
          ...s,
          num: data[s.key] || 0
        }))
        this.setData({ stats })
      }
    } catch (e) {}
  },

  onMenuTap(e) {
    const { url } = e.currentTarget.dataset
    if (!url) return
    wx.navigateTo({
      url,
      fail: () => wx.showToast({ title: '开发中', icon: 'none' })
    })
  },

  onEditAvatar() {
    wx.showActionSheet({
      itemList: ['修改头像', '修改昵称', '修改古风名号'],
      success: (r) => {
        if (r.tapIndex === 0) this.doChooseAvatar()
        else if (r.tapIndex === 1) this.doEditName()
        else if (r.tapIndex === 2) this.doEditAncientName()
      }
    })
  },

  doChooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (r) => {
        const tempFile = r.tempFiles[0].tempFilePath
        wx.showLoading({ title: '上传中' })
        const openid = (getApp().globalData || {}).openid || 'tmp'
        const cloudPath = `avatar/${openid}/${Date.now()}_avatar.jpg`
        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFile,
          success: (up) => {
            updateUserInfo({ avatarUrl: up.fileID })
              .then((ok) => {
                wx.hideLoading()
                if (ok) {
                  this.refreshUser()
                  wx.showToast({ title: '修改成功' })
                }
              })
          },
          fail: () => wx.hideLoading()
        })
      }
    })
  },

  doEditName() {
    const cur = (this.data.userInfo || {}).nickName || ''
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入昵称',
      content: cur,
      success: (r) => {
        if (!r.confirm || !r.content) return
        updateUserInfo({ nickName: r.content.trim() }).then(ok => {
          if (ok) {
            this.refreshUser()
            wx.showToast({ title: '已更新' })
          }
        })
      }
    })
  },

  doEditAncientName() {
    const cur = (this.data.userInfo || {}).ancientName || ''
    wx.showModal({
      title: '修改古风名号',
      editable: true,
      placeholderText: '例：青衫居士',
      content: cur,
      success: (r) => {
        if (!r.confirm || !r.content) return
        updateUserInfo({ ancientName: r.content.trim() }).then(ok => {
          if (ok) {
            this.refreshUser()
            wx.showToast({ title: '已更新' })
          }
        })
      }
    })
  }
})
