const { requestCloud } = require('../../../utils/cloudRequest')
const loginGuard = require('../../../utils/loginGuard')

const QUIZ_THEME = {
  emperor: { start: '#B71C1C', end: '#5D1A1A' },
  poet: { start: '#1E90FF', end: '#1A4A7F' },
  general: { start: '#2F4F4F', end: '#1A2828' },
  minister: { start: '#8B5A2B', end: '#4A3015' },
  other: { start: '#666666', end: '#333333' }
}

Page({
  data: {
    quizzes: [],
    loading: true,
    error: '',
    hero: null
  },

  onLoad() {
    this.loadQuizzes()
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
    // 返回大厅时刷新参与人数
    if (this._needRefresh) {
      this._needRefresh = false
      this.loadQuizzes(true)
    }
  },

  onPullDownRefresh() {
    this.loadQuizzes(true).finally(() => wx.stopPullDownRefresh())
  },

  async loadQuizzes(silent) {
    if (!silent) this.setData({ loading: true, error: '' })
    try {
      const data = await requestCloud('dna', 'quiz-list', {}, { throwError: false })
      const quizzes = (data && data.quizzes) || []
      // 注入主题色
      quizzes.forEach(q => {
        var theme = QUIZ_THEME[q.category] || QUIZ_THEME.other
        q._bgStart = theme.start
        q._bgEnd = theme.end
        q._participantText = q.participantCount > 0
          ? (q.participantCount > 9999 ? '9999+ 人参与' : q.participantCount + ' 人参与')
          : '抢先体验'
      })
      // 取第一个作为 hero
      var hero = quizzes[0] ? Object.assign({}, quizzes[0]) : null
      var list = quizzes.slice(1)
      this.setData({
        quizzes: list,
        hero: hero,
        loading: false,
        error: quizzes.length ? '' : '暂无测试，敬请期待'
      })
    } catch (e) {
      this.setData({
        loading: false,
        error: '加载失败，下拉刷新重试'
      })
    }
  },

  onTapQuiz(e) {
    var id = e.currentTarget.dataset.id
    if (!id) return
    this._needRefresh = true
    wx.navigateTo({
      url: '/pages/discover/dna-quiz/index?id=' + id
    })
  },

  onTapHero() {
    if (!this.data.hero) return
    this._needRefresh = true
    wx.navigateTo({
      url: '/pages/discover/dna-quiz/index?id=' + this.data.hero.id
    })
  },

  onShareAppMessage() {
    return {
      title: '来穿越圈测测你更像哪位历史人物？',
      path: '/pages/discover/dna-hall/index',
      imageUrl: ''
    }
  },

  onShareTimeline() {
    return {
      title: '来穿越圈测测你更像哪位历史人物？',
      query: ''
    }
  }
})
