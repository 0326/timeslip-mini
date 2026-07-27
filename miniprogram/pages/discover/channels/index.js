const { requestCloud } = require('../../../utils/cloudRequest')
const loginGuard = require('../../../utils/loginGuard')
const { throttle, debounce } = require('../../../utils/helpers')

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
    heartY: 0
  },

  onLoad() {
    const sys = wx.getSystemInfoSync()
    this.setData({
      windowHeight: sys.windowHeight,
      windowWidth: sys.windowWidth
    })
    this._viewReported = {}
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

  onPullDownRefresh() {
    this.loadFeed(true)
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
      likeCountText: this.formatCount(v.likeCount || 0)
    }))
  },

  async loadFeed(reset) {
    if (this.data.loading && !reset) return
    this.setData({ loading: true, refreshing: reset })

    try {
      const params = {
        limit: 10,
        type: 'recommend'
      }
      if (!reset && this.data.lastCreatedAt && this.data.lastId) {
        params.lastCreatedAt = this.data.lastCreatedAt
        params.lastId = this.data.lastId
      }

      const data = await requestCloud('videoChannel', 'feedList', params, { throwError: false })
      const list = (data && data.list) || []
      const processedList = this.processVideoList(list)
      const newList = reset ? processedList : this.data.videoList.concat(processedList)

      this.setData({
        videoList: newList,
        lastCreatedAt: data && data.lastCreatedAt,
        lastId: data && data.lastId,
        hasMore: data ? data.hasMore : false,
        loading: false,
        refreshing: false
      })
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

  onSwiperChange(e) {
    const current = e.detail.current
    this.setData({ currentIndex: current })

    if (current >= this.data.videoList.length - 2 && this.data.hasMore && !this.data.loading) {
      this.loadFeed(false)
    }

    const video = this.data.videoList[current]
    if (video && video._id) {
      this._debouncedReportView(video._id)
    }
  },

  _debouncedReportView: null,
  _viewReported: {},
  _debouncedReportView(videoId) {
    if (!this._debouncedReportView) {
      this._debouncedReportView = debounce((id) => {
        if (this._viewReported[id]) return
        this._viewReported[id] = true
        requestCloud('videoChannel', 'increaseView', { videoId: id }, { throwError: false })
      }, 2000)
    }
    this._debouncedReportView(videoId)
  },

  onVideoTap(e) {
    const videoId = e.currentTarget.dataset.id
    const videoContext = wx.createVideoContext('video-' + this.data.currentIndex)
    videoContext.pause()
  },

  _onLike: null,
  onLike(e) {
    if (!this._onLike) this._onLike = throttle(this.handleLike.bind(this), 300)
    this._onLike(e)
  },

  async handleLike(e) {
    if (!loginGuard.checkLogin(this)) return
    const id = e.currentTarget.dataset.id
    const list = this.data.videoList.slice()
    const idx = list.findIndex(v => v._id === id)
    if (idx < 0) return
    const item = list[idx]
    const nowLiked = !item.liked

    item.liked = nowLiked
    item.likeCount = Math.max(0, (item.likeCount || 0) + (nowLiked ? 1 : -1))
    item.likeCountText = this.formatCount(item.likeCount)
    list[idx] = item
    this.setData({ videoList: list })

    try {
      await requestCloud('videoChannel', 'toggleLike', { videoId: id }, { throwError: false })
    } catch (_) {}
  },

  onDoubleTap(e) {
    const { id } = e.currentTarget.dataset
    const { touches } = e
    const touch = touches[0] || {}

    this.setData({
      showHeart: true,
      heartX: touch.pageX || (this.data.windowWidth / 2),
      heartY: touch.pageY || (this.data.windowHeight / 2)
    })

    setTimeout(() => {
      this.setData({ showHeart: false })
    }, 800)

    const list = this.data.videoList.slice()
    const idx = list.findIndex(v => v._id === id)
    if (idx >= 0 && !list[idx].liked) {
      this.handleLike({ currentTarget: { dataset: { id } } })
    }
  },

  async openComments(e) {
    const { id } = e.currentTarget.dataset
    this.setData({
      showComments: true,
      currentVideoId: id,
      commentList: [],
      commentLoading: true
    })

    try {
      const data = await requestCloud('videoChannel', 'commentList', { videoId: id }, { throwError: false })
      this.setData({
        commentList: data || [],
        commentLoading: false
      })
    } catch (e) {
      this.setData({ commentLoading: false })
    }
  },

  closeComments() {
    this.setData({ showComments: false })
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
    if (!loginGuard.checkLogin(this)) return
    const { channelId } = e.currentTarget.dataset
    const list = this.data.videoList.slice()
    const idx = list.findIndex(v => v.channelId === channelId)
    if (idx < 0) return

    requestCloud('videoChannel', 'toggleFollow', { channelId }, { throwError: false })
      .then(res => {
        if (res && typeof res.followed !== 'undefined') {
          list[idx].followed = res.followed
          this.setData({ videoList: list })
          wx.showToast({ title: res.followed ? '已关注' : '已取消关注', icon: 'none' })
        }
      })
      .catch(() => {})
  },

  onShareAppMessage() {
    const video = this.data.videoList[this.data.currentIndex]
    if (!video) return { title: '穿越圈', path: '/pages/discover/index' }
    return {
      title: `${video.figureName} | ${video.title}`,
      path: `/pages/discover/channels/index?videoId=${video._id}`,
      imageUrl: video.coverUrl || ''
    }
  },

  stopPropagation() {}
})
