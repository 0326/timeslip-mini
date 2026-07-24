function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
      timer = null
    }, delay)
  }
}

function throttle(fn, delay = 300) {
  let last = 0
  let timer = null
  return function (...args) {
    const now = Date.now()
    if (now - last >= delay) {
      last = now
      fn.apply(this, args)
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now()
        timer = null
        fn.apply(this, args)
      }, delay - (now - last))
    }
  }
}

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(deepClone)
  const result = {}
  Object.keys(obj).forEach(k => { result[k] = deepClone(obj[k]) })
  return result
}

function pick(obj, keys) {
  const r = {}
  keys.forEach(k => { if (obj[k] !== undefined) r[k] = obj[k] })
  return r
}

function omit(obj, keys) {
  const r = Object.assign({}, obj)
  keys.forEach(k => { delete r[k] })
  return r
}

function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function safeGet(obj, path, defaultValue = undefined) {
  const parts = typeof path === 'string' ? path.split('.') : path
  let cur = obj
  for (let i = 0; i < parts.length; i++) {
    if (cur === null || cur === undefined) return defaultValue
    cur = cur[parts[i]]
  }
  return cur === undefined ? defaultValue : cur
}

function chunk(arr, size) {
  const result = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

module.exports = {
  debounce,
  throttle,
  deepClone,
  pick,
  omit,
  uid,
  sleep,
  safeGet,
  chunk,
  shuffle,
  clamp,
  escapeHtml
}
