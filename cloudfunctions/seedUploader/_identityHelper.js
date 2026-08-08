/**
 * 本文件与 cloudfunctions/_shared/identity.js 完全一致
 *
 * 为什么每个云函数目录下都要放一份？
 * —— 微信云开发云函数是独立容器部署的，彼此不共享本地目录，
 *    不能通过 `../_shared/xxx.js` 的跨目录相对路径引用（本地调试可以，云端部署报错 MODULE_NOT_FOUND）。
 *
 * 未来如有需要，可改造为云函数「公共层 Layer」方式共享，当前阶段复制一份即可（文件小，更新不频繁）。
 */

function detectSource(WX, event) {
  if (!WX) WX = {}
  const E = event || {}
  // Donut Web SDK / HTTP 函数触发：可能在 WX 或 event 顶层带平台标记
  const donutFlag = (WX.__FROM_DONUT__ || WX.__DONUT__ || E.__donutPlatform || E.__FROM_DONUT__) ? true : false
  const h5Flag = (WX.__FROM_H5__ || WX.__H5__ || E.__FROM_H5__) ? true : false
  const webSource = String(WX.SOURCE || WX.source || WX.From || WX.from || E.__source || '').toLowerCase()
  const openid = WX.OPENID || ''
  const appid = WX.APPID || ''
  if (h5Flag || webSource === 'h5' || webSource === 'web') return 'donut-h5'
  if (donutFlag || webSource === 'android' || webSource === 'ios' || webSource === 'app') return 'donut-app'
  if (openid && /^o[a-zA-Z0-9_-]{10,}$/.test(openid) && appid) return 'miniprogram'
  if (openid) return 'miniprogram'
  // CloudBase HTTP 函数通道：OPENID/APPID 都为空但 SOURCE=http，Donut 多端默认统一归到 donut-h5（HTTP 通道）
  if (webSource === 'http' || webSource === 'cloudbase_web' || String(WX.TRIGGER_SRC || '').toLowerCase() === 'http') return 'donut-h5'
  return 'unknown'
}

/**
 * 解析用户身份（支持：微信绑定 OPENID / UNIONID / Donut App/H5 / 访客 visitorId）
 *
 * 返回字段：
 *   userId       统一用户标识（不建议直接写库，写库用 openid+visitorId 组合）
 *   openid       微信小程序 OPENID（未绑定微信 = 空串）
 *   unionid      微信开放平台 UNIONID（如有）
 *   visitorId    本地访客 UUID（前端注入 __visitorId；用于不绑定时写库归属）
 *   source       miniprogram / donut-app / donut-h5 / unknown
 *   isBound      是否已绑定微信身份（= !!openid）
 *   isVisitor    是否纯访客模式（= !isBound && !!visitorId）
 */
function resolveIdentity(event, WX) {
  const W = WX || {}
  const E = event || {}
  const source = detectSource(W, event)
  const openid = W.OPENID || ''
  const unionid = W.UNIONID || E.unionid || E.unionId || ''
  const visitorId = typeof E.__visitorId === 'string' && E.__visitorId.length >= 8 ? E.__visitorId : ''

  // 1) 已绑定微信小程序：OPENID 可信且唯一，直接使用
  if (source === 'miniprogram' && openid) {
    return {
      userId: openid,
      openid,
      unionid,
      visitorId,
      source,
      isBound: true,
      isVisitor: false
    }
  }

  // 2) UNIONID（Donut App/H5 走微信开放平台授权）
  if (unionid) {
    return {
      userId: `union:${unionid}`,
      openid,
      unionid,
      visitorId,
      source,
      isBound: !!openid,
      isVisitor: !openid
    }
  }

  // 3) 访客模式：仅前端注入的 visitorId
  if (visitorId) {
    return {
      userId: 'visitor:' + visitorId,
      openid: '',
      unionid: '',
      visitorId,
      source,
      isBound: false,
      isVisitor: true
    }
  }

  // 4) 兜底：没有任何身份信息（极少触发）
  return {
    userId: '',
    openid: '',
    unionid: '',
    visitorId: '',
    source,
    isBound: false,
    isVisitor: false
  }
}

/**
 * 生成「归属查询」条件：
 *   - 已绑定微信：where({ _openid: id.openid })
 *   - 访客模式：where({ visitorId: id.visitorId })
 *   - 两者都有时：_.or([{ _openid }, { visitorId }])
 *
 * 用法（云函数内）：
 *   const { resolveIdentity, ownerMatch } = require('./_identityHelper')
 *   const id = resolveIdentity(event, cloud.getWXContext())
 *   const _ = db.command
 *   const res = await db.collection('moments').where(ownerMatch(id, _)).limit(20).get()
 */
function ownerMatch(id, _dbCommand /* 传入 db.command 对象 */) {
  const _ = _dbCommand
  const conds = []
  if (id && id.openid) conds.push({ _openid: id.openid })
  if (id && id.visitorId) conds.push({ visitorId: id.visitorId })
  if (conds.length === 0) return { _openid: '__no_match__' }
  if (conds.length === 1) return conds[0]
  return _.or(conds)
}

/**
 * 写入前自动附加 owner 字段（所有云函数写入前都要调用一次）
 *
 * 返回一个新对象（不修改传入的 data），会自动写入：
 *   - _openid        当前身份已绑定微信 = id.openid；纯访客不写（避免覆盖原有 OPENID）
 *   - visitorId      当前有 visitorId（访客 or 绑定都带）= id.visitorId；否则不写
 *   - updatedAt      默认 db.serverDate()；传 autoTs=false 可关闭
 *   - createdAt      仅当传 autoCreate=true 且原 data 中不存在 createdAt 时写入
 *
 * 推荐用法（云函数）：
 *   const id = resolveIdentity(event, WX)
 *   const { attachOwnerFields } = require('./_identityHelper')
 *   await db.collection('moments').add({
 *     data: attachOwnerFields({ content, imageUrls, nickName: me.nickName, avatarUrl: me.avatarUrl }, id, db, { autoCreate: true })
 *   })
 *   await db.collection('moments').doc(xid).update({
 *     data: attachOwnerFields({ content: newContent }, id, db)
 *   })
 */
function attachOwnerFields(data, id, _db /* wx-server-sdk db 实例 */, opts) {
  const d = Object.assign({}, data || {})
  const o = opts || {}
  // 1) _openid：只有真的绑了微信才强制写入，访客模式保持原值（不覆盖已有 OPENID）
  if (id && id.openid) d._openid = id.openid
  // 2) visitorId：访客 or 绑定都写入（绑定后仍保留，便于后续迁移追溯）；空串则不写
  if (id && id.visitorId) d.visitorId = id.visitorId
  // 3) 时间戳
  if (_db && typeof _db.serverDate === 'function') {
    if (o.autoTs !== false) d.updatedAt = _db.serverDate()
    if (o.autoCreate && d.createdAt === undefined) d.createdAt = _db.serverDate()
  }
  return d
}

module.exports = { resolveIdentity, detectSource, ownerMatch, attachOwnerFields }
