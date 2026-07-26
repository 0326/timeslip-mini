const { requestCloud } = require('../../../utils/cloudRequest')
const loginGuard = require('../../../utils/loginGuard')

Page({
  data: {
    quizzes: [],
    loading: true,
    uploadingId: '',
    statusBarHeight: 20
  },

  onLoad() {
    try {
      var sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 20 })
    } catch (e) {}
    if (!loginGuard.isLoggedIn()) {
      wx.redirectTo({ url: '/pages/login/index' })
      return
    }
    this.loadQuizzes()
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  async loadQuizzes() {
    this.setData({ loading: true })
    try {
      var data = await requestCloud('dna', 'admin-quiz-list', {}, { throwError: false })
      this.setData({ quizzes: (data && data.quizzes) || [] })
    } catch (e) {
      wx.showToast({ title: '加载测试列表失败', icon: 'none' })
    }
    this.setData({ loading: false })
  },

  async onChooseQuizCover(e) {
    var quizId = e.currentTarget.dataset.id
    var self = this
    try {
      var res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed']
      })
      var tempPath = res.tempFiles[0].tempFilePath
      self.setData({ uploadingId: quizId })
      var fileID = await self.uploadImage(tempPath, 'quiz-covers', quizId)
      await requestCloud('dna', 'admin-update-quiz-cover', {
        quizId: quizId,
        cover: fileID
      }, { throwError: false })
      var quizzes = self.data.quizzes.map(function (q) {
        if (q.id === quizId) {
          q.cover = fileID
        }
        return q
      })
      self.setData({ quizzes: quizzes, uploadingId: '' })
      wx.showToast({ title: '封面已更新', icon: 'success' })
    } catch (e) {
      self.setData({ uploadingId: '' })
      if (e && e.errMsg && e.errMsg.indexOf('cancel') === -1) {
        wx.showToast({ title: '上传失败', icon: 'none' })
      }
    }
  },

  uploadImage(filePath, folder, id) {
    var random = Math.random().toString(36).slice(2, 8)
    var cloudPath = folder + '/' + id + '/' + Date.now() + '_' + random + '.jpg'
    return new Promise(function (resolve, reject) {
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: function (res) {
          resolve(res.fileID)
        },
        fail: function (err) {
          reject(err)
        }
      })
    })
  },

  onBack() {
    var pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.redirectTo({ url: '/pages/profile/index' })
    }
  },

  onPullDownRefresh() {
    this.loadQuizzes().finally(function () {
      wx.stopPullDownRefresh()
    })
  }
})
