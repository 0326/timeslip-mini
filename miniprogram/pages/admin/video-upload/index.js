const { requestCloud } = require('../../../utils/cloudRequest')
const loginGuard = require('../../../utils/loginGuard')

Page({
  data: {
    editId: '',
    channelList: [],
    selectedChannel: null,
    selectedChannelIdx: -1,
    title: '',
    description: '',
    historicalEvent: '',
    tags: [],
    tagInput: '',
    videoTempPath: '',
    coverTempPath: '',
    duration: 0,
    videoFileID: '',
    coverFileID: '',
    uploading: false,
    uploadProgress: 0,
    aiComments: [],
    showChannelPicker: false
  },

  onLoad(options) {
    if (!loginGuard.requireAdmin(this)) return
    this.loadChannels()
  },

  async loadChannels() {
    try {
      const data = await requestCloud('videoChannel', 'adminChannelList', {}, { throwError: false })
      this.setData({ channelList: data || [] })
    } catch (e) {
      wx.showToast({ title: '加载视频号列表失败', icon: 'none' })
    }
  },

  onChooseChannel() {
    this.setData({ showChannelPicker: true })
  },

  onChannelPick(e) {
    const idx = e.currentTarget.dataset.idx
    const channel = this.data.channelList[idx]
    this.setData({
      selectedChannel: channel,
      selectedChannelIdx: idx,
      showChannelPicker: false
    })
  },

  closeChannelPicker() {
    this.setData({ showChannelPicker: false })
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },

  onEventInput(e) {
    this.setData({ historicalEvent: e.detail.value })
  },

  onTagInput(e) {
    this.setData({ tagInput: e.detail.value })
  },

  onTagConfirm() {
    const tag = this.data.tagInput.trim()
    if (!tag) return
    if (this.data.tags.length >= 10) {
      wx.showToast({ title: '最多10个标签', icon: 'none' })
      return
    }
    if (this.data.tags.includes(tag)) {
      wx.showToast({ title: '标签已存在', icon: 'none' })
      return
    }
    this.setData({
      tags: [...this.data.tags, tag],
      tagInput: ''
    })
  },

  removeTag(e) {
    const idx = e.currentTarget.dataset.idx
    const tags = this.data.tags.slice()
    tags.splice(idx, 1)
    this.setData({ tags })
  },

  async chooseVideo() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['video'],
        sourceType: ['album', 'camera'],
        maxDuration: 180,
        sizeType: ['compressed']
      })
      const file = res.tempFiles[0]
      this.setData({
        videoTempPath: file.tempFilePath,
        duration: Math.floor(file.duration || 0)
      })
    } catch (e) {}
  },

  async chooseCover() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['compressed']
      })
      this.setData({ coverTempPath: res.tempFiles[0].tempFilePath })
    } catch (e) {}
  },

  async uploadFile(filePath, type) {
    const channel = this.data.selectedChannel
    if (!channel) return ''
    const figureId = channel.figureId || 'unknown'
    const random = Math.random().toString(36).slice(2, 8)
    const ext = type === 'video' ? 'mp4' : 'jpg'
    const cloudPath = type === 'video'
      ? `videos/${figureId}/${Date.now()}_${random}.${ext}`
      : `video-covers/${figureId}/${Date.now()}_${random}.${ext}`

    return new Promise((resolve, reject) => {
      const uploadTask = wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: res => resolve(res.fileID),
        fail: err => reject(err)
      })
      uploadTask.onProgressUpdate(res => {
        if (type === 'video') {
          this.setData({ uploadProgress: res.progress })
        }
      })
    })
  },

  async onSubmit() {
    if (!this.data.selectedChannel) {
      wx.showToast({ title: '请选择视频号', icon: 'none' })
      return
    }
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!this.data.videoTempPath && !this.data.videoFileID) {
      wx.showToast({ title: '请选择视频', icon: 'none' })
      return
    }

    wx.showLoading({ title: '上传中...', mask: true })
    this.setData({ uploading: true, uploadProgress: 0 })

    try {
      let videoFileID = this.data.videoFileID
      if (!videoFileID && this.data.videoTempPath) {
        videoFileID = await this.uploadFile(this.data.videoTempPath, 'video')
      }

      let coverFileID = this.data.coverFileID
      if (!coverFileID && this.data.coverTempPath) {
        coverFileID = await this.uploadFile(this.data.coverTempPath, 'cover')
      }

      const res = await requestCloud('videoChannel', 'adminVideoCreate', {
        channelId: this.data.selectedChannel._id,
        title: this.data.title.trim(),
        description: this.data.description.trim(),
        coverUrl: coverFileID,
        videoUrl: videoFileID,
        duration: this.data.duration,
        historicalEvent: this.data.historicalEvent.trim(),
        tags: this.data.tags
      }, { throwError: false })

      wx.hideLoading()
      wx.showToast({ title: '发布成功', icon: 'success' })

      if (res && res._id && this.data.aiComments.length > 0) {
        await this.uploadAiComments(res._id)
      }

      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '发布失败', icon: 'none' })
    } finally {
      this.setData({ uploading: false })
    }
  },

  async uploadAiComments(videoId) {
    for (const c of this.data.aiComments) {
      try {
        await requestCloud('videoChannel', 'adminCommentAdd', {
          videoId,
          fromFigureId: c.fromFigureId,
          fromFigureName: c.fromFigureName,
          fromFigureTitle: c.fromFigureTitle || '',
          fromAvatar: c.fromAvatar || '',
          fromDynasty: c.fromDynasty || '',
          content: c.content
        }, { throwError: false })
      } catch (_) {}
    }
  },

  addAiComment() {
    const figures = [
      { id: 'fig-dufu', name: '杜甫', title: '诗圣', dynasty: 'tang' },
      { id: 'fig-libai', name: '李白', title: '诗仙', dynasty: 'tang' },
      { id: 'fig-baijuyi', name: '白居易', title: '诗魔', dynasty: 'tang' },
      { id: 'fig-sushi', name: '苏轼', title: '东坡居士', dynasty: 'song' },
      { id: 'fig-zhugeliang', name: '诸葛亮', title: '武乡侯', dynasty: 'sanguo' },
      { id: 'fig-liubang', name: '刘邦', title: '汉高祖', dynasty: 'han' },
      { id: 'fig-wuzetian', name: '武则天', title: '则天大圣皇帝', dynasty: 'tang' },
      { id: 'fig-yuefei', name: '岳飞', title: '岳武穆', dynasty: 'song' },
      { id: 'fig-xiangyu', name: '项羽', title: '西楚霸王', dynasty: 'sanguo' },
      { id: 'fig-simqian', name: '司马迁', title: '太史公', dynasty: 'han' }
    ]

    wx.showActionSheet({
      itemList: figures.map(f => `${f.name} · ${f.title}`),
      success: res => {
        const fig = figures[res.tapIndex]
        wx.showModal({
          title: `添加${fig.name}的评论`,
          editable: true,
          placeholderText: '请输入评论内容',
          success: r => {
            if (!r.confirm || !r.content) return
            const newComment = {
              fromFigureId: fig.id,
              fromFigureName: fig.name,
              fromFigureTitle: fig.title,
              fromDynasty: fig.dynasty,
              content: r.content.trim()
            }
            this.setData({ aiComments: [...this.data.aiComments, newComment] })
          }
        })
      }
    })
  },

  removeAiComment(e) {
    const idx = e.currentTarget.dataset.idx
    const list = this.data.aiComments.slice()
    list.splice(idx, 1)
    this.setData({ aiComments: list })
  }
})
