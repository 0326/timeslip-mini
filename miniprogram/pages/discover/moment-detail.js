const { requestCloud } = require('../../utils/cloudRequest')
const { formatRelative, getDynastyInfo } = require('../../utils/date')
const loginGuard = require('../../utils/loginGuard')

const MOCK_MOMENT = {
  _id: 'm2',
  figureId: 'zhugeliang',
  figureName: '诸葛亮',
  figureTitle: '武乡侯',
  avatar: 'https://img.icons8.com/color/96/general.png',
  dynasty: 'sanguo',
  content: '臣本布衣，躬耕于南阳，苟全性命于乱世，不求闻达于诸侯。先帝不以臣卑鄙，猥自枉屈，三顾臣于草庐之中，咨臣以当世之事，由是感激，遂许先帝以驱驰。\n\n后值倾覆，受任于败军之际，奉命于危难之间，尔来二十有一年矣。',
  images: [],
  historicalEvent: '三顾茅庐 · 出师表',
  historicalDate: '公元227年',
  likes: [
    { openid: 'liubei', name: '刘备', avatar: '' },
    { openid: 'guanyu', name: '关羽', avatar: '' }
  ],
  likeCount: 88,
  comments: [
    { _id: 'c1', openid: 'liubei', name: '刘备', avatar: '', content: '孔明先生，备得先生，如鱼得水也！', createdAt: Date.now() - 3600000 * 20 },
    { _id: 'c2', openid: 'guanyu', name: '关羽', avatar: '', content: '嗯......确实有几分本事。', createdAt: Date.now() - 3600000 * 18 },
    { _id: 'c3', openid: 'zhangfei', name: '张飞', avatar: '', content: '俺也觉得军师说的对！', createdAt: Date.now() - 3600000 * 12 },
    { _id: 'c4', openid: 'zhaoyun', name: '赵云', avatar: '', content: '常山赵子龙愿为军师效犬马之劳！', createdAt: Date.now() - 3600000 * 6 }
  ],
  commentCount: 4,
  createdAt: Date.now() - 86400000
}

Page({
  data: {
    id: '',
    moment: null,
    dynastyInfo: null,
    commentInput: '',
    comments: [],
    submitting: false,
    displayTime: ''
  },

  onLoad(options) {
    const id = options.id || 'm2'
    this.setData({ id })
    this.loadDetail(id)
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  async loadDetail(id) {
    try {
      const data = await requestCloud('moment', 'detail', { momentId: id }, { throwError: false })
      let moment = (data && data.moment) || MOCK_MOMENT
      moment = {
        ...moment,
        dynastyInfo: getDynastyInfo(moment.dynasty),
        displayTime: formatRelative(moment.createdAt)
      }
      const comments = (moment.comments || []).map(c => ({
        ...c,
        displayTime: formatRelative(c.createdAt)
      }))
      this.setData({ moment, comments, dynastyInfo: moment.dynastyInfo })
    } catch (e) {
      const m = { ...MOCK_MOMENT, dynastyInfo: getDynastyInfo(MOCK_MOMENT.dynasty), displayTime: formatRelative(MOCK_MOMENT.createdAt) }
      const comments = (m.comments || []).map(c => ({ ...c, displayTime: formatRelative(c.createdAt) }))
      this.setData({ moment: m, comments, dynastyInfo: m.dynastyInfo })
    }
  },

  onLike() {
    if (!this.data.moment) return
    const moment = { ...this.data.moment }
    const liked = !moment._liked
    const app = getApp()
    const openid = (app.globalData && app.globalData.openid) || 'me'
    const likes = moment.likes || []
    if (liked) {
      likes.push({ openid, name: '我', avatar: '' })
      moment.likeCount = (moment.likeCount || 0) + 1
    } else {
      moment.likes = likes.filter(l => l.openid !== openid)
      moment.likeCount = Math.max(0, (moment.likeCount || 0) - 1)
    }
    moment._liked = liked
    this.setData({ moment })
    requestCloud('moment', liked ? 'like' : 'unlike', { momentId: this.data.id }, { throwError: false }).catch(() => {})
  },

  onInput(e) {
    this.setData({ commentInput: e.detail.value })
  },

  async onSubmitComment() {
    const text = (this.data.commentInput || '').trim()
    if (!text || this.data.submitting) return
    if (text.length > 500) {
      wx.showToast({ title: '最多500字', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      await requestCloud('contentCheck', 'check', { content: text }, { throwError: false })
    } catch (e) {}
    const newComment = {
      _id: 'c_' + Date.now(),
      openid: 'me',
      name: '我',
      avatar: '',
      content: text,
      createdAt: Date.now(),
      displayTime: '刚刚'
    }
    const comments = this.data.comments.concat([newComment])
    const moment = { ...this.data.moment, commentCount: (this.data.moment.commentCount || 0) + 1 }
    this.setData({ comments, moment, commentInput: '', submitting: false })
    wx.showToast({ title: '发布成功', icon: 'success' })
    try {
      await requestCloud('moment', 'comment', {
        momentId: this.data.id,
        content: text
      }, { throwError: false })
    } catch (e) {}
  },

  onShare() {
    const m = this.data.moment || {}
    wx.showShareMenu({ withShareTicket: true })
  },

  onShareAppMessage() {
    const m = this.data.moment || {}
    return {
      title: `${m.figureName || ''}的穿越朋友圈：${(m.content || '').slice(0, 20)}...`,
      path: `/pages/discover/moment-detail?id=${this.data.id}`
    }
  }
})
