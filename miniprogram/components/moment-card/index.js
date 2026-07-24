const { DYNASTY_FILTERS } = require('../../utils/constants')

Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    moment: { type: Object, value: {} },
    showComments: { type: Boolean, value: true },
    maxComments: { type: Number, value: 2 }
  },
  data: {
    liked: false,
    likeCount: 0,
    commentCount: 0,
    displayComments: [],
    moreCommentsCount: 0,
    likeSummary: '',
    dynastyInfo: null,
    avatarFigure: {}
  },
  observers: {
    'moment': function (m) {
      if (!m) return
      const likes = m.likes || []
      const comments = m.comments || []
      const app = getApp()
      const openid = (app && app.globalData && app.globalData.openid) || 'local_user'
      const liked = likes.some(l => (l.openid || l) === openid)
      const displayComments = comments.slice(0, this.properties.maxComments)
      const moreCommentsCount = Math.max(0, comments.length - this.properties.maxComments)
      const likeSummary = this.buildLikeSummary(likes)
      const dynastyInfo = DYNASTY_FILTERS.find(d => d.key === m.dynasty) || null
      const avatarFigure = {
        figureId: m.figureId,
        figureName: m.figureName,
        figureTitle: m.figureTitle,
        dynasty: m.dynasty,
        avatar: m.avatar
      }
      this.setData({
        liked,
        likeCount: likes.length,
        commentCount: comments.length,
        displayComments,
        moreCommentsCount,
        likeSummary,
        dynastyInfo,
        avatarFigure
      })
    }
  },
  methods: {
    buildLikeSummary(likes) {
      if (!likes || !likes.length) return ''
      const names = likes.map(l => l.name || l.figureName || l).filter(Boolean)
      if (names.length <= 3) return names.join('、') + ' 等觉得很赞'
      return names.slice(0, 2).join('、') + ` 等${likes.length}人觉得很赞`
    },
    onCardTap() {
      this.triggerEvent('cardTap', { moment: this.properties.moment })
    },
    onContentTap() { this.triggerEvent('contentTap', { moment: this.properties.moment }) },
    onAvatarTap(e) {
      this.triggerEvent('avatarTap', { figure: this.data.avatarFigure }, e)
    },
    onImageTap(e) {
      const idx = (e.currentTarget.dataset && e.currentTarget.dataset.idx) || 0
      this.triggerEvent('imageTap', {
        images: this.properties.moment.images || [],
        index: idx
      })
    },
    onLike(e) {
      const id = this.properties.moment._id
      const liked = !this.data.liked
      const likeCount = liked ? this.data.likeCount + 1 : this.data.likeCount - 1
      this.setData({ liked, likeCount })
      this.triggerEvent('like', { momentId: id, liked, likeCount }, e)
    },
    onComment(e) {
      this.triggerEvent('comment', { moment: this.properties.moment }, e)
    },
    onShareTap(e) {
      this.triggerEvent('share', { moment: this.properties.moment }, e)
    },
    onShowAll(e) {
      this.triggerEvent('showAllComments', { moment: this.properties.moment }, e)
    }
  }
})
