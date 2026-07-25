const { getUserInfo, updateUserInfo } = require('../../utils/auth')
const { requestCloud } = require('../../utils/cloudRequest')
const loginGuard = require('../../utils/loginGuard')

const MENU_LIST = [
  { key: 'letters', iconClass: 'mail', name: '信鸽驿站', desc: '历史信件往来', url: '/pages/profile/letters' },
  { key: 'settings', iconClass: 'more', name: '设置', desc: '隐私与偏好', url: '/pages/profile/settings' }
]

const STAT_MENUS = [
  { key: 'chats', num: 0, label: '对话次数', iconClass: 'chat' },
  { key: 'letters', num: 0, label: '飞鸽书信', iconClass: 'mail' },
  { key: 'memorials', num: 0, label: '奏折批阅', iconClass: 'daipiyue' }
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
    const app = getApp()
    const cached = app.globalData && app.globalData.userInfo
    if (cached) this.setData({ userInfo: cached })

    try {
      const userInfo = await getUserInfo()
      if (userInfo && userInfo._openid) {
        this.setData({ userInfo })
        if (!app.globalData) app.globalData = {}
        app.globalData.openid = userInfo._openid
        app.globalData.userInfo = userInfo
        app.globalData.points = userInfo.points || 0
        app.globalData.memberLevel = userInfo.memberLevel || '普通会员'
        app.globalData.crossNo = userInfo.crossNo || ''
        const { storage } = require('../../utils/storage')
        storage.set('userInfo', userInfo, 86400)
      }
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
      itemList: ['修改头像', '修改昵称'],
      success: (r) => {
        if (r.tapIndex === 0) this.doChooseAvatar()
        else if (r.tapIndex === 1) this.doEditName()
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
  }
})
