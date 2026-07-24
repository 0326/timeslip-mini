const { ensureUser, updateUserInfo } = require('../../utils/auth')
const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')

const MENU_LIST = [
  { key: 'dna', icon: '🧬', name: '历史人格', desc: '查看你的DNA测试结果', url: '/pages/discover/dna-test', right: '›' },
  { key: 'passport', icon: '🎖️', name: '穿越成就', desc: '成就墙与解锁', url: '/pages/profile/achievements', right: '›' },
  { key: 'letters', icon: '🕊️', name: '信鸽驿站', desc: '历史信件往来', url: '/pages/profile/letters', right: '›' },
  { key: 'chats', icon: '💬', name: '聊天记录', desc: '管理历史对话', url: '/pages/chat/index', right: '›', isTab: true },
  { key: 'settings', icon: '⚙️', name: '设置', desc: '隐私与偏好', url: '/pages/profile/settings', right: '›' }
]

const STAT_MENUS = [
  { key: 'chats', num: 0, label: '对话次数', icon: '💬' },
  { key: 'letters', num: 0, label: '飞鸽书信', icon: '🕊️' },
  { key: 'memorials', num: 0, label: '奏折批阅', icon: '📜' },
  { key: 'achievements', num: 0, label: '解锁成就', icon: '🎖️' }
]

Page({
  data: {
    userInfo: null,
    menus: MENU_LIST,
    stats: STAT_MENUS,
    achievements: [
      { id: 'first_chat', name: '初入异世', desc: '与第一位古人对话', icon: '🌟', unlocked: true },
      { id: 'dna_complete', name: '真我本色', desc: '完成人格DNA测试', icon: '🧬', unlocked: true },
      { id: 'letter_first', name: '鸿雁传书', desc: '寄出第一封信', icon: '🕊️', unlocked: false },
      { id: 'memorial_10', name: '明君气象', desc: '批阅10道奏折', icon: '👑', unlocked: false },
      { id: 'all_figures', name: '万古长青', desc: '解锁全部人物', icon: '🏆', unlocked: false }
    ]
  },

  onLoad() {
    this.refreshUser()
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 3)
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
      if (data && data.stats) {
        const stats = this.data.stats.map(s => ({
          ...s,
          num: data.stats[s.key] || s.num
        }))
        this.setData({ stats })
      }
    } catch (e) {}
  },

  onMenuTap(e) {
    const { url, istab } = e.currentTarget.dataset
    if (!url) return
    if (istab) {
      wx.switchTab({ url })
    } else {
      wx.navigateTo({
        url,
        fail: () => wx.showToast({ title: '开发中', icon: 'none' })
      })
    }
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
  },

  onShare() {
    wx.showShareMenu({ withShareTicket: true })
    wx.showToast({ title: '点击右上角分享', icon: 'none' })
  },

  onShareAppMessage() {
    return {
      title: '穿越圈 - 与历史人物对话',
      path: '/pages/chat/index'
    }
  }
})
