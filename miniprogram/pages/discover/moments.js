const { requestCloud } = require('../../utils/cloudRequest')
const { PAGINATION, DYNASTY_FILTERS, CONTENT_SECURITY } = require('../../utils/constants')
const {
  enrichMomentView,
  enrichCommentView,
  normalizeRemoteAssetUrl
} = require('../../utils/momentAdapter')
const loginGuard = require('../../utils/loginGuard')
const { throttle } = require('../../utils/helpers')

const MAX_COLLAPSE_LINES = 6

Page({
  data: {
    dynastyFilters: DYNASTY_FILTERS,
    dynastyNames: DYNASTY_FILTERS.map(d => d.name),
    dynastyFilterEnabled: false,
    selectedDynasty: 'all',
    selectedDynastyName: '全部',
    selectedDynastyIndex: 0,
    moments: [],
    cursor: '',
    hasMore: true,
    loading: false,
    refreshing: false,
    initialLoading: true,
    loadError: false,
    actionMenuId: '',
    navOpaque: false,
    navBgColor: 'transparent',
    navTextColor: '#333333',
    userInfo: {},
    coverFigure: { name: '穿越者', avatar: '', dynasty: '汉' },
    openid: '',
    collapseMap: {},
    pendingLikeIds: {},
    pendingCommentIds: {},
    showCommentBar: false,
    commentTargetId: '',
    commentReplyTo: '',
    commentReplyName: '',
    commentInput: '',
    commentSubmitting: false,
    coverImg: '/images/pyq-ink.jpg',
    coverFallbackBg: 'linear-gradient(180deg, #f8f8f8 0%, #e8e4dc 40%, #d4cfc4 100%)',
    statusBarHeight: 20,
    coverHeight: 620
  },

  onLoad() {
    const app = getApp()
    const userInfo = (app.globalData && app.globalData.userInfo) || {}
    const openid = (app.globalData && app.globalData.openid) || ''

    // 获取系统信息，用于沉浸式布局
    let statusBarHeight = 20
    let windowWidth = 375
    try {
      const sys = wx.getSystemInfoSync()
      statusBarHeight = sys.statusBarHeight || 20
      windowWidth = sys.windowWidth || 375
    } catch (e) {}

    // 620rpx 转换为 px (750rpx = windowWidth)
    const coverHeightPx = Math.round(620 * windowWidth / 750)

    this.setData({
      userInfo,
      openid,
      statusBarHeight,
      coverHeight: coverHeightPx,
      coverFigure: {
        name: userInfo.nickName || '穿越者',
        avatar: normalizeRemoteAssetUrl(userInfo.avatarUrl || ''),
        dynasty: '汉'
      }
    })
    this.loadMoments(true)
    // 订阅动态变更事件（来自详情页的点赞/评论/删除评论）
    this._unsubMoment = app.subscribeMoment(payload => {
      this.applyMomentUpdate(payload)
    })
  },

  onUnload() {
    if (this._unsubMoment) {
      this._unsubMoment()
      this._unsubMoment = null
    }
  },

  // 详情页操作后局部同步对应动态的 interaction 状态
  applyMomentUpdate(payload) {
    if (!payload || !payload.momentId) return
    const idx = this.data.moments.findIndex(m => m._id === payload.momentId)
    if (idx < 0) return
    const moment = this.data.moments[idx]
    const interaction = payload.interaction || {}
    const nextMoments = this.data.moments.slice()
    nextMoments[idx] = {
      ...moment,
      likeText: typeof interaction.likeCount === 'number'
        ? (interaction.likeCount > 999 ? (interaction.likeCount / 1000).toFixed(1) + 'k' : String(interaction.likeCount))
        : moment.likeText,
      interaction: {
        ...moment.interaction,
        ...interaction
      }
    }
    this.setData({ moments: nextMoments })
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  onPullDownRefresh() {
    this.loadMoments(true)
  },

  onPageScroll(e) {
    const scrollTop = e.scrollTop
    const navThreshold = 300

    const shouldOpaque = scrollTop > navThreshold
    if (shouldOpaque !== this.data.navOpaque) {
      this.setData({
        navOpaque: shouldOpaque,
        navBgColor: shouldOpaque ? '#ffffff' : 'transparent',
        navTextColor: shouldOpaque ? '#191919' : '#333333'
      })
    }

    if (this.data.actionMenuId) {
      this.setData({ actionMenuId: '' })
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoments(false)
    }
  },

  onRetryLoad() {
    this.setData({ loadError: false })
    this.loadMoments(true)
  },

  async loadMoments(reset) {
    if (this.data.loading) return
    const cursor = reset ? '' : this.data.cursor
    const limit = PAGINATION.MOMENT_PAGE_SIZE
    const dynasty = this.data.selectedDynasty

    this.setData({
      loading: true,
      refreshing: reset,
      initialLoading: reset && this.data.moments.length === 0,
      loadError: false
    })

    let result = null
    try {
      const data = await requestCloud('moment', 'list', {
        cursor, limit, dynasty
      }, { throwError: false })
      if (data && Array.isArray(data.moments)) {
        const moments = data.moments.map(m => enrichMomentView(m))
        result = {
          moments,
          nextCursor: data.nextCursor || '',
          hasMore: !!data.hasMore
        }
      }
    } catch (e) {
      console.warn('[moments] cloud list failed:', e && e.message)
    }

    if (!result) {
      this.setData({
        loading: false,
        refreshing: false,
        initialLoading: false,
        loadError: true
      })
      wx.stopPullDownRefresh()
      return
    }

    const merged = reset ? result.moments : this.data.moments.concat(result.moments)
    this.setData({
      moments: merged,
      cursor: result.nextCursor,
      hasMore: result.hasMore,
      loading: false,
      refreshing: false,
      initialLoading: false,
      loadError: false
    })
    wx.stopPullDownRefresh()
  },

  onSelectDynasty(e) {
    const idx = Number(e.detail.value)
    const item = this.data.dynastyFilters[idx]
    if (!item || item.key === this.data.selectedDynasty) return
    this.setData({
      selectedDynasty: item.key,
      selectedDynastyName: item.name,
      selectedDynastyIndex: idx,
      actionMenuId: ''
    }, () => {
      this.loadMoments(true)
    })
  },

  openMomentDetail(e) {
    if (this.data.actionMenuId) {
      this.setData({ actionMenuId: '' })
      return
    }
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/discover/moment-detail?id=${id}` })
  },

  onFigureTap(e) {
    if (this.data.actionMenuId) {
      this.setData({ actionMenuId: '' })
      return
    }
    const figureId = e.currentTarget.dataset.figureid
    if (!figureId) return
    wx.navigateTo({ url: `/pages/lantai/figure-detail?id=${figureId}` })
  },

  toggleActionMenu(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      actionMenuId: this.data.actionMenuId === id ? '' : id
    })
  },

  stopPropagation() {},

  closeActionMenu() {
    if (this.data.actionMenuId) this.setData({ actionMenuId: '' })
  },

  toggleContentCollapse(e) {
    const id = e.currentTarget.dataset.id
    const map = { ...this.data.collapseMap }
    map[id] = !map[id]
    this.setData({ collapseMap: map })
  },

  onImageError(e) {
    const id = e.currentTarget && e.currentTarget.dataset.id
    if (id) {
      console.warn('[moments] 图片加载失败，动态:', id, e.detail)
    }
  },

  onCoverError() {
    this.setData({ coverImg: '' })
  },

  _onLike: null,
  onLike(e) {
    if (!this._onLike) this._onLike = throttle(this.handleLike.bind(this), 350)
    this._onLike(e)
  },

  async handleLike(e) {
    const id = e.currentTarget.dataset.id
    const idx = this.data.moments.findIndex(m => m._id === id)
    if (idx < 0) return
    const moment = this.data.moments[idx]
    const originalInteraction = JSON.parse(JSON.stringify(moment.interaction || {}))
    const nextLiked = !originalInteraction.liked
    const nextCount = Math.max(0, originalInteraction.likeCount + (nextLiked ? 1 : -1))
    const previewNames = (originalInteraction.likePreview || []).slice()
    const openid = this.data.openid || 'local_user'
    if (nextLiked) {
      previewNames.unshift({ id: openid, name: '我' })
    } else {
      const i = previewNames.findIndex(x => x.id === openid)
      if (i >= 0) previewNames.splice(i, 1)
    }

    const pendingLikeIds = { ...this.data.pendingLikeIds, [id]: true }
    const updatedMoments = this.data.moments.slice()
    updatedMoments[idx] = {
      ...moment,
      likeText: nextCount > 999 ? (nextCount / 1000).toFixed(1) + 'k' : String(nextCount),
      interaction: {
        ...originalInteraction,
        liked: nextLiked,
        likeCount: nextCount,
        likePreview: previewNames.slice(0, 10)
      }
    }
    this.setData({ moments: updatedMoments, pendingLikeIds, actionMenuId: '' })

    let result = null
    try {
      result = await requestCloud('moment', 'like', { momentId: id }, { throwError: false })
    } catch (e) {
      console.warn('[moments] like failed:', e && e.message)
    }

    const curr = this.data.moments[idx]
    const cleanedPending = { ...this.data.pendingLikeIds }
    delete cleanedPending[id]
    if (!result) {
      const rollbackMoments = this.data.moments.slice()
      rollbackMoments[idx] = {
        ...curr,
        interaction: originalInteraction,
        likeText: originalInteraction.likeCount > 999
          ? (originalInteraction.likeCount / 1000).toFixed(1) + 'k'
          : String(originalInteraction.likeCount)
      }
      this.setData({ moments: rollbackMoments, pendingLikeIds: cleanedPending })
      wx.showToast({ title: '操作未成功', icon: 'none' })
      return
    }

    const finalMoments = this.data.moments.slice()
    const finalLiked = typeof result.liked === 'boolean' ? result.liked : nextLiked
    const finalCount = typeof result.likeCount === 'number' ? result.likeCount : nextCount
    const finalPreview = Array.isArray(result.likePreview) ? result.likePreview : previewNames
    finalMoments[idx] = {
      ...finalMoments[idx],
      likeText: finalCount > 999 ? (finalCount / 1000).toFixed(1) + 'k' : String(finalCount),
      interaction: {
        ...(finalMoments[idx].interaction || {}),
        liked: finalLiked,
        likeCount: finalCount,
        likePreview: finalPreview.slice(0, 10)
      }
    }
    this.setData({ moments: finalMoments, pendingLikeIds: cleanedPending })
  },

  openCommentInput(e) {
    const id = e.currentTarget.dataset.id
    const replyTo = (e.currentTarget.dataset && e.currentTarget.dataset.replyto) || ''
    const replyName = (e.currentTarget.dataset && e.currentTarget.dataset.replyname) || ''
    this.setData({
      showCommentBar: true,
      commentTargetId: id,
      commentReplyTo: replyTo,
      commentReplyName: replyName,
      commentInput: '',
      actionMenuId: ''
    })
  },

  hideCommentInput() {
    this.setData({
      showCommentBar: false,
      commentTargetId: '',
      commentReplyTo: '',
      commentReplyName: '',
      commentInput: ''
    })
  },

  onCommentInput(e) {
    this.setData({ commentInput: e.detail.value })
  },

  async onSubmitComment() {
    const text = (this.data.commentInput || '').trim()
    const momentId = this.data.commentTargetId
    if (!text || !momentId || this.data.commentSubmitting) return
    if (text.length > CONTENT_SECURITY.maxCommentLength) {
      wx.showToast({ title: `最多${CONTENT_SECURITY.maxCommentLength}字`, icon: 'none' })
      return
    }

    this.setData({ commentSubmitting: true })

    const idx = this.data.moments.findIndex(m => m._id === momentId)
    const originalInteraction = idx >= 0
      ? JSON.parse(JSON.stringify(this.data.moments[idx].interaction || {}))
      : null

    const tempId = 'tmp_' + Date.now()
    const openid = this.data.openid || 'local_user'
    const userInfo = this.data.userInfo || {}
    const tempComment = enrichCommentView({
      _id: tempId,
      momentId,
      figure: {
        id: openid,
        name: userInfo.nickName || '我',
        title: '',
        avatar: normalizeRemoteAssetUrl(userInfo.avatarUrl || ''),
        dynasty: ''
      },
      content: text,
      replyTo: this.data.commentReplyTo,
      replyName: this.data.commentReplyName,
      likeCount: 0,
      createdAt: Date.now(),
      canDelete: true
    })

    let updatedPreview = []
    let updatedCount = 0
    if (idx >= 0) {
      const interaction = this.data.moments[idx].interaction || {}
      const prev = (interaction.commentPreview || []).slice()
      if (prev.length < 2) {
        updatedPreview = prev.concat([{
          id: tempId,
          name: tempComment.figure.name,
          avatar: tempComment.figure.avatar,
          dynasty: tempComment.figure.dynasty,
          content: text,
          replyTo: tempComment.replyTo,
          replyName: tempComment.replyName
        }])
      } else {
        updatedPreview = prev
      }
      updatedCount = (interaction.commentCount || 0) + 1
      const pendingCommentIds = { ...this.data.pendingCommentIds, [tempId]: true }
      const nextMoments = this.data.moments.slice()
      nextMoments[idx] = {
        ...nextMoments[idx],
        interaction: {
          ...interaction,
          commentCount: updatedCount,
          commentPreview: updatedPreview
        }
      }
      this.setData({ moments: nextMoments, pendingCommentIds })
    }

    let result = null
    try {
      result = await requestCloud('moment', 'commentCreate', {
        momentId,
        content: text,
        replyTo: this.data.commentReplyTo,
        replyName: this.data.commentReplyName
      }, { throwError: false })
    } catch (e) {
      console.warn('[moments] commentCreate failed:', e && e.message)
    }

    if (!result) {
      if (idx >= 0 && originalInteraction) {
        const rollback = this.data.moments.slice()
        rollback[idx] = {
          ...rollback[idx],
          interaction: originalInteraction
        }
        const cleanedPending = { ...this.data.pendingCommentIds }
        delete cleanedPending[tempId]
        this.setData({
          moments: rollback,
          commentSubmitting: false,
          pendingCommentIds: cleanedPending
        })
      } else {
        this.setData({ commentSubmitting: false })
      }
      wx.showToast({ title: '发布失败，请重试', icon: 'none' })
      return
    }

    const finalComment = enrichCommentView(result.comment)
    const finalCount = typeof result.commentCount === 'number' ? result.commentCount : updatedCount

    if (idx >= 0) {
      const interaction = this.data.moments[idx].interaction || {}
      const prev = (interaction.commentPreview || []).slice()
      const updated = prev.map(c => c.id === tempId ? {
        id: finalComment._id,
        name: finalComment.figure.name,
        avatar: finalComment.figure.avatar,
        dynasty: finalComment.figure.dynasty,
        content: finalComment.content,
        replyTo: finalComment.replyTo,
        replyName: finalComment.replyName
      } : c)
      const cleanedPending = { ...this.data.pendingCommentIds }
      delete cleanedPending[tempId]
      const finalMoments = this.data.moments.slice()
      finalMoments[idx] = {
        ...finalMoments[idx],
        interaction: {
          ...interaction,
          commentCount: finalCount,
          commentPreview: updated
        }
      }
      this.setData({ moments: finalMoments, pendingCommentIds: cleanedPending })
    }

    this.setData({
      commentSubmitting: false,
      showCommentBar: false,
      commentTargetId: '',
      commentReplyTo: '',
      commentReplyName: '',
      commentInput: ''
    })
    wx.showToast({ title: '已发布', icon: 'success' })
  },

  onPreviewImage(e) {
    const idx = Number(e.currentTarget.dataset.idx || 0)
    const id = e.currentTarget.dataset.id
    const moment = this.data.moments.find(m => m._id === id)
    const images = (moment && moment.images) || []
    if (!images.length) return
    wx.previewImage({
      current: images[idx] || images[0],
      urls: images
    })
  }
})
