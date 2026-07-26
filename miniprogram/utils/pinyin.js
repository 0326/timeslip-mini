const PINYIN_RANGE_STARTS = [
  { letter: 'A', char: '阿' },
  { letter: 'B', char: '芭' },
  { letter: 'C', char: '嚓' },
  { letter: 'D', char: '搭' },
  { letter: 'E', char: '蛾' },
  { letter: 'F', char: '发' },
  { letter: 'G', char: '噶' },
  { letter: 'H', char: '哈' },
  { letter: 'J', char: '击' },
  { letter: 'K', char: '喀' },
  { letter: 'L', char: '垃' },
  { letter: 'M', char: '妈' },
  { letter: 'N', char: '拿' },
  { letter: 'O', char: '哦' },
  { letter: 'P', char: '啪' },
  { letter: 'Q', char: '期' },
  { letter: 'R', char: '然' },
  { letter: 'S', char: '撒' },
  { letter: 'T', char: '塌' },
  { letter: 'W', char: '挖' },
  { letter: 'X', char: '昔' },
  { letter: 'Y', char: '压' },
  { letter: 'Z', char: '匝' }
]

function isChineseChar(ch) {
  return /^[\u3400-\u9fff]$/.test(ch)
}

function getPinyinInitial(value) {
  const text = String(value || '').trim()
  if (!text) return '#'
  const ch = text[0]
  if (/^[A-Za-z]$/.test(ch)) return ch.toUpperCase()
  if (!isChineseChar(ch)) return '#'

  for (let i = PINYIN_RANGE_STARTS.length - 1; i >= 0; i -= 1) {
    if (ch.localeCompare(PINYIN_RANGE_STARTS[i].char, 'zh-Hans-CN') >= 0) {
      return PINYIN_RANGE_STARTS[i].letter
    }
  }
  return '#'
}

module.exports = { getPinyinInitial }
