const { requestCloud } = require('../../utils/cloudRequest')
const { CONTENT_SECURITY } = require('../../utils/constants')
const { throttle } = require('../../utils/helpers')
const {
  enrichMomentView,
  enrichCommentView,
  normalizeRemoteAssetUrl
} = require('../../utils/momentAdapter')
const { patchListForDisplay, patchAuthorForDisplay } = require('../../utils/publicIdentity')

Page({
  data: {
    id: '',
    moment: null,
    comments: [],
    commentCursor: '',
    commentHasMore: false,
    commentLoading: false,
    initialLoading: true,
    loadError: false,
    likePending: false,
    likeSnapshot: null,
    commentInput: '',
    showInput: false,
    replyTo: '',
    replyName: '',
    submitting: false,
    pendingCommentIds: {},
    deletingCommentIds: {}
  },

  onLoad(options) {
    const id = options.id
    if (!id) {
      wx.showToast({ title: '动态不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/discover/index' }) }), 800)
      return
    }
    this.setData({ id })
    this.loadDetail(id)
  },

  onShow() {
  },

  onRetryLoad() {
    this.setData({ loadError: false })
    this.loadDetail(this.data.id)
  },

  async loadDetail(id) {
    this.setData({ initialLoading: true, loadError: false })
    let result = null
    try {
      const data = await requestCloud('moment', 'detail', { momentId: id }, { throwError: false })
      if (data && data.moment) {
        const momentView = Object.assign({}, enrichMomentView(data.moment), patchAuthorForDisplay(data.moment))
        let commentResult = null
        try {
          commentResult = await requestCloud('moment', 'commentList', {
            momentId: id, limit: 50
          }, { throwError: false })
        } catch (_) {}
        let comments = []
        let nextCursor = ''
        let hasMore = false
        if (commentResult && Array.isArray(commentResult.comments)) {
          comments = patchListForDisplay(commentResult.comments.map(c => enrichCommentView(c)))
          nextCursor = commentResult.nextCursor || ''
          hasMore = !!commentResult.hasMore
        }
        result = { moment: momentView, comments, commentCursor: nextCursor, commentHasMore: hasMore }
      }
    } catch (e) {
      console.warn('[moment-detail] cloud load failed:', e && e.message)
    }

    if (!result) {
      this.setData({ initialLoading: false, loadError: true })
      return
    }
    this.setData({
      moment: result.moment,
      comments: result.comments,
      commentCursor: result.commentCursor,
      commentHasMore: result.commentHasMore,
      initialLoading: false,
      loadError: false
    })
  },

  onFigureTap(e) {
    const figureId = e.currentTarget.dataset.figureid
    if (!figureId) return
    wx.navigateTo({ url: `/pages/lantai/figure-detail?id=${figureId}` })
  },

  onImageError(e) {
    console.warn('[moment-detail] 图片加载失败', e.detail)
  },

  _onLike: null,
  onLike() {
    if (!this._onLike) this._onLike = throttle(this.handleLike.bind(this), 350)
    this._onLike()
  },

  async handleLike() {
    const m = this.data.moment
    if (!m || this.data.likePending) return
    const original = JSON.parse(JSON.stringify(m.interaction || {}))
    const nextLiked = !original.liked
    const nextCount = Math.max(0, original.likeCount + (nextLiked ? 1 : -1))
    const preview = (original.likePreview || []).slice()
    const openid = (getApp().globalData && getApp().globalData.openid) || 'local_user'
    if (nextLiked) preview.unshift({ id: openid, name: '我' })
    else {
      const i = preview.findIndex(x => x.id === openid)
      if (i >= 0) preview.splice(i, 1)
    }

    const likeText = nextCount > 999 ? (nextCount / 1000).toFixed(1) + 'k' : String(nextCount)
    this.setData({
      likePending: true,
      likeSnapshot: original,
      moment: {
        ...m,
        likeText,
        ...patchAuthorForDisplay(m),
        interaction: {
          ...original,
          liked: nextLiked,
          likeCount: nextCount,
          likePreview: preview.slice(0, 10)
        }
      }
    })

    let result = null
    try {
      result = await requestCloud('moment', 'like', { momentId: this.data.id }, { throwError: false })
    } catch (e) {
      console.warn('[moment-detail] like failed:', e && e.message)
    }
    if (!result) {
      const snap = this.data.likeSnapshot || original
      const rollbackText = snap.likeCount > 999 ? (snap.likeCount / 1000).toFixed(1) + 'k' : String(snap.likeCount)
      this.setData({
        likePending: false,
        likeSnapshot: null,
        moment: {
          ...this.data.moment,
          likeText: rollbackText,
          ...patchAuthorForDisplay(this.data.moment),
          interaction: snap
        }
      })
      wx.showToast({ title: '操作未成功', icon: 'none' })
      return
    }

    const finalLiked = typeof result.liked === 'boolean' ? result.liked : nextLiked
    const finalCount = typeof result.likeCount === 'number' ? result.likeCount : nextCount
    const finalPreview = Array.isArray(result.likePreview) ? result.likePreview : preview
    const finalText = finalCount > 999 ? (finalCount / 1000).toFixed(1) + 'k' : String(finalCount)
    this.setData({
      likePending: false,
      likeSnapshot: null,
      moment: {
        ...this.data.moment,
        likeText: finalText,
        ...patchAuthorForDisplay(this.data.moment),
        interaction: {
          ...(this.data.moment.interaction || {}),
          liked: finalLiked,
          likeCount: finalCount,
          likePreview: finalPreview.slice(0, 10)
        }
      }
    })
    // 通知列表页同步
    getApp().emitMomentUpdate({
      momentId: this.data.id,
      type: 'like',
      interaction: {
        liked: finalLiked,
        likeCount: finalCount,
        likePreview: finalPreview.slice(0, 10)
      }
    })
  },

  openCommentInput(e) {
    const replyTo = (e.currentTarget.dataset && e.currentTarget.dataset.replyto) || ''
    const replyName = (e.currentTarget.dataset && e.currentTarget.dataset.replyname) || ''
    this.setData({
      showInput: true,
      replyTo,
      replyName,
      commentInput: ''
    })
  },

  hideCommentInput() {
    this.setData({
      showInput: false,
      replyTo: '',
      replyName: '',
      commentInput: ''
    })
  },

  onCommentInput(e) {
    this.setData({ commentInput: e.detail.value })
  },

  async onSubmitComment() {
    const text = (this.data.commentInput || '').trim()
    if (!text || this.data.submitting) return
    if (text.length > CONTENT_SECURITY.maxCommentLength) {
      wx.showToast({ title: `最多${CONTENT_SECURITY.maxCommentLength}字`, icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    const app = getApp()
    const openid = (app.globalData && app.globalData.openid) || 'local_user'
    const userInfo = (app.globalData && app.globalData.userInfo) || {}
    const tempId = 'tmp_' + Date.now()
    const tempComment = enrichCommentView({
      _id: tempId,
      momentId: this.data.id,
      figure: {
        id: openid,
        name: userInfo.nickName || '我',
        title: '',
        avatar: normalizeRemoteAssetUrl(userInfo.avatarUrl || ''),
        dynasty: ''
      },
      content: text,
      replyTo: this.data.replyTo,
      replyName: this.data.replyName,
      likeCount: 0,
      createdAt: Date.now(),
      canDelete: true
    })

    const updatedMoment = this.data.moment
      ? {
          ...this.data.moment,
          ...patchAuthorForDisplay(this.data.moment),
          interaction: {
            ...(this.data.moment.interaction || {}),
            commentCount: (this.data.moment.interaction.commentCount || 0) + 1
          }
        }
      : null

    const pendingMap = { ...this.data.pendingCommentIds, [tempId]: true }
    this.setData({
      comments: patchListForDisplay(this.data.comments.concat([tempComment])),
      moment: updatedMoment,
      pendingCommentIds: pendingMap
    })

    let result = null
    try {
      result = await requestCloud('moment', 'commentCreate', {
        momentId: this.data.id,
        content: text,
        replyTo: this.data.replyTo,
        replyName: this.data.replyName
      }, { throwError: false })
    } catch (e) {
      console.warn('[moment-detail] commentCreate failed:', e && e.message)
    }

    if (!result) {
      const cleaned = this.data.comments.filter(c => c._id !== tempId)
      const cleanedPending = { ...this.data.pendingCommentIds }
      delete cleanedPending[tempId]
      const rolledMoment = this.data.moment
        ? {
            ...this.data.moment,
            ...patchAuthorForDisplay(this.data.moment),
            interaction: {
              ...this.data.moment.interaction,
              commentCount: Math.max(0, (this.data.moment.interaction.commentCount || 1) - 1)
            }
          }
        : null
      this.setData({
        comments: patchListForDisplay(cleaned),
        moment: rolledMoment,
        pendingCommentIds: cleanedPending,
        submitting: false
      })
      wx.showToast({ title: '发布失败，请重试', icon: 'none' })
      return
    }

    const finalComment = enrichCommentView(result.comment)
    const finalCount = typeof result.commentCount === 'number'
      ? result.commentCount
      : (this.data.moment && this.data.moment.interaction && this.data.moment.interaction.commentCount) || 0

    const replaced = this.data.comments.map(c => c._id === tempId ? finalComment : c)
    const finalPending = { ...this.data.pendingCommentIds }
    delete finalPending[tempId]
    const finalMoment = this.data.moment
      ? {
          ...this.data.moment,
          ...patchAuthorForDisplay(this.data.moment),
          interaction: {
            ...this.data.moment.interaction,
            commentCount: finalCount
          }
        }
      : null

    this.setData({
      comments: patchListForDisplay(replaced),
      moment: finalMoment,
      pendingCommentIds: finalPending,
      submitting: false,
      showInput: false,
      replyTo: '',
      replyName: '',
      commentInput: ''
    })
    wx.showToast({ title: '已发布', icon: 'success' })
    // 通知列表页同步评论数
    getApp().emitMomentUpdate({
      momentId: this.data.id,
      type: 'comment',
      interaction: { commentCount: finalCount }
    })
  },

  async onDeleteComment(e) {
    const id = e.currentTarget && e.currentTarget.dataset.id
    if (!id) return
    const idx = this.data.comments.findIndex(c => c._id === id)
    if (idx < 0) return
    const originalComment = this.data.comments[idx]

    let removed = false
    try {
      const res = await wx.showModal({
        title: '删除评论',
        content: '确定要删除此评论吗？',
        confirmText: '删除',
        confirmColor: '#FA5151'
      })
      if (!res || !res.confirm) return
    } catch (e) {
      return
    }

    const deleting = { ...this.data.deletingCommentIds, [id]: true }
    this.setData({ deletingCommentIds: deleting })

    let result = null
    try {
      result = await requestCloud('moment', 'commentRemove', { commentId: id }, { throwError: false })
      removed = !!result && typeof result.commentCount === 'number'
    } catch (_) {}

    if (!removed) {
      const cleaned = { ...this.data.deletingCommentIds }
      delete cleaned[id]
      this.setData({ deletingCommentIds: cleaned })
      wx.showToast({ title: '删除失败，请重试', icon: 'none' })
      return
    }

    const nextComments = this.data.comments.slice()
    nextComments.splice(idx, 1)
    const finalCount = typeof result.commentCount === 'number'
      ? result.commentCount
      : Math.max(0, ((this.data.moment && this.data.moment.interaction && this.data.moment.interaction.commentCount) || 0) - 1)
    const rolledMoment = this.data.moment
      ? {
          ...this.data.moment,
          ...patchAuthorForDisplay(this.data.moment),
          interaction: {
            ...this.data.moment.interaction,
            commentCount: finalCount
          }
        }
      : null
    const cleanedDel = { ...this.data.deletingCommentIds }
    delete cleanedDel[id]
    this.setData({
      comments: patchListForDisplay(nextComments),
      moment: rolledMoment,
      deletingCommentIds: cleanedDel
    })
    wx.showToast({ title: '已删除', icon: 'success' })
    // 通知列表页同步评论数
    getApp().emitMomentUpdate({
      momentId: this.data.id,
      type: 'commentRemove',
      interaction: { commentCount: finalCount }
    })
  },

  onPreviewImage(e) {
    const idx = Number(e.currentTarget.dataset.idx || 0)
    const images = (this.data.moment && this.data.moment.images) || []
    if (!images.length) return
    wx.previewImage({
      current: images[idx] || images[0],
      urls: images
    })
  },

  onShare() {
    wx.showShareMenu({ withShareTicket: true })
  },

  onShareAppMessage() {
    const m = this.data.moment || {}
    const figureName = (m.figure && m.figure.name) || ''
    const slice = (m.content || '').slice(0, 20)
    return {
      title: figureName ? `${figureName}的穿越朋友圈：${slice}...` : (slice || '穿越朋友圈'),
      path: `/pages/discover/moment-detail?id=${this.data.id}`
    }
  }
})
