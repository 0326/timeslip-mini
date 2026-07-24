Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    comment: { type: Object, value: {} },
    canDelete: { type: Boolean, value: false }
  },
  data: {
    isLiked: false,
    likeCount: 0,
    avatar: {}
  },
  observers: {
    'comment': function (c) {
      if (!c) return
      const likes = c.likes || []
      const app = getApp()
      const openid = (app && app.globalData && app.globalData.openid) || 'local_user'
      const isLiked = likes.some(l => (l.openid || l) === openid)
      const avatar = {
        figureId: c.figureId || c.openid || 'anon',
        figureName: c.name,
        figureTitle: c.figureTitle || '',
        dynasty: c.dynasty || '',
        avatar: c.avatar || ''
      }
      this.setData({ isLiked, likeCount: likes.length, avatar })
    }
  },
  methods: {
    onAvatarTap(e) {
      this.triggerEvent('avatarTap', { comment: this.properties.comment }, e)
    },
    onNameTap(e) {
      this.triggerEvent('nameTap', { comment: this.properties.comment }, e)
    },
    onContentTap(e) {
      this.triggerEvent('contentTap', { comment: this.properties.comment }, e)
    },
    onLike(e) {
      const c = this.properties.comment
      const isLiked = !this.data.isLiked
      const likeCount = isLiked ? this.data.likeCount + 1 : this.data.likeCount - 1
      this.setData({ isLiked, likeCount })
      this.triggerEvent('like', { commentId: c._id, isLiked, likeCount }, e)
    },
    onReply(e) {
      this.triggerEvent('reply', { comment: this.properties.comment }, e)
    },
    onDelete(e) {
      const c = this.properties.comment
      wx.showModal({
        title: '删除评论',
        content: '确定要删除此评论吗？',
        confirmText: '删除',
        confirmColor: '#FA5151',
        success: (res) => {
          if (res.confirm) {
            this.triggerEvent('delete', { commentId: c._id })
          }
        }
      })
    }
  }
})
