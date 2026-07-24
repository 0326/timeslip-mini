function parseMarkdown(md = '') {
  if (!md) return []
  const lines = String(md).replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    let line = lines[i]

    if (!line.trim()) { i++; continue }

    if (/^#{1,6}\s+/.test(line)) {
      const m = line.match(/^(#{1,6})\s+(.*)$/)
      blocks.push({
        type: 'heading',
        level: m[1].length,
        inlines: parseInline(m[2].trim())
      })
      i++; continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push({
        type: 'quote',
        inlines: parseInline(quoteLines.join(' '))
      })
      continue
    }

    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push({ type: 'hr' }); i++; continue
    }

    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim()
      const codeLines = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      i++
      blocks.push({ type: 'code', lang, content: codeLines.join('\n') })
      continue
    }

    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items = []
      while (i < lines.length) {
        const reg = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/
        if (!reg.test(lines[i])) break
        const txt = lines[i].replace(reg, '')
        items.push({ inlines: parseInline(txt) })
        i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    if (/^\|.*\|$/.test(line)) {
      const rows = []
      let header = null
      if (i + 1 < lines.length && /^\|[\s:|\-]+\|\s*$/.test(lines[i + 1])) {
        header = line.split('|').slice(1, -1).map(c => c.trim())
        i += 2
      }
      while (i < lines.length && /^\|.*\|$/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()))
        i++
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }

    const paraLines = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}|>|```|\s*[-*+]\s+|\s*\d+\.\s+|\|)/.test(lines[i])) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push({
      type: 'paragraph',
      inlines: parseInline(paraLines.join(' '))
    })
  }
  return blocks
}

function parseInline(txt = '') {
  const tokens = []
  let remaining = String(txt)

  while (remaining) {
    let matched = false
    const patterns = [
      { re: /\*\*(.+?)\*\*/, bold: true },
      { re: /__(.+?)__/, bold: true },
      { re: /\*(.+?)\*/, italic: true },
      { re: /_(.+?)_/, italic: true },
      { re: /`(.+?)`/, code: true }
    ]

    let firstIdx = -1, firstPattern = null, firstMatch = null
    for (const p of patterns) {
      const m = remaining.match(p.re)
      if (m && (firstIdx === -1 || m.index < firstIdx)) {
        firstIdx = m.index
        firstPattern = p
        firstMatch = m
      }
    }

    if (firstIdx === -1) {
      tokens.push({ text: remaining })
      break
    }

    if (firstIdx > 0) {
      tokens.push({ text: remaining.slice(0, firstIdx) })
    }

    tokens.push({
      text: firstMatch[1],
      bold: !!firstPattern.bold,
      italic: !!firstPattern.italic,
      code: !!firstPattern.code
    })
    remaining = remaining.slice(firstIdx + firstMatch[0].length)
    matched = true
  }

  return tokens.length ? tokens : [{ text: txt }]
}

Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    content: { type: String, value: '' },
    ancient: { type: Boolean, value: false }
  },
  data: {
    blocks: []
  },
  observers: {
    'content': function (val) {
      try {
        const blocks = parseMarkdown(val)
        this.setData({ blocks })
      } catch (e) {
        this.setData({ blocks: [] })
      }
    }
  },
  methods: {
    parse(content) {
      return parseMarkdown(content)
    }
  }
})
