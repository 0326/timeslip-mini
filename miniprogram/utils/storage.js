const PREFIX = 'timeslip_'

function safeParse(str, fallback) {
  if (str === undefined || str === null || str === '') return fallback
  try {
    return JSON.parse(str)
  } catch (e) {
    return fallback
  }
}

const storage = {
  get(key, defaultValue = null) {
    try {
      const val = wx.getStorageSync(PREFIX + key)
      return safeParse(val, defaultValue)
    } catch (e) {
      return defaultValue
    }
  },

  set(key, value, ttlSeconds = 0) {
    try {
      const payload = {
        _v: value,
        _t: Date.now(),
        _ttl: ttlSeconds
      }
      wx.setStorageSync(PREFIX + key, JSON.stringify(payload))
      return true
    } catch (e) {
      return false
    }
  },

  remove(key) {
    try {
      wx.removeStorageSync(PREFIX + key)
      return true
    } catch (e) {
      return false
    }
  },

  has(key) {
    try {
      const raw = wx.getStorageInfoSync()
      return raw.keys.indexOf(PREFIX + key) >= 0
    } catch (e) {
      return false
    }
  },

  clearExpired() {
    try {
      const info = wx.getStorageInfoSync()
      const now = Date.now()
      info.keys.forEach(k => {
        if (!k.startsWith(PREFIX)) return
        const str = wx.getStorageSync(k)
        const obj = safeParse(str, null)
        if (obj && obj._ttl && obj._t + obj._ttl * 1000 < now) {
          wx.removeStorageSync(k)
        }
      })
    } catch (e) {}
  },

  clearAll() {
    try {
      const info = wx.getStorageInfoSync()
      info.keys.forEach(k => {
        if (k.startsWith(PREFIX)) wx.removeStorageSync(k)
      })
      return true
    } catch (e) {
      return false
    }
  }
}

module.exports = { storage }
