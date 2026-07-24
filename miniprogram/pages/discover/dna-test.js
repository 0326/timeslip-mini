const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')
const { uid, sleep } = require('../../utils/helpers')
const { AI_CONFIG } = require('../../utils/constants')

const MOCK_QUESTIONS = [
  {
    key: 'q1',
    title: '面对重大决策时，你更倾向于：',
    options: [
      { key: 'A', text: '深思熟虑，谋定而后动', tag: '谋略型' },
      { key: 'B', text: '当机立断，先发制人', tag: '魄力型' },
      { key: 'C', text: '广纳谏言，集思广益', tag: '包容型' },
      { key: 'D', text: '顺其自然，随机应变', tag: '潇洒型' }
    ]
  },
  {
    key: 'q2',
    title: '有人当众冒犯你，你的第一反应是：',
    options: [
      { key: 'A', text: '暂时隐忍，秋后算账', tag: '隐忍型' },
      { key: 'B', text: '当场回击，绝不留情', tag: '刚烈型' },
      { key: 'C', text: '一笑而过，不以为意', tag: '豁达型' },
      { key: 'D', text: '旁敲侧击，绵里藏针', tag: '智斗型' }
    ]
  },
  {
    key: 'q3',
    title: '面对理想与现实的巨大落差，你会：',
    options: [
      { key: 'A', text: '卧薪尝胆，等待时机', tag: '坚韧型' },
      { key: 'B', text: '破釜沉舟，孤注一掷', tag: '冒险型' },
      { key: 'C', text: '著书立说，传之后世', tag: '传世型' },
      { key: 'D', text: '归隐山林，逍遥自在', tag: '隐逸型' }
    ]
  },
  {
    key: 'q4',
    title: '朋友被人陷害，你会：',
    options: [
      { key: 'A', text: '挺身而出，仗义执言', tag: '侠义型' },
      { key: 'B', text: '暗中筹划，助其平反', tag: '谋略型' },
      { key: 'C', text: '明哲保身，另择时机', tag: '务实型' },
      { key: 'D', text: '与其同患难，共进退', tag: '忠义型' }
    ]
  },
  {
    key: 'q5',
    title: '你心目中的成功是：',
    options: [
      { key: 'A', text: '建功立业，青史留名', tag: '功业型' },
      { key: 'B', text: '文传后世，桃李满天下', tag: '文名型' },
      { key: 'C', text: '国泰民安，海晏河清', tag: '治世型' },
      { key: 'D', text: '问心无愧，自在人生', tag: '超脱型' }
    ]
  },
  {
    key: 'q6',
    title: '面对失败和挫折，你的座右铭是：',
    options: [
      { key: 'A', text: '胜败乃兵家常事', tag: '洒脱型' },
      { key: 'B', text: '君子报仇，十年不晚', tag: '坚忍型' },
      { key: 'C', text: '天将降大任于斯人也', tag: '理想型' },
      { key: 'D', text: '人生得意须尽欢', tag: '浪漫型' }
    ]
  }
]

const MOCK_RESULTS = {
  'simaqian': {
    figureId: 'simaqian',
    figureName: '司马迁',
    figureTitle: '太史公',
    dynasty: 'han',
    dynastyName: '西汉',
    matchPercent: 92,
    bgStart: '#8B4513',
    bgEnd: '#654321',
    bio: '司马迁，字子长，夏阳人。西汉史学家、思想家、文学家，被后世尊称为"史圣"。因李陵之祸，身受宫刑，却发愤著书，完成中国第一部纪传体通史《史记》，被鲁迅誉为"史家之绝唱，无韵之离骚"。',
    quote: '人固有一死，或重于泰山，或轻于鸿毛。',
    reasons: [
      '你重视真相与记录，有强烈的历史使命感',
      '面对逆境，你选择坚忍而非沉沦',
      '你有超越时代的眼光与胸怀'
    ],
    radar: { 谋略: 85, 魄力: 60, 文采: 98, 忠义: 95, 隐忍: 99, 豁达: 70 }
  },
  'libai': {
    figureId: 'libai',
    figureName: '李白',
    figureTitle: '诗仙',
    dynasty: 'tang',
    dynastyName: '盛唐',
    matchPercent: 88,
    bgStart: '#1E90FF',
    bgEnd: '#00BFFF',
    bio: '李白，字太白，号青莲居士，唐代伟大的浪漫主义诗人，被后人誉为"诗仙"。其诗豪放飘逸，想象丰富，语言流转自然，音律和谐多变，代表了盛唐诗歌的巅峰。',
    quote: '天生我材必有用，千金散尽还复来。',
    reasons: [
      '你天性浪漫，追求自由与理想',
      '才华横溢，不拘一格，有超凡的想象力',
      '面对人生起伏，总能保持乐观洒脱'
    ],
    radar: { 谋略: 55, 魄力: 80, 文采: 100, 忠义: 75, 隐忍: 30, 豁达: 98 }
  },
  'zhugeliang': {
    figureId: 'zhugeliang',
    figureName: '诸葛亮',
    figureTitle: '武乡侯',
    dynasty: 'sanguo',
    dynastyName: '三国·蜀',
    matchPercent: 95,
    bgStart: '#2F4F4F',
    bgEnd: '#556B2F',
    bio: '诸葛亮，字孔明，号卧龙，琅琊阳都人。三国时期蜀汉丞相，杰出的政治家、军事家、发明家。一生鞠躬尽瘁，死而后已，是中国传统文化中忠臣与智者的代表人物。',
    quote: '非淡泊无以明志，非宁静无以致远。',
    reasons: [
      '你智慧超群，善于运筹帷幄',
      '有强烈的责任感与忠诚品格',
      '做事深思熟虑，凡事预则立'
    ],
    radar: { 谋略: 99, 魄力: 75, 文采: 85, 忠义: 100, 隐忍: 80, 豁达: 60 }
  },
  'yueniang': {
    figureId: 'wuzetian',
    figureName: '武则天',
    figureTitle: '则天大圣皇帝',
    dynasty: 'tang',
    dynastyName: '唐·武周',
    matchPercent: 85,
    bgStart: '#C71585',
    bgEnd: '#8B008B',
    bio: '武则天，名武曌，并州文水人。中国历史上唯一的正统女皇帝，也是即位年龄最大、寿命最长的皇帝之一。她在位期间，打击门阀世族，促进经济发展，稳定边疆，推动文化发展。',
    quote: '君子虽殒，美名不灭。',
    reasons: [
      '你有过人的胆识与魄力，敢为天下先',
      '善于在复杂环境中把握机遇',
      '既有雄才大略，也懂用人之道'
    ],
    radar: { 谋略: 92, 魄力: 98, 文采: 80, 忠义: 55, 隐忍: 90, 豁达: 65 }
  },
  'sushi': {
    figureId: 'sushi',
    figureName: '苏轼',
    figureTitle: '东坡居士',
    dynasty: 'song',
    dynastyName: '北宋',
    matchPercent: 90,
    bgStart: '#228B22',
    bgEnd: '#2E8B57',
    bio: '苏轼，字子瞻，号东坡居士，眉山人。北宋著名文学家、书法家、画家。其诗、词、赋、散文均成就极高，为"唐宋八大家"之一。一生仕途坎坷，但始终旷达乐观。',
    quote: '竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。',
    reasons: [
      '你有豁达的人生态度，能从容面对风雨',
      '多才多艺，对生活充满热爱',
      '真性情中人，重情义，有风骨'
    ],
    radar: { 谋略: 70, 魄力: 65, 文采: 99, 忠义: 88, 隐忍: 75, 豁达: 100 }
  },
  'yuefei': {
    figureId: 'yuefei',
    figureName: '岳飞',
    figureTitle: '岳武穆',
    dynasty: 'song',
    dynastyName: '南宋',
    matchPercent: 93,
    bgStart: '#DC143C',
    bgEnd: '#8B0000',
    bio: '岳飞，字鹏举，相州汤阴人。南宋抗金名将，中国历史上著名军事家、战略家、民族英雄。其"精忠报国"的精神，成为中华民族爱国主义的象征。',
    quote: '靖康耻，犹未雪；臣子恨，何时灭！',
    reasons: [
      '你有强烈的家国情怀与正义感',
      '意志坚定，百折不挠',
      '重气节，轻生死，有大丈夫气概'
    ],
    radar: { 谋略: 88, 魄力: 95, 文采: 75, 忠义: 100, 隐忍: 65, 豁达: 50 }
  }
}

Page({
  data: {
    loading: true,
    questions: [],
    currentIdx: 0,
    totalQuestions: 0,
    progressPercent: 0,
    selectedOption: '',
    answers: {},
    result: null
  },

  onLoad() {
    this.loadQuestions()
  },

  async loadQuestions() {
    try {
      const data = await requestCloud('dna', 'getQuestions', {}, { throwError: false })
      const questions = (data && data.questions) || MOCK_QUESTIONS
      this.setData({
        questions,
        totalQuestions: questions.length
      })
    } catch (e) {
      this.setData({
        questions: MOCK_QUESTIONS,
        totalQuestions: MOCK_QUESTIONS.length
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onSelectOption(e) {
    const { key } = e.currentTarget.dataset
    const { currentIdx, answers, questions } = this.data
    const newAnswers = { ...answers, [questions[currentIdx].key]: key }
    this.setData({
      selectedOption: key,
      answers: newAnswers
    })
  },

  onPrev() {
    const { currentIdx, questions, answers } = this.data
    if (currentIdx === 0) return
    const prevIdx = currentIdx - 1
    const prevKey = questions[prevIdx].key
    this.setData({
      currentIdx: prevIdx,
      progressPercent: Math.round(prevIdx / questions.length * 100),
      selectedOption: answers[prevKey] || ''
    })
  },

  async onNext() {
    const { currentIdx, questions, answers, selectedOption } = this.data
    if (!selectedOption) return

    if (currentIdx === questions.length - 1) {
      this.setData({ loading: true })
      await sleep(500)
      this.calcResult()
      return
    }

    const nextIdx = currentIdx + 1
    const nextKey = questions[nextIdx].key
    this.setData({
      currentIdx: nextIdx,
      progressPercent: Math.round(nextIdx / questions.length * 100),
      selectedOption: answers[nextKey] || ''
    })
  },

  calcResult() {
    const { answers } = this.data
    const scores = {}
    Object.keys(MOCK_RESULTS).forEach(k => { scores[k] = 50 })

    Object.values(answers).forEach(opt => {
      if (opt === 'A') scores.simaqian += 10, scores.zhugeliang += 8, scores.yuefei += 5
      if (opt === 'B') scores.wuzetian += 10, scores.yuefei += 10, scores.libai += 5
      if (opt === 'C') scores.sushi += 10, scores.libai += 8, scores.simaqian += 5
      if (opt === 'D') scores.libai += 10, scores.sushi += 8, scores.simaqian += 3
    })

    let best = 'simaqian', bestScore = 0
    Object.keys(scores).forEach(k => {
      if (scores[k] > bestScore) { bestScore = scores[k]; best = k }
    })

    const result = {
      ...MOCK_RESULTS[best],
      matchPercent: Math.min(99, Math.round(60 + Math.random() * 35))
    }

    storage.set('dna_result', result, 86400 * 7)
    this.setData({ result, loading: false })

    setTimeout(() => this.drawRadar(result.radar), 200)
  },

  drawRadar(radarData) {
    if (!radarData) return
    const ctx = wx.createCanvasContext('radarCanvas')
    const labels = Object.keys(radarData)
    const values = Object.values(radarData)
    const centerX = 180, centerY = 220, radius = 150
    const n = labels.length

    ctx.setStrokeStyle('#e5e5e5')
    ctx.setLineWidth(1)
    for (let ring = 1; ring <= 5; ring++) {
      ctx.beginPath()
      for (let i = 0; i <= n; i++) {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2
        const r = (radius * ring) / 5
        const x = centerX + r * Math.cos(angle)
        const y = centerY + r * Math.sin(angle)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
    }

    ctx.setStrokeStyle('#d0d0d0')
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle))
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.setFillStyle('rgba(7,193,96,0.3)')
    ctx.setStrokeStyle('#07C160')
    ctx.setLineWidth(2)
    for (let i = 0; i <= n; i++) {
      const idx = i % n
      const angle = (Math.PI * 2 * idx) / n - Math.PI / 2
      const v = (values[idx] || 0) / 100
      const x = centerX + radius * v * Math.cos(angle)
      const y = centerY + radius * v * Math.sin(angle)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.setFillStyle('#191919')
    ctx.setFontSize(12)
    labels.forEach((label, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2
      const lx = centerX + (radius + 24) * Math.cos(angle)
      const ly = centerY + (radius + 24) * Math.sin(angle)
      ctx.setTextAlign('center')
      ctx.setTextBaseline('middle')
      ctx.fillText(`${label} ${values[i]}`, lx, ly)
    })

    ctx.draw()
  },

  goChat() {
    const { result } = this.data
    if (!result) return
    const name = result.figureTitle ? `${result.figureName} · ${result.figureTitle}` : result.figureName
    wx.redirectTo({
      url: `/pages/chat/room?figureId=${result.figureId}&figureName=${encodeURIComponent(name)}`
    })
  },

  onRetry() {
    this.setData({
      currentIdx: 0,
      progressPercent: 0,
      selectedOption: '',
      answers: {},
      result: null
    })
  },

  onShareAppMessage() {
    const r = this.data.result
    return {
      title: r ? `我的历史人格是${r.figureName}！你也来测测？` : '来测测你的历史DNA！'
    }
  }
})
