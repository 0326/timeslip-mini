const { getUserInfo, updateUserInfo } = require('../../utils/auth')
const loginGuard = require('../../utils/loginGuard')
const { resolveAvatarUrl } = require('../../utils/helpers')

var MENU_LIST = [
  { key: 'bookmarks', iconClass: 'mail', name: '我的收藏', desc: '看一看收藏的文章', url: '/pages/discover/look/bookmarks', color: '#1890FF' },
  { key: 'achievements', iconClass: 'cyc', name: '穿越成就', desc: '解锁历史成就', url: '/pages/profile/achievements', color: '#722ED1' },
  { key: 'about', iconClass: 'details', name: '关于我们', desc: '版本信息与反馈', url: '/pages/profile/about', color: '#C9A24D' },
  { key: 'privacy', iconClass: 'warn', name: '隐私与协议', desc: '隐私政策与用户协议', url: '/pages/profile/privacy', color: '#52C41A' },
  { key: 'settings', iconClass: 'more', name: '设置', desc: '偏好与数据管理', url: '/pages/profile/settings', color: '#999999' }
]

Page({
  data: {
    userInfo: null,
    avatarSrc: '/images/icons/avatar.png',
    menus: MENU_LIST,
    statusBarHeight: 40,
    isAdmin: false,
    version: 'v1.0.0'
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      const rpxRatio = 750 / sys.windowWidth
      this.setData({ statusBarHeight: Math.round((sys.statusBarHeight || 20) * rpxRatio) })
    } catch (e) {}
    try {
      const info = wx.getAccountInfoSync && wx.getAccountInfoSync()
      if (info && info.miniProgram && info.miniProgram.version) {
        this.setData({ version: 'v' + info.miniProgram.version })
      }
    } catch (e) {}
    this.refreshUser()
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 3)
    if (!loginGuard.checkLogin(this)) return
    this.refreshUser()
  },

  async refreshUser() {
    var self = this
    const app = getApp()
    const cached = app.globalData && app.globalData.userInfo
    if (cached) {
      this.setData({ userInfo: cached })
      if (cached.avatarUrl) {
        resolveAvatarUrl(cached.avatarUrl).then(url => {
          self.setData({ avatarSrc: url })
        })
      }
    }

    try {
      const userInfo = await getUserInfo()
      if (userInfo && userInfo._openid) {
        this.setData({
          userInfo,
          isAdmin: userInfo.role === 'admin' || userInfo.role === 'superadmin'
        })
        if (userInfo.avatarUrl) {
          const avatarUrl = await resolveAvatarUrl(userInfo.avatarUrl)
          this.setData({ avatarSrc: avatarUrl })
        } else {
          this.setData({ avatarSrc: '/images/icons/avatar.png' })
        }
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
    var self = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (r) => {
        const tempFile = r.tempFiles[0].tempFilePath
        self.setData({ avatarSrc: tempFile })
        wx.showLoading({ title: '上传中' })
        const openid = (getApp().globalData || {}).openid || 'tmp'
        const cloudPath = `avatar/${openid}/${Date.now()}_avatar.jpg`
        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFile,
          success: function (up) {
            var fileID = up.fileID
            updateUserInfo({ avatarUrl: fileID })
              .then(function (ok) {
                wx.hideLoading()
                if (ok) {
                  self.refreshUser()
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
