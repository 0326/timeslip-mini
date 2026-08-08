const db = wx.cloud.database()
const _ = db.command
const $ = db.command.aggregate

/**
 * 【建议优先用云函数】前端直写 db 的兜底封装：自动注入 visitorId，保证访客模式下写入的文档能归属到当前设备。
 *
 * 注意：前端写 db 受限于云开发安全规则（通常集合默认仅创建者可写，访客没有 OPENID 大概率无法写入），
 * 因此**强烈建议所有写入走云函数**（云函数里通过 attachOwnerFields + server admin 权限写入）。
 * 这里保留封装仅作为本地调试 / 私有云环境兜底。
 */
function _getVisitorIdSafe() {
  try {
    const v = require('./visitor')
    if (v && typeof v.getVisitorId === 'function') return v.getVisitorId()
  } catch (_) {}
  return ''
}
function _getOpenidSafe() {
  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.openid) return app.globalData.openid
  } catch (_) {}
  return ''
}

/**
 * 安全的 collection 包装：返回一个含 addSafe/updateSafe 的代理对象。
 *
 * 示例：
 *   const { coll } = require('../../utils/db')
 *   coll('moments').addSafe({ data: { content: '你好' } })
 */
function coll(name) {
  const ref = db.collection(name)
  const vid = _getVisitorIdSafe()
  const oid = _getOpenidSafe()
  function attach(data) {
    const d = Object.assign({}, data || {})
    if (oid) d._openid = oid
    if (vid) d.visitorId = vid
    return d
  }
  return {
    collection: ref,
    where: ref.where.bind(ref),
    doc: ref.doc.bind(ref),
    orderBy: ref.orderBy.bind(ref),
    limit: ref.limit.bind(ref),
    skip: ref.skip.bind(ref),
    field: ref.field.bind(ref),
    aggregate: ref.aggregate.bind(ref),
    count: ref.count.bind(ref),
    get: ref.get.bind(ref),
    watch: ref.watch.bind(ref),
    addSafe: (opts) => {
      const o = Object.assign({}, opts || {})
      o.data = attach(o.data || {})
      return ref.add(o)
    },
    updateSafe: (opts) => {
      const o = Object.assign({}, opts || {})
      o.data = attach(o.data || {})
      return ref.update(o)
    }
  }
}

module.exports = { db, _, $, coll }
