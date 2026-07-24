const { requestCloud } = require('../../../utils/cloudRequest')
const loginGuard = require('../../../utils/loginGuard')

Page({
  data: {
    quizId: '',
    quiz: null,
    questions: [],
    results: [],
    currentIndex: 0,
    answers: [],
    selectedLabel: '',
    submitting: false,
    loading: true,
    error: '',
    showExitConfirm: false,
    statusBarHeight: 20
  },

  _navigating: false,

  onLoad(options) {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 20 })
    } catch (e) {}
    const id = options.id || ''
    if (!id) {
      wx.showToast({ title: '测试不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1200)
      return
    }
    this.setData({ quizId: id })
    this.loadDetail()
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
  },

  async loadDetail() {
    try {
      const data = await requestCloud('dna', 'quiz-detail', { id: this.data.quizId })
      if (!data || !data.quiz || !data.questions || !data.questions.length) {
        this.setData({ loading: false, error: '测试数据缺失' })
        return
      }
      // 题目预处理：order/label
      const questions = data.questions.map(q => ({
        ...q,
        _id: q._id
      }))
      this.setData({
        quiz: data.quiz,
        questions,
        results: data.results || [],
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false, error: '加载失败，请重试' })
    }
  },

  onSelectOption(e) {
    if (this._navigating) return
    const { label } = e.currentTarget.dataset
    const { currentIndex, questions, answers } = this.data
    const current = questions[currentIndex]
    if (!current) return

    // 已选过则不允许重选（自动跳题模式下）
    if (this.data.selectedLabel) return

    const newAnswers = answers.slice()
    newAnswers[currentIndex] = { q: current._id, a: label }
    this.setData({
      selectedLabel: label,
      answers: newAnswers
    })

    // 300ms 后自动下一题
    setTimeout(() => {
      if (this._navigating) return
      if (currentIndex < questions.length - 1) {
        this.setData({
          currentIndex: currentIndex + 1,
          selectedLabel: ''
        })
      } else {
        this.onSubmit()
      }
    }, 300)
  },

  async onSubmit() {
    if (this._navigating) return
    this._navigating = true
    this.setData({ submitting: true })

    try {
      const { quizId, answers } = this.data
      const data = await requestCloud('dna', 'submit', { quizId, answers })
      const recordId = data && data.recordId
      if (!recordId) {
        throw new Error('结果生成失败')
      }
      wx.redirectTo({
        url: '/pages/discover/dna-result/index?recordId=' + recordId,
        fail: () => {
          this._navigating = false
          this.setData({ submitting: false })
          wx.showToast({ title: '跳转失败，请重试', icon: 'none' })
        }
      })
    } catch (e) {
      this._navigating = false
      this.setData({ submitting: false })
      wx.showToast({ title: e.message || '提交失败', icon: 'none' })
    }
  },

  onTapExit() {
    this.setData({ showExitConfirm: true })
  },

  onConfirmExit() {
    wx.navigateBack()
  },

  onCancelExit() {
    this.setData({ showExitConfirm: false })
  },

  // 防止误触返回
  onBackPress() {
    this.setData({ showExitConfirm: true })
    return true
  },

  onShareAppMessage() {
    const title = (this.data.quiz && this.data.quiz.title) || '来穿越圈测测你更像哪位历史人物？'
    return {
      title,
      path: '/pages/discover/dna-hall/index'
    }
  }
})
