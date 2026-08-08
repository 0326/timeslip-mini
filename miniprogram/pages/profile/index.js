const { getUserInfo, updateUserInfo, login, isBoundWx, getDisplayUser } = require('../../utils/auth')
const visitor = require('../../utils/visitor')
const { resolveAvatarUrl } = require('../../utils/helpers')

var MENU_LIST = [
  { key: 'bookmarks', iconClass: 'collection', name: '我的收藏', desc: '看一看收藏的文章', url: '/pages/discover/look/bookmarks', color: '#1890FF' },
  { key: 'achievements', iconClass: 'achievement', name: '穿越成就', desc: '解锁历史成就', url: '/pages/profile/achievements', color: '#722ED1' },
  { key: 'about', iconClass: 'details', name: '关于我们', desc: '版本信息与反馈', url: '/pages/profile/about', color: '#C9A24D' },
  { key: 'privacy', iconClass: 'argrement', name: '隐私与协议', desc: '隐私政策与用户协议', url: '/pages/profile/privacy', color: '#52C41A' },
  { key: 'settings', iconClass: 'setting', name: '设置', desc: '偏好与数据管理', url: '/pages/profile/settings', color: '#999999' }
]

function genVisitorCrossNo(vid) {
  // 用 visitorId 截断生成一个 CY + 6位 的游客本地穿越号（只用于本地展示，不上云）
  const s = (vid || 'visitor').replace(/[^a-zA-Z0-9]/g, '')
  let seed = 0
  for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) >>> 0
  const rand = (seed % 1000000).toString().padStart(6, '0')
  return 'CY' + rand
}

Page({
  data: {
    userInfo: null,
    avatarSrc: '/images/icons/avatar.png',
    menus: MENU_LIST,
    statusBarHeight: 40,
    isAdmin: false,
    version: 'v1.0.0',
    isVisitor: false,
    localCrossNo: '',
    bindTip: '当前以游客身份浏览，绑定微信可同步跨设备数据'
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
    // 初始化 visitorId
    visitor.getVisitorId()
    this.setData({ localCrossNo: genVisitorCrossNo(visitor.getVisitorId()) })
    this.refreshUser()
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 3)
    this.refreshUser()
  },

  async refreshUser() {
    var self = this
    const app = getApp()
    const isV = !isBoundWx()
    this.setData({ isVisitor: isV })

    if (isV) {
      // ★ 访客模式：优先读本地缓存，localProfile 不存在则初始化为「游客」+项目logo
      const lp = visitor.getSelfDisplay()
      const crossNo = genVisitorCrossNo(visitor.getVisitorId())
      const fakeUser = Object.assign({}, lp, {
        crossNo: crossNo,
        points: app.globalData && app.globalData.points ? app.globalData.points : 0,
        memberLevel: '布衣',
        role: 'user',
        _visitorOnly: true
      })
      this.setData({ userInfo: fakeUser, localCrossNo: crossNo, isAdmin: false })
      // 头像解析（支持云文件ID / https 相对路径 / 本地路径）
      if (lp.avatarUrl) {
        try {
          const resolved = await resolveAvatarUrl(lp.avatarUrl)
          this.setData({ avatarSrc: resolved })
        } catch (_) {
          this.setData({ avatarSrc: lp.avatarUrl })
        }
      }
      // 把 local profile 也同步到 globalData（全局展示 C 规则：自己设备上看自己的本地资料）
      if (!app.globalData) app.globalData = {}
      app.globalData.userInfo = fakeUser
      app.globalData.points = fakeUser.points || 0
      app.globalData.memberLevel = fakeUser.memberLevel || '普通会员'
      app.globalData.crossNo = crossNo
      return
    }

    // ★ 微信绑定用户：走云端
    const cached = app.globalData && app.globalData.userInfo
    if (cached && !cached._visitorOnly) {
      this.setData({ userInfo: cached })
      if (cached.avatarUrl && this._lastAvatarFileId !== cached.avatarUrl) {
        this._lastAvatarFileId = cached.avatarUrl
        resolveAvatarUrl(cached.avatarUrl).then(url => {
          self.setData({ avatarSrc: url })
        })
      }
    }

    try {
      const userInfo = await getUserInfo()
      if (userInfo) {
        this.setData({
          userInfo,
          isAdmin: userInfo.role === 'admin' || userInfo.role === 'superadmin'
        })
        if (userInfo.avatarUrl) {
          if (this._lastAvatarFileId !== userInfo.avatarUrl) {
            this._lastAvatarFileId = userInfo.avatarUrl
            const avatarUrl = await resolveAvatarUrl(userInfo.avatarUrl)
            if (this._lastAvatarFileId === userInfo.avatarUrl) {
              this.setData({ avatarSrc: avatarUrl })
            }
          }
        } else {
          this._lastAvatarFileId = ''
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

  onAvatarError() {
    if (this.data.isVisitor) {
      const def = visitor.PROJECT_LOGO || '/images/icons/avatar.png'
      this.setData({ avatarSrc: def })
    } else {
      this.setData({ avatarSrc: '/images/icons/avatar.png' })
    }
  },

  onEditAvatar() {
    if (this.data.isVisitor) {
      wx.showActionSheet({
        itemList: ['修改本地头像', '修改本地昵称', '绑定微信账号'],
        success: (r) => {
          if (r.tapIndex === 0) this.doChooseLocalAvatar()
          else if (r.tapIndex === 1) this.doEditLocalName()
          else if (r.tapIndex === 2) this.doBindWx()
        }
      })
      return
    }
    wx.showActionSheet({
      itemList: ['修改头像', '修改昵称'],
      success: (r) => {
        if (r.tapIndex === 0) this.doChooseAvatar()
        else if (r.tapIndex === 1) this.doEditName()
      }
    })
  },

  doChooseLocalAvatar() {
    var self = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (r) => {
        const tempFile = r.tempFiles[0].tempFilePath
        self.setData({ avatarSrc: tempFile })
        wx.showLoading({ title: '保存中' })
        // 访客模式：上传到云存储（方便本地展示 + 未来绑定后直接复用）
        const vid = visitor.getVisitorId()
        const cloudPath = `avatar/visitor_${vid}/${Date.now()}_avatar.jpg`
        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFile,
          success: (up) => {
            wx.hideLoading()
            const fileID = up.fileID
            const lp = visitor.getLocalProfile()
            visitor.setLocalProfile({ ...lp, avatarUrl: fileID })
            self.refreshUser()
            wx.showToast({ title: '本地头像已保存' })
          },
          fail: () => {
            wx.hideLoading()
            // 云端失败就只存本地临时路径（只在本设备上可见，符合规则）
            const lp = visitor.getLocalProfile()
            visitor.setLocalProfile({ ...lp, avatarUrl: tempFile })
            self.refreshUser()
          }
        })
      }
    })
  },

  doEditLocalName() {
    const cur = (this.data.userInfo || {}).nickName || ''
    wx.showModal({
      title: '修改本地昵称',
      editable: true,
      placeholderText: '给自己取个名字（仅本设备可见）',
      content: cur,
      success: (r) => {
        if (!r.confirm) return
        const newName = (r.content || '').trim() || '游客'
        const lp = visitor.getLocalProfile()
        visitor.setLocalProfile({ ...lp, nickName: newName })
        this.refreshUser()
        wx.showToast({ title: '本地昵称已保存' })
      }
    })
  },

  async doBindWx() {
    // 绑定微信账号：调用 auth.login()（内部触发 wx.login + 微信用户资料授权 + getUser action=login 写入 users）
    // 成功后再调 getUser action=bindVisitor 迁移全部访客数据到 OPENID
    wx.showLoading({ title: '绑定中...' })
    try {
      const user = await login()
      if (!user) {
        wx.hideLoading()
        wx.showToast({ title: '授权取消', icon: 'none' })
        return
      }
      // 第二步：迁移访客数据
      try {
        const { requestCloud } = require('../../utils/cloudRequest')
        const vid = visitor.getVisitorId()
        await requestCloud('getUser', 'bindVisitor', { visitorId: vid })
      } catch (migErr) {
        console.warn('[bindVisitor] migrate warn:', migErr)
      }
      wx.hideLoading()
      wx.showToast({ title: '绑定成功', icon: 'success' })
      // 等待一下 toast 再刷新 UI（游客/绑定态切换）
      setTimeout(() => this.refreshUser(), 600)
    } catch (e) {
      wx.hideLoading()
      console.warn('bind wx error:', e)
      wx.showToast({ title: '绑定失败，请重试', icon: 'none' })
    }
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
