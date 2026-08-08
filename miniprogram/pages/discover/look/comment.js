const { requestCloud } = require('../../../utils/cloudRequest')
const { patchListForDisplay, patchAuthorForDisplay } = require('../../../utils/publicIdentity')

Page({
  data: {
    articleId: '',
    articleTitle: '',
    comments: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 0,
    pageSize: 20,
    inputContent: '',
    inputFocus: false,
    replyTo: '',
    replyToName: '',
    submitting: false,
    keyboardHeight: 0
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ articleId: options.id })
      this.loadComments(true)
    } else {
      this.setData({ loading: false })
    }
  },

  onShow() {
  },

  onPullDownRefresh() {
    this.loadComments(true).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadComments(false)
    }
  },

  async loadComments(reset) {
    if (reset) {
      this.setData({ page: 0, hasMore: true, loading: true })
    } else {
      if (this.data.loadingMore) return
      this.setData({ loadingMore: true })
    }

    try {
      const page = reset ? 0 : this.data.page
      const data = await requestCloud('look', 'commentList', {
        articleId: this.data.articleId,
        page,
        pageSize: this.data.pageSize
      }, { throwError: false })

      if (data && data.list) {
        const newComments = patchListForDisplay(data.list.map(c => ({
          ...c,
          timeText: this.formatTime(c.createdAt)
        })))

        const comments = reset ? newComments : patchListForDisplay([...this.data.comments, ...newComments])
        this.setData({
          comments,
          page: page + 1,
          hasMore: data.hasMore,
          loading: false,
          loadingMore: false
        })
      } else {
        this.setData({ loading: false, loadingMore: false })
      }
    } catch (e) {
      this.setData({ loading: false, loadingMore: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onInput(e) {
    this.setData({ inputContent: e.detail.value })
  },

  onInputFocus(e) {
    const keyboardHeight = (e.detail && e.detail.height) || 0
    this.setData({ inputFocus: true, keyboardHeight })
  },

  onInputBlur() {
    this.setData({
      inputFocus: false,
      keyboardHeight: 0,
      replyTo: '',
      replyToName: ''
    })
  },

  onReply(e) {
    const { id, name } = e.currentTarget.dataset
    this.setData({
      replyTo: id || '',
      replyToName: name || '',
      inputFocus: true
    })
  },

  cancelReply() {
    this.setData({ replyTo: '', replyToName: '' })
  },

  async onSubmit() {

    const content = this.data.inputContent.trim()
    if (!content) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }
    if (content.length > 500) {
      wx.showToast({ title: '评论最多500字', icon: 'none' })
      return
    }
    if (this.data.submitting) return

    this.setData({ submitting: true })

    try {
      const data = await requestCloud('look', 'submitComment', {
        articleId: this.data.articleId,
        content,
        replyTo: this.data.replyTo
      }, { throwError: false })

      if (data && data._id) {
        const newComment = Object.assign({}, data, patchAuthorForDisplay(data), { timeText: '刚刚' })
        this.setData({
          comments: patchListForDisplay([newComment, ...this.data.comments]),
          inputContent: '',
          replyTo: '',
          replyToName: '',
          submitting: false,
          inputFocus: false
        })
        wx.showToast({ title: '评论成功', icon: 'success' })
      } else {
        this.setData({ submitting: false })
        wx.showToast({ title: '评论失败', icon: 'none' })
      }
    } catch (e) {
      this.setData({ submitting: false })
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },

  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    if (diff < minute) return '刚刚'
    if (diff < hour) return Math.floor(diff / minute) + '分钟前'
    if (diff < day) return Math.floor(diff / hour) + '小时前'
    if (diff < 7 * day) return Math.floor(diff / day) + '天前'

    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day2 = d.getDate().toString().padStart(2, '0')
    return `${month}-${day2}`
  },

  onShareAppMessage() {
    return {
      title: '穿越圈·看一看评论',
      path: `/pages/discover/look/detail?id=${this.data.articleId}`
    }
  }
})
