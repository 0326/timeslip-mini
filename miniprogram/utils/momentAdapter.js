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

// ========== URL 工具 ==========
function normalizeAssetUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const value = url.trim()
  if (!value) return ''
  if (/^(wxfile|http:\/\/tmp|https?:\/\/tmp|https?:\/\/127\.0\.0\.1|https?:\/\/localhost|\/tmp\/|tmp\/)/i.test(value)) {
    return ''
  }
  if (/^https?:\/\//i.test(value) || /^cloud:\/\//i.test(value)) return value
  if (value.startsWith('/api/asset/')) return `https://timeslip.work${value}`
  if (value.startsWith('/')) return value
  return ''
}

function normalizeRemoteAssetUrl(url) {
  return normalizeAssetUrl(url)
}

function normalizeImageList(images) {
  if (!Array.isArray(images)) return []
  return images.map(normalizeAssetUrl).filter(Boolean)
}

function normalizeFigureAsset(figure) {
  const f = figure || {}
  // 优先取 mini_avatar_url（小头像），然后是 avatar_url
  const avatarRaw = f.mini_avatar_url || f.miniAvatarUrl || f.avatar_url || f.avatarUrl || f.avatar || f.portrait || ''
  const avatar = normalizeAssetUrl(avatarRaw)
  return {
    ...f,
    avatar,
    avatarUrl: avatar,
    miniAvatarUrl: avatar,
    mini_avatar_url: avatarRaw,
    avatar_url: f.avatar_url || avatarRaw
  }
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
    avatar: normalizeAssetUrl(c.mini_avatar_url || c.miniAvatarUrl || c.avatar_url || c.avatarUrl || c.avatar),
    dynasty: c.dynasty || '',
    content: c.content || '',
    replyTo: c.replyTo || '',
    replyName: c.replyName || ''
  }))
}

function buildFigureView(row) {
  // 优先使用 mini_avatar_url 小头像
  const avatarRaw = row.mini_avatar_url || row.miniAvatarUrl || row.avatar_url || row.avatarUrl || row.avatar || row.figureAvatar || row.portrait || ''
  const avatar = normalizeAssetUrl(avatarRaw)
  return {
    id: row.figureId || row._openid || row.id || '',
    name: row.figureName || row.name || '匿名古人',
    title: row.figureTitle || row.title || row.identity || '',
    avatar,
    avatarUrl: avatar,
    miniAvatarUrl: avatar,
    mini_avatar_url: avatarRaw,
    avatar_url: row.avatar_url || avatarRaw,
    dynasty: row.dynasty || row.dynastyKey || ''
  }
}

function buildHistoricalView(row) {
  if (!row.historicalEvent && !row.historicalDate && !row.historical) return null
  const h = row.historical || {}
  return {
    event: row.historicalEvent || h.event || '',
    date: row.historicalDate || h.date || '',
    articleId: row.historicalArticleId || h.articleId || '',
    chapterId: row.historicalChapterId || h.chapterId || ''
  }
}

function enrichMomentView(m) {
  if (!m) return m
  const createdAtMs = _normalizeMs(m.createdAt)
  const content = String(m.content || '')
  const images = normalizeImageList(m.images)
  const figure = buildFigureView(m.figure || m)
  const interaction = m.interaction || {}
  const commentPreview = Array.isArray(interaction.commentPreview)
    ? interaction.commentPreview.map(c => ({
        ...c,
        avatar: normalizeAssetUrl(c.mini_avatar_url || c.miniAvatarUrl || c.avatar_url || c.avatarUrl || c.avatar)
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
    historical: buildHistoricalView(m),
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
  enrichMomentView,
  enrichCommentView,
  normalizeRemoteAssetUrl,
  normalizeAssetUrl
}
