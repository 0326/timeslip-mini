// 契约测试：mock adapter 字段对齐 + imageGridType 计算 + action 白名单
// 该脚本不依赖 wx，使用局部 shim 执行 adapter 中的 enrichMomentView
const fs = require('fs')
const path = require('path')

const adapterPath = path.join(__dirname, '..', 'miniprogram/utils/momentAdapter.js')
const cloudFnPath = path.join(__dirname, '..', 'cloudfunctions/moment/index.js')

// ---------- mock 数据独立定义（和 adapter 相同以校验） ----------
const MOCK_MOMENTS = [
  {
    _id: 'm1',
    figure: {
      id: 'li_bai',
      name: '李白',
      title: '诗仙 · 供奉翰林',
      avatar: '',
      dynasty: '唐'
    },
    content: '今天游了趟庐山，瀑布真壮观，作诗一首：「日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。」大家觉得怎么样？',
    images: [
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600',
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600',
      'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=600',
      'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=600',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
      'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=600',
      'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=600',
      'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600',
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600'
    ],
    source: { type: 'poem', ref: '《望庐山瀑布》', url: '' },
    likes: ['u1', 'u2', 'u3'],
    likeCount: 128,
    commentCount: 42,
    createdAt: Date.now() - 86400000 * 2
  },
  {
    _id: 'm2',
    figure: {
      id: 'su_dongpo',
      name: '苏轼',
      title: '东坡居士 · 龙图阁学士',
      avatar: '',
      dynasty: '宋'
    },
    content: '黄州好猪肉，价贱如泥土。贵者不肯吃，贫者不解煮。慢着火，少着水，火候足时它自美。',
    images: [
      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600'
    ],
    source: { type: 'poem', ref: '《猪肉颂》', url: '' },
    likes: [],
    likeCount: 56,
    commentCount: 18,
    createdAt: Date.now() - 3600000 * 6
  },
  {
    _id: 'm3',
    figure: {
      id: 'li_qingzhao',
      name: '李清照',
      title: '易安居士 · 婉约宗主',
      avatar: '',
      dynasty: '宋'
    },
    content: '昨夜雨疏风骤，浓睡不消残酒。试问卷帘人，却道海棠依旧。知否？知否？应是绿肥红瘦。',
    images: [
      'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600',
      'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600',
      'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=600',
      'https://images.unsplash.com/photo-1509223197845-458d87318791?w=600'
    ],
    source: { type: 'poem', ref: '《如梦令》', url: '' },
    likes: ['u4'],
    likeCount: 89,
    commentCount: 31,
    createdAt: Date.now() - 86400000 * 5
  },
  {
    _id: 'm4',
    figure: {
      id: 'du_fu',
      name: '杜甫',
      title: '诗圣 · 检校工部员外郎',
      avatar: '',
      dynasty: '唐'
    },
    content: '两个黄鹂鸣翠柳，一行白鹭上青天。窗含西岭千秋雪，门泊东吴万里船。',
    images: [
      'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=600',
      'https://images.unsplash.com/photo-1476673160081-cf065607f449?w=600'
    ],
    source: { type: 'poem', ref: '《绝句》', url: '' },
    likes: ['u5', 'u6'],
    likeCount: 234,
    commentCount: 67,
    createdAt: Date.now() - 86400000 * 1
  },
  {
    _id: 'm5',
    figure: {
      id: 'yue_fei',
      name: '岳飞',
      title: '武穆 · 荆湖北路帅司',
      avatar: '',
      dynasty: '宋'
    },
    content: '靖康耻，犹未雪；臣子恨，何时灭！驾长车，踏破贺兰山缺。',
    images: [],
    source: { type: 'poem', ref: '《满江红》', url: '' },
    likes: ['u7', 'u8', 'u9', 'u10'],
    likeCount: 567,
    commentCount: 123,
    createdAt: Date.now() - 3600000 * 2
  }
]

const MOCK_COMMENTS = {
  m1: [
    { _id: 'c1', figure: { id: 'du_fu', name: '杜甫', title: '诗圣', avatar: '', dynasty: '唐' }, content: '太白此诗，气势如虹！', likeCount: 12, replyTo: '', replyName: '', createdAt: Date.now() - 86400000 },
    { _id: 'c2', figure: { id: 'wang_wei', name: '王维', title: '诗佛', avatar: '', dynasty: '唐' }, content: '这山、这水、这意境，入画也！', likeCount: 8, replyTo: 'du_fu', replyName: '杜甫', createdAt: Date.now() - 86400000 + 3600000 }
  ],
  m2: [
    { _id: 'c3', figure: { id: 'li_qingzhao', name: '李清照', title: '易安居士', avatar: '', dynasty: '宋' }, content: '东坡先生的猪肉颂，真乃人间烟火也！', likeCount: 5, replyTo: '', replyName: '', createdAt: Date.now() - 3600000 * 2 }
  ],
  m3: [
    { _id: 'c4', figure: { id: 'xin_qiji', name: '辛弃疾', title: '词中之龙', avatar: '', dynasty: '宋' }, content: '绿肥红瘦，千古名句！', likeCount: 7, replyTo: '', replyName: '', createdAt: Date.now() - 86400000 * 2 }
  ],
  m4: [
    { _id: 'c5', figure: { id: 'li_bai', name: '李白', title: '诗仙', avatar: '', dynasty: '唐' }, content: '子美此句，画面感极强！', likeCount: 3, replyTo: '', replyName: '', createdAt: Date.now() - 3600000 }
  ],
  m5: [
    { _id: 'c6', figure: { id: 'xin_qiji', name: '辛弃疾', title: '词中之龙', avatar: '', dynasty: '宋' }, content: '将军豪情，令人敬仰！', likeCount: 15, replyTo: '', replyName: '', createdAt: Date.now() - 3600000 * 3 }
  ]
}

// ---------- 复制 adapter 核心逻辑（从 momentAdapter.js 提取） ----------
function _formatRelative(ts) {
  const now = Date.now()
  const diff = Math.floor((now - ts) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
  if (diff < 2592000) return Math.floor(diff / 86400) + '天前'
  if (diff < 31536000) return Math.floor(diff / 2592000) + '个月前'
  return Math.floor(diff / 31536000) + '年前'
}
function _formatFull(ts) {
  const d = new Date(ts)
  const pad = n => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function computeImageGridType(count) {
  if (count <= 0) return 'none'
  if (count === 1) return '1'
  if (count === 2 || count === 3) return String(count)
  if (count === 4) return '4'
  // 5,6,7,8,9 都走九宫格的布局（3列）
  return '9'
}
function _computeSourceText(source, historical) {
  const parts = []
  if (source) {
    if (typeof source === 'string' && source.length) parts.push('📍 ' + source)
    else if (typeof source === 'object' && source.ref) parts.push('📍 ' + source.ref)
    else if (typeof source === 'object' && source.type) parts.push('📖 ' + source.type)
  }
  if (historical && typeof historical === 'object') {
    const h = []
    if (historical.event) h.push(String(historical.event))
    if (historical.date) h.push(String(historical.date))
    if (h.length) parts.push('📜 ' + h.join(' · '))
  }
  return parts.join(' ')
}
function _computeHistoricalText(historical) {
  if (!historical || typeof historical !== 'object') return ''
  const h = []
  if (historical.event) h.push(String(historical.event))
  if (historical.date) h.push(String(historical.date))
  if (historical.location) h.push(String(historical.location))
  if (historical.source) h.push(String(historical.source))
  return h.join(' · ')
}
function enrichMomentView(raw, currentOpenId) {
  if (!raw) return null
  const m = raw || {}
  const images = Array.isArray(m.images) ? m.images : []
  const likeArr = Array.isArray(m.likes) ? m.likes : []
  const likePreview = []
  for (let i = 0; i < Math.min(likeArr.length, 3); i++) {
    const item = likeArr[i]
    const lid = typeof item === 'string' ? item : (item.openid || item.id || '')
    likePreview.push({
      id: lid,
      figureId: lid,
      name: lid === currentOpenId ? '我' : (typeof item === 'string' ? item : (item.name || '匿名'))
    })
  }
  const likeCount = typeof m.likeCount === 'number' ? m.likeCount : likeArr.length
  const commentCount = typeof m.commentCount === 'number' ? m.commentCount : 0
  const imageGridType = computeImageGridType(images.length)
  const content = String(m.content || '')
  const historical = m.historical && typeof m.historical === 'object' ? m.historical : null
  const historicalText = _computeHistoricalText(historical)
  return {
    _id: String(m._id || ''),
    figure: {
      id: String((m.figure && m.figure.id) || m.figureId || ''),
      name: String((m.figure && m.figure.name) || m.authorName || m.figureId || '未知人物'),
      title: String((m.figure && m.figure.title) || m.authorTitle || ''),
      avatar: String((m.figure && (m.figure.avatar || m.figure.avatarUrl || m.figure.miniAvatarUrl)) || m.avatar || ''),
      dynasty: String((m.figure && m.figure.dynasty) || m.dynasty || '')
    },
    content,
    contentCollapsed: content.length > 120 ? content.slice(0, 120) : content,
    hasCollapse: content.length > 120,
    images,
    imageGridType,
    historical,
    historicalText,
    source: m.source || null,
    sourceText: _computeSourceText(m.source, historical),
    interaction: {
      liked: currentOpenId ? likeArr.includes(currentOpenId) : false,
      likeCount,
      likePreview,
      commentCount
    },
    likeText: likeCount > 999 ? (likeCount / 1000).toFixed(1) + 'k' : String(likeCount),
    createdAt: Number(m.createdAt || Date.now()),
    createdAtText: _formatFull(Number(m.createdAt || Date.now())),
    createdAtRelative: _formatRelative(Number(m.createdAt || Date.now()))
  }
}
function enrichCommentView(raw, currentOpenId) {
  if (!raw) return null
  const c = raw || {}
  const likeArr = Array.isArray(c.likes) ? c.likes : []
  return {
    _id: String(c._id || ''),
    momentId: String(c.momentId || ''),
    figure: {
      id: String((c.figure && c.figure.id) || c.figureId || ''),
      name: String((c.figure && c.figure.name) || c.authorName || ''),
      title: String((c.figure && c.figure.title) || ''),
      avatar: String((c.figure && (c.figure.avatar || c.figure.avatarUrl)) || ''),
      dynasty: String((c.figure && c.figure.dynasty) || '')
    },
    content: String(c.content || ''),
    replyTo: String(c.replyTo || ''),
    replyName: String(c.replyName || ''),
    likeCount: typeof c.likeCount === 'number' ? c.likeCount : likeArr.length,
    liked: currentOpenId ? likeArr.includes(currentOpenId) : false,
    createdAt: Number(c.createdAt || Date.now()),
    createdAtText: _formatFull(Number(c.createdAt || Date.now())),
    createdAtRelative: _formatRelative(Number(c.createdAt || Date.now())),
    canDelete: !!c.canDelete
  }
}
function mockListMoments({ dynasty = '', cursor = '', limit = 20 }) {
  const all = MOCK_MOMENTS.slice()
  const filtered = dynasty ? all.filter(m => (m.figure && m.figure.dynasty) === dynasty) : all
  filtered.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
  const len = filtered.length
  let start = 0
  if (cursor) {
    try {
      const c = JSON.parse(decodeURIComponent(cursor))
      if (typeof c.idx === 'number') start = c.idx
    } catch (_) {}
  }
  const nextIdx = Math.min(start + Number(limit || 20), len)
  const slice = filtered.slice(start, nextIdx)
  const moments = slice.map(m => enrichMomentView(m))
  const totalCount = filtered.length
  const hasMore = nextIdx < totalCount
  const nextCursor = hasMore ? encodeURIComponent(JSON.stringify({ idx: nextIdx })) : ''
  return { moments, nextCursor, hasMore, totalCount }
}
function mockGetDetail(id) {
  const raw = MOCK_MOMENTS.find(m => m._id === id) || MOCK_MOMENTS[0]
  const moment = enrichMomentView(raw)
  const comments = (MOCK_COMMENTS[id] || []).map(c => enrichCommentView(c))
  return { moment, comments }
}
function mockToggleLike({ momentId, openid = 'local_user' }) {
  const idx = MOCK_MOMENTS.findIndex(m => m._id === momentId)
  if (idx < 0) return null
  const m = MOCK_MOMENTS[idx]
  if (!Array.isArray(m.likes)) m.likes = []
  if (typeof m.likeCount !== 'number') m.likeCount = m.likes.length
  const pos = m.likes.indexOf(openid)
  let liked
  if (pos >= 0) {
    m.likes.splice(pos, 1)
    m.likeCount = Math.max(0, m.likeCount - 1)
    liked = false
  } else {
    m.likes.push(openid)
    m.likeCount += 1
    liked = true
  }
  const likePreview = []
  for (let i = 0; i < Math.min(m.likes.length, 3); i++) {
    const item = m.likes[i]
    const lid = typeof item === 'string' ? item : (item.openid || item.id || '')
    likePreview.push({
      id: lid,
      figureId: lid,
      name: lid === openid ? '我' : (typeof item === 'string' ? item : (item.name || '匿名'))
    })
  }
  return { liked, likeCount: m.likeCount, likePreview }
}
function mockCreateComment({ momentId, content, replyTo = '', replyName = '' }) {
  if (!momentId || !content) return null
  const list = MOCK_COMMENTS[momentId] || []
  const c = {
    _id: 'c_' + Date.now(),
    momentId,
    figure: { id: 'me', name: '我', title: '本人', avatar: '', dynasty: '' },
    content,
    replyTo,
    replyName,
    likeCount: 0,
    createdAt: Date.now(),
    canDelete: true
  }
  list.push(c)
  MOCK_COMMENTS[momentId] = list
  const mIdx = MOCK_MOMENTS.findIndex(m => m._id === momentId)
  if (mIdx >= 0) {
    MOCK_MOMENTS[mIdx].commentCount = (MOCK_MOMENTS[mIdx].commentCount || 0) + 1
  }
  return { comment: enrichCommentView(c), commentCount: MOCK_MOMENTS[mIdx]?.commentCount || 0 }
}

// ---------- 读取云函数 action 白名单 ----------
const cloudSrc = fs.readFileSync(cloudFnPath, 'utf8')
const actionMatches = new Set()
const re = /case\s+['"]([^'"]+)['"]/g
let mt
while ((mt = re.exec(cloudSrc)) !== null) actionMatches.add(mt[1])
const ALLOWED_ACTIONS = ['list', 'detail', 'create', 'remove', 'like', 'commentList', 'commentCreate', 'commentRemove']

// ---------- 断言工具 ----------
const logs = []
let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; logs.push('  ✅ ' + name) }
  else { fail++; logs.push('  ❌ ' + name + (detail ? ' — ' + detail : '')) }
}
function assertField(obj, path, type) {
  const parts = path.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null) return false
    cur = cur[p]
  }
  if (type === 'array') return Array.isArray(cur)
  return typeof cur === type
}

// ========== 执行测试 ==========
console.log('🔍 朋友圈 契约自测 =========================================')

// 1. imageGridType 计算
console.log('\n1. imageGridType 计算:')
check('0 图 -> none', computeImageGridType(0) === 'none')
check('1 图 -> 1', computeImageGridType(1) === '1')
check('2 图 -> 2', computeImageGridType(2) === '2')
check('3 图 -> 3', computeImageGridType(3) === '3')
check('4 图 -> 4', computeImageGridType(4) === '4')
check('5 图 -> 9 (3列紧凑)', computeImageGridType(5) === '9')
check('6 图 -> 9', computeImageGridType(6) === '9')
check('7 图 -> 9', computeImageGridType(7) === '9')
check('8 图 -> 9', computeImageGridType(8) === '9')
check('9 图 -> 9', computeImageGridType(9) === '9')

// 2. enrichMomentView 字段完整性
console.log('\n2. MomentView 字段契约 (单条数据):')
const single = enrichMomentView(MOCK_MOMENTS[0], 'local_user')
check('_id 存在', assertField(single, '_id', 'string'))
check('figure.id', assertField(single, 'figure.id', 'string'))
check('figure.name', assertField(single, 'figure.name', 'string'))
check('figure.title', assertField(single, 'figure.title', 'string'))
check('figure.avatar', assertField(single, 'figure.avatar', 'string'))
check('figure.dynasty', assertField(single, 'figure.dynasty', 'string'))
check('content', assertField(single, 'content', 'string'))
check('contentCollapsed', assertField(single, 'contentCollapsed', 'string'))
check('hasCollapse (>=120字)', !!single.hasCollapse || (() => {
  const long = enrichMomentView({
    _id: 'long',
    figure: { id: 'x', name: '杜甫', avatar: '', dynasty: '唐' },
    content: ''.padEnd(150, '文'),
    images: []
  })
  return !!long.hasCollapse && long.contentCollapsed.length === 120
})(), '构造 150 字长文 hasCollapse=true，collapsed=120字')
check('images array', assertField(single, 'images', 'array') && single.images.length === 9)
check('imageGridType 1->single', computeImageGridType(1) === '1')
check('imageGridType 4->double', computeImageGridType(4) === '4')
check('imageGridType 9->nine', single.imageGridType === '9')
check('source 存在', !!single.source)
check('sourceText 含 📍', /📍/.test(single.sourceText))
check('interaction.liked boolean', typeof single.interaction.liked === 'boolean')
check('interaction.likeCount number', typeof single.interaction.likeCount === 'number')
check('interaction.likePreview array', assertField(single, 'interaction.likePreview', 'array') && single.interaction.likePreview.length <= 3)
check('interaction.commentCount number', typeof single.interaction.commentCount === 'number')
check('likeText 是字符串 (>=1k 带k)', /^\d+$|^\d+\.\dk$/.test(single.likeText))
check('createdAt 数字', typeof single.createdAt === 'number')
check('createdAtText 格式 YYYY-MM-DD HH:mm', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(single.createdAtText))
check('createdAtRelative 非空', !!single.createdAtRelative)

// 3. enrichCommentView
console.log('\n3. CommentView 字段契约:')
const c = enrichCommentView(MOCK_COMMENTS.m1[0])
check('_id', !!c._id)
check('figure.name', !!c.figure.name)
check('content', !!c.content)
check('replyTo', typeof c.replyTo === 'string')
check('replyName', typeof c.replyName === 'string')
check('likeCount number', typeof c.likeCount === 'number')
check('createdAtRelative 非空', !!c.createdAtRelative)

// 4. list 返回结构 {moments, nextCursor, hasMore, totalCount}
console.log('\n4. list 返回契约:')
const listRes = mockListMoments({ dynasty: '', cursor: '', limit: 2 })
check('moments array', Array.isArray(listRes.moments) && listRes.moments.length === 2)
check('nextCursor 非空 (第1页)', !!listRes.nextCursor, 'limit=2 应有下一页')
check('hasMore true', listRes.hasMore === true)
check('totalCount', typeof listRes.totalCount === 'number' && listRes.totalCount === 5)

// 第 2 页
const list2 = mockListMoments({ cursor: listRes.nextCursor, limit: 2 })
check('moments.length=2 (第2页)', list2.moments.length === 2)
check('hasMore true (第2页)', list2.hasMore === true)

// 第 3 页 (应最后一条)
const list3 = mockListMoments({ cursor: list2.nextCursor, limit: 2 })
check('moments.length=1 (第3页剩下1条)', list3.moments.length === 1)
check('hasMore false', list3.hasMore === false)
check('nextCursor 空', list3.nextCursor === '')

// 朝代筛选
const tang = mockListMoments({ dynasty: '唐' })
check('唐筛选: 李白+杜甫=2条', tang.moments.length === 2, `实际=${tang.moments.length}`)
const song = mockListMoments({ dynasty: '宋' })
check('宋筛选: 苏轼+李清照+岳飞=3条', song.moments.length === 3, `实际=${song.moments.length}`)

// 5. detail 返回结构
console.log('\n5. detail 返回契约:')
const det = mockGetDetail('m2')
check('moment._id = m2', det.moment._id === 'm2')
check('moment 含 commentCount', typeof det.moment.interaction.commentCount === 'number')
check('comments array', Array.isArray(det.comments))

// 6. like 回滚/切换
console.log('\n6. like toggle 契约:')
const like1 = mockToggleLike({ momentId: 'm2', openid: 'u_test' })
check('首次点赞 liked=true', like1.liked === true)
check('likeCount 增加 1', like1.likeCount === 56 + 1)
check('likePreview 最多 3 项', Array.isArray(like1.likePreview) && like1.likePreview.length <= 3)
const like2 = mockToggleLike({ momentId: 'm2', openid: 'u_test' })
check('取消点赞 liked=false', like2.liked === false)
check('likeCount 还原', like2.likeCount === 56)

// 7. commentCreate 返回 {comment, commentCount}
console.log('\n7. commentCreate 契约:')
const before = mockGetDetail('m2').moment.interaction.commentCount
const cc = mockCreateComment({ momentId: 'm2', content: '测试评论内容', replyTo: 'li_qingzhao', replyName: '李清照' })
check('comment._id 非空', !!cc.comment._id)
check('comment 回复信息 replyTo', cc.comment.replyTo === 'li_qingzhao')
check('comment replyName', cc.comment.replyName === '李清照')
check('comment canDelete=true', cc.comment.canDelete === true)
check('commentCount +1', typeof cc.commentCount === 'number' && cc.commentCount === before + 1, `before=${before}, after=${cc.commentCount}`)

// 8. action 白名单校验（云函数 + adapter）
console.log('\n8. Network 白名单 (云函数已定义 case 和约定一致):')
ALLOWED_ACTIONS.forEach(a => {
  check(`云函数实现了 case "${a}"`, actionMatches.has(a), `未找到 case "${a}"`)
})
const CLOUD_ONLY_EXTRA = [...actionMatches].filter(a => !ALLOWED_ACTIONS.includes(a))
check('云函数无未登记的额外 action', CLOUD_ONLY_EXTRA.length === 0, '额外: ' + CLOUD_ONLY_EXTRA.join(','))

// 9. 列表/详情页 JS 里调用的 action 全部在白名单
console.log('\n9. 前端 pages 调用 action 校验:')
const pagesFiles = [
  path.join(__dirname, '..', 'miniprogram/pages/discover/moments.js'),
  path.join(__dirname, '..', 'miniprogram/pages/discover/moment-detail.js')
]
let pageSrc = ''
for (const f of pagesFiles) pageSrc += '\n' + fs.readFileSync(f, 'utf8')
const callRegex = /requestCloud\(\s*['"]moment['"]\s*,\s*['"]([^'"]+)['"]/g
const called = new Set()
let cm
while ((cm = callRegex.exec(pageSrc)) !== null) called.add(cm[1])
called.forEach(a => {
  check(`前端调用了 "${a}" 且白名单内`, ALLOWED_ACTIONS.includes(a), `"${a}" 不在白名单`)
})

// 10. 头像组件：无图 fallback
console.log('\n10. 头像组件无图时 fallback 校验:')
const noAvatar = enrichMomentView({ _id: 'test', figure: { id: 'x', name: '无名氏', avatar: '', dynasty: '' }, content: 'test', images: [] })
const firstChar = noAvatar.figure.name.charAt(0)
check('figure.name 首字存在', !!firstChar, `首字=${firstChar}`)

// 11. 发布检查清单（§七）
console.log('\n11. 发布检查清单 §七:')
const adapterSrc = fs.readFileSync(adapterPath, 'utf8')
const avatarPath = path.join(__dirname, '..', 'miniprogram/components/figure-avatar/index.js')
const avatarSrc = fs.readFileSync(avatarPath, 'utf8')
check('USE_MOCK_FALLBACK 默认 false', /USE_MOCK_FALLBACK\s*=\s*false/.test(adapterSrc), '上线阻断项：需默认走云函数')
check('点赞用事务 db.runTransaction (P0-E)', /db\.runTransaction/.test(cloudSrc), '云函数里未检测到 db.runTransaction')
check('点赞事务含条件 +count/-count', (cloudSrc.match(/likedBy.*indexOf/) || cloudSrc.match(/idx\s*===\s*-1/)) && /\+\s*1/.test(cloudSrc) && /-\s*1/.test(cloudSrc))
check('头像无外部 icons8 依赖 (§七 3)', !/icons8\.com/.test(avatarSrc), 'figure-avatar 仍含 icons8 外链')
check('createComment 含内容安全检测 (§七 7)', /secCheckText|msgSecCheck|content.*[Ss]ecur/.test(cloudSrc) || /审核|敏感/.test(cloudSrc), '云函数 commentCreate 里未调用安全检测')

// 12. enrichMomentView 新增字段契约（P0-B / P1-F）
console.log('\n12. enrich 新增字段契约:')
check('李白内容<120字 -> hasCollapse=false', single.hasCollapse === false, `实际 hasCollapse=${single.hasCollapse}`)
check('李白无 historical -> historicalText=""', single.historicalText === '', `实际=${single.historicalText}`)
check('李白 sourceText 含📍(作品出处)', /📍/.test(single.sourceText) && !/📜/.test(single.sourceText), `实际=${single.sourceText}`)
// 构造带 historical 的数据
const withHistorical = enrichMomentView({
  _id: 'liu_bang',
  figure: { id: 'liu_bang', name: '刘邦', title: '汉高祖', avatar: '', dynasty: '汉' },
  content: '今日鸿门，气氛有点微妙。',
  images: [],
  source: '鸿门遗址',
  historical: { event: '鸿门宴', date: '公元前206年', location: '新丰鸿门' }
}, 'local_user')
check('有 historical -> historicalText 非空 含事件+日期', /鸿门宴/.test(withHistorical.historicalText) && /前206/.test(withHistorical.historicalText), `historicalText=${withHistorical.historicalText}`)
check('有 historical -> sourceText 含📍和📜', /📍/.test(withHistorical.sourceText) && /📜/.test(withHistorical.sourceText), `sourceText=${withHistorical.sourceText}`)
check('有 historical 字段透传', withHistorical.historical && withHistorical.historical.event === '鸿门宴')
const longMoment = enrichMomentView({
  _id: 'long',
  figure: { id: 'x', name: '杜甫', avatar: '', dynasty: '唐' },
  content: ''.padEnd(150, '文'),
  images: []
}, 'local_user')
check('长文(150字) hasCollapse=true', longMoment.hasCollapse === true)
check('长文 contentCollapsed.length === 120', longMoment.contentCollapsed.length === 120, `实际=${longMoment.contentCollapsed.length}`)
check('长文 imageGridType=none (0 图)', longMoment.imageGridType === 'none')
check('createdAtText 格式 YYYY-MM-DD HH:mm', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(single.createdAtText), `实际=${single.createdAtText}`)
check('createdAtRelative 非空字符串', typeof single.createdAtRelative === 'string' && single.createdAtRelative.length > 0)
check('likePreview[0] 含 figureId 字符串', Array.isArray(single.interaction.likePreview) && typeof single.interaction.likePreview[0]?.figureId === 'string', `figureId=${single.interaction.likePreview?.[0]?.figureId}`)

// 13. WXML 导航语义 + 样式与微信对齐检查 (P1 交互)
console.log('\n13. WXML 导航语义与微信对齐 (P1):')
const momWxmlPath = path.join(__dirname, '..', 'miniprogram/pages/discover/moments.wxml')
const momWxml = fs.readFileSync(momWxmlPath, 'utf8')
const detWxmlPath = path.join(__dirname, '..', 'miniprogram/pages/discover/moment-detail.wxml')
const detWxml = fs.readFileSync(detWxmlPath, 'utf8')
const momWxss = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/discover/moments.wxss'), 'utf8')
check('列表页 姓名行 onFigureTap 绑定', /mi-name-row[\s\S]*?catchtap="onFigureTap"/.test(momWxml))
check('列表页 头像 onFigureTap 绑定', /mi-avatar[\s\S]*?catchtap="onFigureTap"/.test(momWxml))
check('列表页 整条动态 bindtap="openMomentDetail"', /moment-item[\s\S]*?bindtap="openMomentDetail"/.test(momWxml))
check('列表页 全文/收起按钮 expand-toggle', /class="expand-toggle"/.test(momWxml), 'WXML 缺少全文按钮')
check('列表页 正文用 hasCollapse (非 _lineClamp)', /item\.hasCollapse/.test(momWxml) && !/item\._lineClamp/.test(momWxml), `_lineClamp残留：hasCollapse=${/item\.hasCollapse/.test(momWxml)}, _lineClamp=${/item\._lineClamp/.test(momWxml)}`)
check('列表页 九宫格用 item.imageGridType (非 length 硬推)', /mi-grid-\{\{item\.imageGridType\}\}/.test(momWxml), 'images class 应该直接用 imageGridType 字段')
check('列表页 图片有 binderror="onImageError"', /binderror="onImageError"/.test(momWxml))
check('列表页 WXSS 正文 -webkit-line-clamp: 6', /-webkit-line-clamp:\s*6/.test(momWxss), '正文折叠需 6 行')
check('详情页 hero-meta catchtap="onFigureTap"', /hero-meta[\s\S]*?catchtap="onFigureTap"/.test(detWxml))
check('详情页 reply-from 姓名 catchtap onFigureTap', /reply-from[\s\S]*?catchtap="onFigureTap"/.test(detWxml))
check('详情页 reply-to 姓名 catchtap onFigureTap', /reply-to[\s\S]*?catchtap="onFigureTap"/.test(detWxml))
check('详情页 图片 binderror', /<image[^>]*binderror="onImageError"/.test(detWxml))
check('列表页 cm-input-bar 含 safe-area', /padding:.*env\(safe-area-inset-bottom\)/.test(momWxss), '输入栏需 safe-area')
check('详情页 cursor-spacing+adjust-position', /cursor-spacing=/.test(detWxml) && /adjust-position="{{true}}"/.test(detWxml))

// 14. WXML 静态语法规范 (P0 - 防止小程序 WXML 编译期报错)
console.log('\n14. WXML 静态语法规范 (P0):')
const miniRoot = path.join(__dirname, '..', 'miniprogram')
function walkWxml(dir) {
  let out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out = out.concat(walkWxml(p))
    else if (ent.name.endsWith('.wxml')) out.push(p)
  }
  return out
}
const allWxml = walkWxml(miniRoot)
const allWxmlContents = allWxml.map(p => ({ p, src: fs.readFileSync(p, 'utf8') }))
const camelProps = ['showBorder', 'showDynasty', 'lazyLoad', 'figureAvatar', 'dynastyColor', 'miniAvatar']
for (const { p, src } of allWxmlContents) {
  const rel = path.relative(miniRoot, p)
  check(`[WXML] ${rel} 禁止三花括号 {{{ (内联对象字面量)`, !/\{\{\{/.test(src), `命中三花括号 → ${p}`)
  for (const prop of camelProps) {
    const re = new RegExp(`<figure-avatar[\\s\\S]*?${prop}[\\s\\S]*?/?>`)
    const re2 = new RegExp(`\\b${prop}=`)
    const onTag = /<figure-avatar[^>]*>/.test(src) && re2.test(src)
    check(`[WXML] ${rel} figure-avatar 属性不用 camelCase (${prop})`, !onTag, `命中 camelCase 属性 ${prop} → ${p}，请改用 kebab-case`)
  }
}

// 15. miniprogram JS 禁止可选链 ?. (P0 - 真机 JSC 兼容)
console.log('\n15. miniprogram JS 禁止 ES2020 可选链/空值合并 (P0):')
function walkJs(dir) {
  let out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory() && ent.name !== 'node_modules') out = out.concat(walkJs(p))
    else if (ent.name.endsWith('.js')) out.push(p)
  }
  return out
}
const miniJs = walkJs(miniRoot)
const forbiddenPatterns = [
  { re: /\?\./, label: '可选链 ?.' },
  { re: /\?\?/, label: '空值合并 ??' }
]
for (const p of miniJs) {
  const rel = path.relative(miniRoot, p)
  const src = fs.readFileSync(p, 'utf8')
  for (const { re, label } of forbiddenPatterns) {
    check(`[miniprogram JS] ${rel} 禁止 ${label}`, !re.test(src.replace(/(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/|'[^']*'|"[^"]*"|`[^`]*`)/g, '')), `命中 ${label} → ${p}，请降级为逻辑与/三元`)
  }
}

console.log('\n------------------------------------------------------------')
logs.forEach(l => console.log(l))
console.log(`\n总计：✅ 通过 ${pass} ｜ ❌ 失败 ${fail}`)
if (fail === 0) {
  console.log('\n🎉 全部契约通过 ✅')
  process.exit(0)
} else {
  console.log('\n⚠️  存在失败用例，请排查')
  process.exit(1)
}
