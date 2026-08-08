const { requestCloud } = require('../../../utils/cloudRequest')
const loginGuard = require('../../../utils/loginGuard')
const { throttle, debounce } = require('../../../utils/helpers')
const { patchListForDisplay, patchAuthorForDisplay } = require('../../../utils/publicIdentity')

Page({
  data: {
    videoList: [],
    currentIndex: 0,
    windowHeight: 0,
    windowWidth: 0,
    lastCreatedAt: null,
    lastId: null,
    hasMore: true,
    loading: true,
    refreshing: false,
    showComments: false,
    currentVideoId: '',
    commentList: [],
    commentLoading: false,
    userInfo: null,
    isLoggedIn: false,
    showHeart: false,
    heartX: 0,
    heartY: 0,
    videoPaused: false,
    commentText: '',
    currentCommentEnabled: false
  },

  onLoad(options) {
    const sys = wx.getSystemInfoSync()
    this.setData({
      windowHeight: sys.windowHeight,
      windowWidth: sys.windowWidth
    })
    this._viewReported = {}
    this._targetVideoId = (options && options.videoId) || ''
    // 记录场景参数：从角色详情页/视频号进入时，限定只看该角色/视频号的视频
    this._scene = {
      channelId: (options && options.channelId) || '',
      figureId: (options && options.figureId) || ''
    }
    this._lastTapTime = 0
    this._lastTapId = ''
    this._reportViewFn = debounce((id) => {
      if (this._viewReported[id]) return
      this._viewReported[id] = true
      requestCloud('videoChannel', 'increaseView', { videoId: id }, { throwError: false })
    }, 2000)
    this.loadFeed(true)
  },

  onShow() {
    const app = getApp()
    const userInfo = (app.globalData && app.globalData.userInfo) || null
    this.setData({
      userInfo,
      isLoggedIn: loginGuard.isLoggedIn()
    })
  },

  onHide() {
    this._pauseCurrentVideo()
  },

  onUnload() {
    this._pauseCurrentVideo()
  },

  onPullDownRefresh() {
    this.loadFeed(true)
  },

  _pauseCurrentVideo() {
    try {
      const ctx = wx.createVideoContext('video-' + this.data.currentIndex)
      if (ctx) ctx.pause()
    } catch (_) {}
  },

  formatCount(num) {
    const n = Number(num) || 0
    if (n >= 10000) {
      return (n / 10000).toFixed(1) + 'w'
    }
    if (n >= 1000) {
      return (n / 1000).toFixed(1) + 'k'
    }
    return String(n)
  },

  processVideoList(list) {
    return list.map(v => ({
      ...v,
      likeCountText: this.formatCount(v.likeCount || 0),
      commentCountText: this.formatCount(v.commentCount || 0)
    }))
  },

  async loadFeed(reset) {
    if (this.data.loading && !reset) return
    this.setData({ loading: true, refreshing: reset })

    try {
      const scene = this._scene || {}
      let queryType = 'recommend'
      const params = { limit: 10, type: 'recommend' }

      if (scene.channelId) {
        queryType = 'byChannel'
        params.type = 'byChannel'
        params.channelId = scene.channelId
      } else if (scene.figureId) {
        queryType = 'byFigure'
        params.type = 'byFigure'
        params.figureId = scene.figureId
      }

      if (!reset && this.data.lastCreatedAt && this.data.lastId) {
        params.lastCreatedAt = this.data.lastCreatedAt
        params.lastId = this.data.lastId
      }

      const data = await requestCloud('videoChannel', 'feedList', params, { throwError: false })
      const list = (data && data.list) || []
      const processedList = patchListForDisplay(this.processVideoList(list))
      const newList = reset ? processedList : patchListForDisplay(this.data.videoList.concat(processedList))

      this.setData({
        videoList: newList,
        lastCreatedAt: data && data.lastCreatedAt,
        lastId: data && data.lastId,
        hasMore: data ? data.hasMore : false,
        loading: false,
        refreshing: false
      })

      if (this._targetVideoId && reset) {
        this._locateTargetVideo(newList)
      }

      // 首次加载后显式播放第一个视频（autoplay 在 swiper 内不可靠）
      if (reset && newList.length > 0) {
        setTimeout(() => {
          try {
            const idx = this._targetVideoId ? this.data.currentIndex : 0
            const ctx = wx.createVideoContext('video-' + idx)
            if (ctx) ctx.play()
          } catch (_) {}
        }, 300)
      }
    } catch (e) {
      console.warn('loadFeed error:', e)
      this.setData({ loading: false, refreshing: false })
      if (reset && this.data.videoList.length === 0) {
        wx.showToast({
          title: '加载失败，下拉重试',
          icon: 'none'
        })
      }
    }
    wx.stopPullDownRefresh()
  },

  _locateTargetVideo(list) {
    const idx = list.findIndex(v => v._id === this._targetVideoId)
    if (idx >= 0) {
      this.setData({ currentIndex: idx })
      const video = list[idx]
      if (video && video._id) {
        this._reportView(video._id)
      }
    }
    this._targetVideoId = ''
  },

  onSwiperChange(e) {
    const current = e.detail.current
    const prev = this.data.currentIndex

    if (prev !== current) {
      try {
        const prevCtx = wx.createVideoContext('video-' + prev)
        if (prevCtx) prevCtx.pause()
      } catch (_) {}
    }

    this.setData({ currentIndex: current, videoPaused: false })

    try {
      const curCtx = wx.createVideoContext('video-' + current)
      if (curCtx) curCtx.play()
    } catch (_) {}

    if (current >= this.data.videoList.length - 2 && this.data.hasMore && !this.data.loading) {
      this.loadFeed(false)
    }

    const video = this.data.videoList[current]
    if (video && video._id) {
      this._reportView(video._id)
    }
  },

  _reportView(videoId) {
    if (this._reportViewFn) {
      this._reportViewFn(videoId)
    }
  },

  onVideoTap(e) {
    const now = Date.now()
    const videoId = e.currentTarget.dataset.id
    const touch = (e.touches && e.touches[0]) || {}

    if (this._lastTapTime && (now - this._lastTapTime) < 300 && this._lastTapId === videoId) {
      this._lastTapTime = 0
      this._lastTapId = ''
      this._handleDoubleTap(videoId, touch)
    } else {
      this._lastTapTime = now
      this._lastTapId = videoId
      setTimeout(() => {
        if (this._lastTapTime === now) {
          this._togglePlay()
        }
      }, 300)
    }
  },

  _togglePlay() {
    const ctx = wx.createVideoContext('video-' + this.data.currentIndex)
    if (!ctx) return
    if (this.data.videoPaused) {
      ctx.play()
      this.setData({ videoPaused: false })
    } else {
      ctx.pause()
      this.setData({ videoPaused: true })
    }
  },

  _handleDoubleTap(videoId, touch) {
    this.setData({
      showHeart: true,
      heartX: touch.pageX || (this.data.windowWidth / 2),
      heartY: touch.pageY || (this.data.windowHeight / 2)
    })

    setTimeout(() => {
      this.setData({ showHeart: false })
    }, 800)

    const list = this.data.videoList.slice()
    const idx = list.findIndex(v => v._id === videoId)
    if (idx >= 0 && !list[idx].liked) {
      this.onLike({ currentTarget: { dataset: { id: videoId } } })
    }
  },

  async onLike(e) {
    const videoId = e.currentTarget.dataset.id
    const list = this.data.videoList.slice()
    const idx = list.findIndex(v => v._id === videoId)
    if (idx < 0) return

    const wasLiked = list[idx].liked
    const originalCount = list[idx].likeCount || 0
    // 乐观更新
    list[idx].liked = !wasLiked
    list[idx].likeCount = originalCount + (wasLiked ? -1 : 1)
    list[idx].likeCountText = this.formatCount(list[idx].likeCount)
    this.setData({ videoList: patchListForDisplay(list) })

    try {
      const res = await requestCloud('videoChannel', 'toggleLike', { videoId }, { throwError: false })
      if (res && typeof res.liked !== 'undefined') {
        list[idx].liked = res.liked
        list[idx].likeCount = originalCount + (res.liked ? 1 : -1)
        list[idx].likeCountText = this.formatCount(list[idx].likeCount)
        this.setData({ videoList: patchListForDisplay(list) })
      }
    } catch (err) {
      // 回滚
      list[idx].liked = wasLiked
      list[idx].likeCount = originalCount
      list[idx].likeCountText = this.formatCount(originalCount)
      this.setData({ videoList: patchListForDisplay(list) })
      wx.showToast({ title: '😊', icon: 'none' })
    }
  },

  async openComments(e) {
    const { id } = e.currentTarget.dataset
    const video = this.data.videoList.find(v => v._id === id)
    const commentEnabled = video ? !!video.commentEnabled : false
    this.setData({
      showComments: true,
      currentVideoId: id,
      currentCommentEnabled: commentEnabled,
      commentList: [],
      commentLoading: true
    })

    try {
      const data = await requestCloud('videoChannel', 'commentList', { videoId: id }, { throwError: false })
      this.setData({
        commentList: patchListForDisplay(data || []),
        commentLoading: false
      })
    } catch (e) {
      this.setData({ commentLoading: false })
    }
  },

  closeComments() {
    this.setData({ showComments: false, commentText: '' })
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  async sendComment() {
    const text = (this.data.commentText || '').trim()
    if (!text) return

    const videoId = this.data.currentVideoId
    if (!videoId) return

    wx.showLoading({ title: '发送中...' })
    try {
      const newComment = await requestCloud('videoChannel', 'userCommentAdd', { videoId, content: text }, { throwError: false })
      if (newComment) {
        const list = this.data.commentList.slice()
        list.push(Object.assign({}, newComment, patchAuthorForDisplay(newComment)))
        const videoList = this.data.videoList.slice()
        const vIdx = videoList.findIndex(v => v._id === videoId)
        if (vIdx >= 0) {
          videoList[vIdx].commentCount = (videoList[vIdx].commentCount || 0) + 1
          videoList[vIdx].commentCountText = this.formatCount(videoList[vIdx].commentCount)
        }
        this.setData({ commentList: patchListForDisplay(list), commentText: '', videoList: patchListForDisplay(videoList) })
        wx.hideLoading()
      } else {
        wx.hideLoading()
        wx.showToast({ title: '😊', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '😊', icon: 'none' })
    }
  },

  goChannel(e) {
    const { figureId } = e.currentTarget.dataset
    if (this.data.showComments) {
      this.setData({ showComments: false })
    }
    if (figureId) {
      wx.navigateTo({
        url: `/pages/lantai/figure-detail?id=${figureId}&tab=videos`
      })
    }
  },

  onFollow(e) {
    const { channelId } = e.currentTarget.dataset
    const list = this.data.videoList.slice()
    const idx = list.findIndex(v => v.channelId === channelId)
    if (idx < 0) return

    requestCloud('videoChannel', 'toggleFollow', { channelId }, { throwError: false })
      .then(res => {
        if (res && typeof res.followed !== 'undefined') {
          list[idx].followed = res.followed
          this.setData({ videoList: patchListForDisplay(list) })
          wx.showToast({ title: res.followed ? '已关注' : '已取消关注', icon: 'none' })
        }
      })
      .catch(() => {})
  },

  onShareAppMessage() {
    const video = this.data.videoList[this.data.currentIndex]
    if (!video) return { title: '穿越圈', path: '/pages/discover/index' }
    return {
      title: `${video.figureName}的视频号|${video.title}`,
      path: `/pages/discover/channels/index?videoId=${video._id}`,
      imageUrl: video.coverUrl || ''
    }
  },

  stopPropagation() {},

  onVideoError(e) {
    const idx = e.currentTarget.dataset.idx
    console.error('视频播放错误 idx=' + idx, e.detail)
  }
})
