const DYNASTY_ORDER = ['xianqin', 'qin', 'han', 'sanguo', 'jin', 'tang', 'song', 'yuan', 'ming', 'qing']

const DYNASTY_MAP = {
  xianqin: { name: '先秦', era: '约前2070-前221', color: '#8B4513' },
  qin: { name: '秦', era: '前221-前207', color: '#2F2F2F' },
  han: { name: '汉', era: '前206-220', color: '#B22222' },
  sanguo: { name: '三国', era: '220-280', color: '#4682B4' },
  jin: { name: '晋', era: '265-420', color: '#6B8E23' },
  tang: { name: '唐', era: '618-907', color: '#DAA520' },
  song: { name: '宋', era: '960-1279', color: '#87CEEB' },
  yuan: { name: '元', era: '1271-1368', color: '#696969' },
  ming: { name: '明', era: '1368-1644', color: '#CD853F' },
  qing: { name: '清', era: '1644-1912', color: '#483D8B' }
}

const CELESTIAL_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const TERRESTRIAL_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

function pad(n) { return n < 10 ? '0' + n : '' + n }

function formatDate(ts, pattern = 'YYYY-MM-DD HH:mm') {
  if (!ts) return ''
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  if (isNaN(d.getTime())) return ''
  const map = {
    YYYY: d.getFullYear(),
    MM: pad(d.getMonth() + 1),
    DD: pad(d.getDate()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds())
  }
  return pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, m => map[m])
}

function formatRelative(ts) {
  if (!ts) return ''
  const now = Date.now()
  const target = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime()
  const diff = Math.floor((now - target) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
  if (diff < 2592000) return Math.floor(diff / 86400) + '天前'
  return formatDate(ts, 'MM-DD')
}

function formatChatTime(ts) {
  if (!ts) return ''
  const now = new Date()
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return formatDate(ts, 'HH:mm')
  const yesterday = new Date(now.getTime() - 86400000)
  if (d.toDateString() === yesterday.toDateString()) return '昨天 ' + formatDate(ts, 'HH:mm')
  const diffDay = Math.floor((now - d) / 86400000)
  if (diffDay < 7) return diffDay + '天前'
  return formatDate(ts, 'YY/MM/DD')
}

function getDynastyInfo(key) {
  return DYNASTY_MAP[key] || { name: key, era: '', color: '#888' }
}

function getDynastyOrder() {
  return DYNASTY_ORDER.slice()
}

function sortByDynasty(list, key = 'dynasty') {
  return list.slice().sort((a, b) => {
    const ai = DYNASTY_ORDER.indexOf(a[key])
    const bi = DYNASTY_ORDER.indexOf(b[key])
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
}

function gregorianToGanzhi(year) {
  const y = Number(year)
  if (!y) return ''
  const stemIdx = (y - 4) % 10
  const branchIdx = (y - 4) % 12
  return (
    CELESTIAL_STEMS[(stemIdx + 10) % 10] +
    TERRESTRIAL_BRANCHES[(branchIdx + 12) % 12]
  )
}

function generateCrossNo(openid = '') {
  const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  const suffix = openid.slice(-4).toUpperCase() || 'XXXX'
  return 'CY' + rand + suffix
}

module.exports = {
  formatDate,
  formatRelative,
  formatChatTime,
  getDynastyInfo,
  getDynastyOrder,
  sortByDynasty,
  gregorianToGanzhi,
  generateCrossNo,
  DYNASTY_ORDER,
  DYNASTY_MAP
}
