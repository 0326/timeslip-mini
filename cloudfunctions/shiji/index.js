const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event
  const data = normalizeEventData(event)

  try {
    switch (action) {
      case 'figure-list':
      case 'figures':
        return await figureList(OPENID, data)
      case 'figure-detail':
      case 'figureDetail':
        return await figureDetail(OPENID, data)
      case 'book-list':
      case 'books':
        return await bookList(OPENID)
      case 'book-detail':
        return await bookDetail(data)
      case 'chapters':
      case 'chapter-list':
        return await chapterList(data)
      case 'chapter-content':
      case 'passages':
        return await chapterContent(data)
      case 'book-favorites':
        return await bookFavorites(OPENID)
      case 'book-favoriteToggle':
        return await bookFavToggle(OPENID, data)
      default:
        return fail('未知 action: ' + action)
    }
  } catch (e) {
    console.error('shiji err:', e)
    return fail(e.message || '服务异常')
  }
}

function normalizeEventData(event) {
  const { action, data, ...rest } = event || {}
  return data && typeof data === 'object' ? { ...rest, ...data } : rest
}

function ok(data) {
  return { code: 0, message: 'ok', data }
}

function fail(message, data = null) {
  return { code: -1, message, data }
}

function batch(list, size) {
  const result = []
  for (let i = 0; i < list.length; i += size) result.push(list.slice(i, i + size))
  return result
}

async function getAll(queryFactory, pageSize = 100, max = 2000) {
  const all = []
  for (let skip = 0; skip < max; skip += pageSize) {
    const res = await queryFactory()
      .skip(skip)
      .limit(pageSize)
      .get()
    const rows = res.data || []
    all.push(...rows)
    if (rows.length < pageSize) break
  }
  return all
}

function normalizeBook(b) {
  return {
    ...b,
    _id: b._id || b.id,
    id: b.id || b._id,
    title: b.name || b.title || '',
    desc: b.type ? `${b.type} · ${b.status === 'active' ? '已收录' : '整理中'}` : '',
    chapters: b.volume_count || b.chapters || 0
  }
}

function normalizeChapter(c, volume) {
  const volumeName = volume ? volume.name : ''
  return {
    ...c,
    _id: c._id || c.id,
    id: c.id || c._id,
    title: c.name || c.title || '',
    subtitle: c.subtitle || volumeName || '',
    progress: 0,
    read: false
  }
}

function normalizeFigure(f) {
  const life = formatLife(f)
  return {
    ...f,
    _id: f.id || f._id,
    figureId: f.id || f._id,
    figureName: f.name || '',
    name: f.name || '',
    title: f.identity || '',
    bio: f.bio_summary || '',
    birth: life.birth,
    death: life.death,
    avatar: normalizeAvatar(f.avatar_url),
    tags: f.keyword_tags || [],
    initial: (f.name || '#').slice(0, 1)
  }
}

function formatLife(f) {
  return {
    birth: formatYear(f.birth_year),
    death: formatYear(f.death_year)
  }
}

function formatYear(year) {
  if (year === null || year === undefined || year === '') return ''
  const n = Number(year)
  if (!Number.isFinite(n)) return String(year)
  if (n < 0) return `公元前${Math.abs(n)}年`
  return `${n}年`
}

function normalizeAvatar(url) {
  if (!url) return ''
  if (/^https?:\/\//.test(url) || /^cloud:\/\//.test(url)) return url
  if (url.startsWith('/api/asset/')) return `https://timeslip.work${url}`
  return ''
}

async function figureList(OPENID, data) {
  const { keyword = '', limit = 200 } = data
  let query = db.collection('figures')

  if (keyword) {
    query = query.where({ name: db.RegExp({ regexp: keyword, options: 'i' }) })
  }

  const res = await query
    .orderBy('star', 'desc')
    .orderBy('name', 'asc')
    .limit(Math.min(Number(limit) || 200, 200))
    .get()

  return ok((res.data || []).map(normalizeFigure))
}

async function figureDetail(OPENID, data) {
  const targetId = data.figureId || data.id
  if (!targetId) return fail('缺少 figureId')

  const res = await db.collection('figures').where({ id: targetId }).limit(1).get()
  if (!res.data || !res.data.length) return fail('人物不存在')

  const figure = normalizeFigure(res.data[0])
  const [relatedBooks, relatedPassages, relations] = await Promise.all([
    figureRelatedBooks(figure),
    figureRelatedPassages(targetId),
    figureRelations(targetId)
  ])

  return ok({
    figure: {
      ...figure,
      relatedBooks,
      relatedMoments: relatedPassages,
      relations,
      famousQuotes: relatedPassages.slice(0, 3).map(p => p.desc).filter(Boolean)
    }
  })
}

async function figureRelatedBooks(figure) {
  const ids = new Set()
  if (figure.src_book) ids.add(figure.src_book)

  try {
    const fp = await db.collection('figure_passages')
      .where({ figure_id: figure.id || figure._id })
      .orderBy('sort_order', 'asc')
      .limit(20)
      .get()
    ;(fp.data || []).forEach(item => {
      const bookId = String(item.passage_id || '').split('/')[0]
      if (bookId) ids.add(bookId)
    })
  } catch (_) {}

  if (!ids.size) return []
  const books = []
  for (const part of batch([...ids], 20)) {
    const res = await db.collection('books').where({ id: _.in(part) }).limit(part.length).get()
    books.push(...(res.data || []))
  }
  return books.map(b => ({
    id: b.id || b._id,
    title: b.name || b.title || b.id,
    chapters: b.chapters || b.volume_count || 0,
    chapter: `${b.chapters || b.volume_count || 0}卷`,
    dynasty: b.dynastyName || b.dynasty || '',
    author: b.author || ''
  }))
}

async function figureRelatedPassages(figureId) {
  try {
    const res = await db.collection('figure_passages')
      .where({ figure_id: figureId })
      .orderBy('sort_order', 'asc')
      .limit(10)
      .get()
    return (res.data || []).map(item => ({
      _id: item.id || item._id,
      title: item.event_name || '相关原文',
      desc: item.excerpt || '',
      figureName: item.role || '',
      time: item.event_year ? formatYear(item.event_year) : ''
    }))
  } catch (_) {
    return []
  }
}

async function figureRelations(figureId) {
  try {
    const res = await db.collection('figure_relations')
      .where(_.or([{ figure_a: figureId }, { figure_b: figureId }]))
      .limit(20)
      .get()
    const raw = res.data || []
    const targetIds = raw.map(item =>
      item.figure_a === figureId ? item.figure_b : item.figure_a
    ).filter(Boolean)
    const nameMap = {}
    if (targetIds.length) {
      for (const part of batch(targetIds, 20)) {
        const fr = await db.collection('figures').where({ id: _.in(part) }).limit(part.length).get()
        ;(fr.data || []).forEach(f => { nameMap[f.id || f._id] = f.name || '' })
      }
    }
    return raw.map(item => {
      const targetId = item.figure_a === figureId ? item.figure_b : item.figure_a
      return {
        id: item.id || item._id,
        targetId,
        name: nameMap[targetId] || '',
        targetName: nameMap[targetId] || '',
        type: item.relation_type,
        relation: item.relation_label || item.relation_type || '',
        label: item.relation_label,
        description: item.description || ''
      }
    })
  } catch (_) {
    return []
  }
}

async function bookList() {
  const res = await db.collection('books')
    .orderBy('sort_order', 'asc')
    .limit(50)
    .get()
  return ok((res.data || []).map(normalizeBook))
}

async function bookDetail(data) {
  const targetId = data.bookId || data.id || data._id
  if (!targetId) return fail('缺少 bookId')

  const res = await db.collection('books').where({ id: targetId }).limit(1).get()
  if (!res.data || !res.data.length) return fail('典籍不存在')
  return ok(normalizeBook(res.data[0]))
}

async function chapterList(data) {
  const bookId = data.bookId || data.id
  if (!bookId) return fail('缺少 bookId')

  const volumes = await getAll(
    () => db.collection('volumes').where({ book_id: bookId }).orderBy('sort_order', 'asc'),
    100,
    1000
  )
  if (!volumes.length) return ok({ chapters: [] })

  const volumeById = new Map(volumes.map(v => [v.id, v]))
  const chapters = []
  for (const ids of batch(volumes.map(v => v.id), 100)) {
    const res = await db.collection('chapters')
      .where({ volume_id: _.in(ids) })
      .limit(100)
      .get()
    chapters.push(...(res.data || []))
  }

  chapters.sort((a, b) => {
    const av = volumeById.get(a.volume_id)
    const bv = volumeById.get(b.volume_id)
    return ((av && av.sort_order) || 0) - ((bv && bv.sort_order) || 0) || (a.sort_order || 0) - (b.sort_order || 0)
  })

  return ok({ chapters: chapters.map(c => normalizeChapter(c, volumeById.get(c.volume_id))) })
}

async function chapterContent(data) {
  const chapterId = data.chapterId || data.id
  if (!chapterId) return fail('缺少 chapterId')

  const chapterRes = await db.collection('chapters').where({ id: chapterId }).limit(1).get()
  if (!chapterRes.data || !chapterRes.data.length) return fail('章节不存在')

  const passages = await getAll(
    () => db.collection('passages').where({ chapter_id: chapterId }).orderBy('order_idx', 'asc'),
    100,
    2000
  )

  return ok({
    chapter: normalizeChapter(chapterRes.data[0]),
    content: {
      original: passages.map(p => p.content).filter(Boolean).join('\n\n'),
      translation: passages.map(p => p.vernacular).filter(Boolean).join('\n\n'),
      notes: passages
        .filter(p => p.annotation || p.glosses)
        .slice(0, 20)
        .map(p => ({
          keyword: `第${p.order_idx || ''}段`,
          note: p.annotation || p.glosses
        }))
    }
  })
}

async function bookFavorites(OPENID) {
  const favRes = await db.collection('book_favorites').where({ _openid: OPENID }).limit(100).get()
  const favIds = new Set((favRes.data || []).map(x => x.bookId))
  if (!favIds.size) return ok([])

  const books = []
  for (const ids of batch([...favIds], 20)) {
    const res = await db.collection('books').where({ id: _.in(ids) }).limit(ids.length).get()
    books.push(...(res.data || []))
  }
  return ok(books.map(b => ({ ...normalizeBook(b), favorite: true })))
}

async function bookFavToggle(OPENID, data) {
  const { bookId } = data
  if (!bookId) return fail('缺少 bookId')

  const res = await db.collection('book_favorites').where({ _openid: OPENID, bookId }).limit(1).get()
  if (res.data.length) {
    await db.collection('book_favorites').doc(res.data[0]._id).remove()
    return ok({ favorite: false })
  }

  await db.collection('book_favorites').add({
    data: { bookId, createdAt: db.serverDate() }
  })
  return ok({ favorite: true })
}
