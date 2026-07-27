const { getDynastyInfo } = require('./date')

// ========== 时间工具（统一使用毫秒） ==========
function _pad2(n) { return n < 10 ? '0' + n : '' + n }
function _normalizeMs(ts) {
  if (!ts) return Date.now()
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts === 'number') return ts > 1e12 ? ts : ts * 1000
  const t = new Date(ts).getTime()
  return isNaN(t) ? Date.now() : t
}
function _formatFull(ts) {
  const d = new Date(_normalizeMs(ts))
  return `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())} ${_pad2(d.getHours())}:${_pad2(d.getMinutes())}`
}
function _formatRelative(ts) {
  const now = Date.now()
  const ms = _normalizeMs(ts)
  const diff = Math.floor((now - ms) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
  if (diff < 2592000) return Math.floor(diff / 86400) + '天前'
  const d = new Date(ms)
  return `${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}`
}

// ========== 排版工具 ==========
function computeImageGridType(count) {
  if (!count || count <= 0) return 'none'
  if (count === 1) return '1'
  if (count === 2 || count === 3) return String(count)
  if (count === 4) return '4'
  // 5~9 张统一走 3 列九宫格布局
  return '9'
}
function computeHistoricalText(historical) {
  if (!historical || typeof historical !== 'object') return ''
  const parts = []
  if (historical.event) parts.push(historical.event)
  if (historical.date) parts.push(historical.date)
  if (!parts.length) return ''
  return '📍 ' + parts.join(' · ')
}

function normalizeRemoteAssetUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const value = url.trim()
  if (!value) return ''
  if (/^(wxfile|http:\/\/tmp|https?:\/\/tmp|https?:\/\/127\.0\.0\.1|https?:\/\/localhost|\/tmp\/|tmp\/)/i.test(value)) {
    return ''
  }
  if (/^(https?:\/\/|cloud:\/\/)/i.test(value)) return value
  return ''
}

function normalizeImageList(images) {
  if (!Array.isArray(images)) return []
  return images.map(normalizeRemoteAssetUrl).filter(Boolean)
}

function normalizeFigureAsset(figure) {
  const f = figure || {}
  return {
    ...f,
    avatar: normalizeRemoteAssetUrl(f.avatar || f.avatarUrl || f.miniAvatarUrl),
    avatarUrl: normalizeRemoteAssetUrl(f.avatarUrl || f.avatar || f.miniAvatarUrl),
    miniAvatarUrl: normalizeRemoteAssetUrl(f.miniAvatarUrl || f.avatar || f.avatarUrl)
  }
}

const MOCK_MOMENTS = [
  {
    _id: 'm1',
    figureId: 'liubang',
    figureName: '刘邦',
    figureTitle: '汉高祖',
    dynasty: 'han',
    content: '今日鸿门，气氛有点微妙。项庄舞剑，意在沛公啊！幸好项伯出来解围，不然今日要交代在这里了...😅',
    images: [],
    historicalEvent: '鸿门宴',
    historicalDate: '公元前206年',
    likes: [
      { openid: 'fan_kuai', name: '樊哙' },
      { openid: 'zhang_liang', name: '张良' },
      { openid: 'xiao_he', name: '萧何' }
    ],
    likeCount: 3,
    comments: [
      { _id: 'mc1', openid: 'fan_zeng', name: '范增', content: '竖子不足与谋！唉，错失良机啊！' },
      { _id: 'mc2', openid: 'xiang_yu', name: '项羽', content: '大哥别走啊，再来喝两杯🤔' },
      { _id: 'mc3', openid: 'zhang_liang', name: '张良', content: '主公吉人天相，此一劫过，后必有大福。' }
    ],
    commentCount: 3,
    createdAt: Date.now() - 3600000 * 2
  },
  {
    _id: 'm2',
    figureId: 'zhugeliang',
    figureName: '诸葛亮',
    figureTitle: '武乡侯',
    dynasty: 'sanguo',
    content: '臣本布衣，躬耕于南阳，苟全性命于乱世，不求闻达于诸侯。先帝不以臣卑鄙，猥自枉屈，三顾臣于草庐之中，咨臣以当世之事，由是感激，遂许先帝以驱驰。\n\n后值倾覆，受任于败军之际，奉命于危难之间，尔来二十有一年矣。',
    images: [],
    historicalEvent: '三顾茅庐',
    historicalDate: '公元207年',
    likes: [
      { openid: 'liubei', name: '刘备' },
      { openid: 'guanyu', name: '关羽' }
    ],
    likeCount: 88,
    comments: [
      { _id: 'mc4', openid: 'liubei', name: '刘备', content: '孔明先生，备得先生，如鱼得水也！' },
      { _id: 'mc5', openid: 'guanyu', name: '关羽', content: '嗯......确实有几分本事。' },
      { _id: 'mc6', openid: 'zhangfei', name: '张飞', content: '俺也觉得军师说的对！' }
    ],
    commentCount: 3,
    createdAt: Date.now() - 86400000
  },
  {
    _id: 'm3',
    figureId: 'libai',
    figureName: '李白',
    figureTitle: '诗仙',
    dynasty: 'tang',
    content: '桃花潭水深千尺，不及汪伦送我情。\n今日一别，不知何日再聚，唯有诗酒相赠！🍶',
    images: [],
    historicalEvent: '赠汪伦',
    historicalDate: '天宝年间',
    likes: [],
    likeCount: 1024,
    comments: [
      { _id: 'mc7', openid: 'dufu', name: '杜甫', content: '白也诗无敌，飘然思不群！' },
      { _id: 'mc8', openid: 'wanglun', name: '汪伦', content: '先生下次一定要再来啊！我这里还有万家酒店！' }
    ],
    commentCount: 2,
    createdAt: Date.now() - 86400000 * 2
  },
  {
    _id: 'm4',
    figureId: 'sushi',
    figureName: '苏轼',
    figureTitle: '东坡居士',
    dynasty: 'song',
    content: '黄州好猪肉，价贱如泥土。贵者不肯吃，贫者不解煮，早晨起来打两碗，饱得自家君莫管。🥩',
    images: [],
    historicalEvent: '东坡肉',
    historicalDate: '元丰年间',
    likes: [],
    likeCount: 520,
    comments: [
      { _id: 'mc9', openid: 'fo_yin', name: '佛印', content: '居士又在研究吃了？哈哈哈！' },
      { _id: 'mc10', openid: 'huangtingjian', name: '黄庭坚', content: '老师！求秘方！' }
    ],
    commentCount: 2,
    createdAt: Date.now() - 86400000 * 3
  }
]

function buildLikePreview(likes, limit = 3) {
  if (!likes || !likes.length) return []
  return likes.slice(0, limit).map(l => ({
    id: l.openid || l.id || '',
    figureId: l.figureId || l.openid || l.id || '',
    name: l.name || '匿名'
  }))
}

function buildCommentPreview(comments, limit = 2) {
  if (!comments || !comments.length) return []
  return comments.slice(0, limit).map(c => ({
    id: c._id || c.id || '',
    figureId: c.figureId || c.openid || c.id || '',
    name: c.name || '匿名',
    avatar: normalizeRemoteAssetUrl(c.avatar),
    dynasty: c.dynasty || '',
    content: c.content || '',
    replyTo: c.replyTo || '',
    replyName: c.replyName || ''
  }))
}

function buildFigureView(row) {
  return {
    id: row.figureId || row._openid || '',
    name: row.figureName || row.name || '匿名古人',
    title: row.figureTitle || '',
    avatar: normalizeRemoteAssetUrl(row.avatar),
    dynasty: row.dynasty || ''
  }
}

function buildHistoricalView(row) {
  if (!row.historicalEvent && !row.historicalDate) return null
  return {
    event: row.historicalEvent || '',
    date: row.historicalDate || '',
    articleId: row.historicalArticleId || '',
    chapterId: row.historicalChapterId || ''
  }
}

function adaptMockMoment(row, openid = 'local_user') {
  const likes = row.likes || []
  const liked = likes.some(l => (l.openid || l) === openid)
  const likeCount = typeof row.likeCount === 'number' ? row.likeCount : likes.length
  const likePreview = buildLikePreview(likes)
  const comments = row.comments || []
  const commentCount = typeof row.commentCount === 'number' ? row.commentCount : comments.length
  const commentPreview = buildCommentPreview(comments, 2)
  const createdAtMs = typeof row.createdAt === 'number' ? row.createdAt : Date.now() - 86400000

  return {
    _id: row._id,
    figure: buildFigureView(row),
    content: row.content || '',
    images: normalizeImageList(row.images),
    historical: buildHistoricalView(row),
    location: row.location || '',
    createdAt: createdAtMs,
    interaction: {
      liked,
      likeCount,
      likePreview,
      commentCount,
      commentPreview
    }
  }
}

function adaptMockComments(comments) {
  if (!comments || !comments.length) return []
  return comments.map(c => ({
    _id: c._id || 'mc_' + Math.random().toString(36).slice(2, 8),
    momentId: c.momentId || '',
    figure: {
      id: c.figureId || c.openid || 'anon',
      name: c.name || '匿名',
      title: c.figureTitle || '',
      avatar: normalizeRemoteAssetUrl(c.avatar),
      dynasty: c.dynasty || ''
    },
    content: c.content || '',
    replyTo: c.replyTo || '',
    replyName: c.replyName || '',
    likeCount: (c.likes || []).length,
    createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now() - 3600000,
    canDelete: false
  }))
}

function enrichMomentView(m) {
  if (!m) return m
  const createdAtMs = _normalizeMs(m.createdAt)
  const content = String(m.content || '')
  const images = normalizeImageList(m.images)
  const figure = normalizeFigureAsset(m.figure)
  const interaction = m.interaction || {}
  const commentPreview = Array.isArray(interaction.commentPreview)
    ? interaction.commentPreview.map(c => ({
        ...c,
        avatar: normalizeRemoteAssetUrl(c.avatar)
      }))
    : []
  const imageLen = images.length
  const dynastyInfo = getDynastyInfo(figure && figure.dynasty)
  const likeCount = typeof (m.interaction && m.interaction.likeCount) === 'number'
    ? m.interaction.likeCount
    : 0
  const likeText = likeCount > 999 ? (likeCount / 1000).toFixed(1) + 'k' : String(likeCount)
  const hasCollapse = content.length > 120
  const historicalText = computeHistoricalText(m.historical)
  return {
    ...m,
    figure,
    createdAt: createdAtMs,
    createdAtText: _formatFull(createdAtMs),
    createdAtRelative: _formatRelative(createdAtMs),
    displayTime: _formatRelative(createdAtMs),
    dynastyInfo,
    likeText,
    content,
    hasCollapse,
    contentCollapsed: hasCollapse ? content.slice(0, 120) + '...' : content,
    images,
    imageGridType: computeImageGridType(imageLen),
    historicalText,
    sourceText: historicalText,
    source: m.historical ? { ...m.historical } : null,
    interaction: {
      ...interaction,
      likePreview: Array.isArray(interaction.likePreview) ? interaction.likePreview : [],
      commentPreview
    }
  }
}

function enrichCommentView(c) {
  if (!c) return c
  const createdAtMs = _normalizeMs(c.createdAt)
  return {
    ...c,
    figure: normalizeFigureAsset(c.figure),
    createdAt: createdAtMs,
    createdAtText: _formatFull(createdAtMs),
    createdAtRelative: _formatRelative(createdAtMs),
    displayTime: _formatRelative(createdAtMs)
  }
}

module.exports = {
  MOCK_MOMENTS,
  adaptMockMoment,
  adaptMockComments,
  enrichMomentView,
  enrichCommentView,
  normalizeRemoteAssetUrl
}
