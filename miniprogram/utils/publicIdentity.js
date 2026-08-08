/**
 * 公共展示身份工具（C 规则）
 *
 * C 规则（用户选定）：
 *  - 访客对外（别人的设备上，或任何非自己的列表展示）：统一显示为「游客」+ 项目 logo 头像
 *  - 自己设备上看自己的访客身份：显示本地设置的昵称 + 本地头像
 *
 * 本模块提供给前端所有列表/详情页（朋友圈、评论区、聊天、雁书、点赞列表等）统一调用。
 *
 * 设计思想：所有要渲染「某条数据的作者信息」的地方，都先把那条数据（含 _openid/visitorId/nickName/avatarUrl 字段）
 * 交给 patchAuthorForDisplay(doc) 处理，拿到最终 { nickName, avatarUrl } 再渲染。
 */

const visitor = require('./visitor')
const { storage } = require('./storage')

/**
 * 判断某个文档作者是否是当前设备登录的「我」
 *
 * 匹配条件（任一满足即判定为自己）：
 *   1. doc.visitorId === visitor.getVisitorId()
 *   2. doc._openid === getApp().globalData.openid（需先调用过 getUserInfo 把 openid 填进 globalData）
 *   3. doc._openid 存在且 openid 存在 storage 的 userInfo 中
 */
function isMe(doc) {
  if (!doc) return false
  const myVid = (typeof visitor === 'object' && visitor && typeof visitor.getVisitorId === 'function') ? visitor.getVisitorId() : ''
  if (myVid && doc.visitorId === myVid) return true

  let myOpenid = ''
  try {
    const app = typeof getApp === 'function' && getApp()
    if (app && app.globalData && app.globalData.openid) myOpenid = app.globalData.openid
  } catch (_) {}
  if (!myOpenid) {
    try {
      const ui = storage && storage.get ? storage.get('userInfo') : null
      if (ui && ui._openid) myOpenid = ui._openid
    } catch (_) {}
  }
  if (myOpenid && doc._openid && doc._openid === myOpenid) return true
  return false
}

/**
 * 把某条文档的作者展示信息处理成最终要渲染的版本。
 *
 * @param {Object} doc  一条包含作者信息的文档；允许字段有：
 *                       - _openid / visitorId   （用于归属判断）
 *                       - nickName / nickname    （作者昵称）
 *                       - avatarUrl              （作者头像）
 * @param {Object} opts 可选：
 *                       - selfDisplayNickOverride   仅在「是我自己」场景下强制指定昵称（例如读本地 profile 前先兜底）
 *                       - selfDisplayAvatarOverride 仅在「是我自己」场景下强制指定头像
 *                       - ignoreSelf                强制对外视角（永远显示游客+logo 给自己看，不推荐用）
 * @returns {{ nickName: string, avatarUrl: string }}
 */
function patchAuthorForDisplay(doc, opts) {
  const o = opts || {}
  const d = doc || {}
  const nickRaw = d.nickName || d.nickname || d.authorName || ''
  const avatarRaw = d.avatarUrl || d.avatar || d.authorAvatar || ''

  const authorIsVisitor = !!(d.visitorId && !d._openid)
  const me = !o.ignoreSelf && isMe(d)

  // ① 作者 = 我（访客 or 绑定都算我）：自己看自己，优先展示本地 profile；否则取文档原始值
  if (me) {
    try {
      if (typeof visitor === 'object' && visitor && typeof visitor.getSelfDisplay === 'function') {
        const local = visitor.getSelfDisplay()
        return {
          nickName: (o.selfDisplayNickOverride || local.nickName || nickRaw || '穿越客'),
          avatarUrl: (o.selfDisplayAvatarOverride || local.avatarUrl || avatarRaw || visitor.PROJECT_LOGO || '')
        }
      }
    } catch (_) {}
    return {
      nickName: nickRaw || '穿越客',
      avatarUrl: avatarRaw || (visitor && visitor.PROJECT_LOGO) || ''
    }
  }

  // ② 作者是纯访客（visitorId 存在且无 OPENID）且不是我 → 对外展示：游客 + 项目 logo
  if (authorIsVisitor) {
    const logo = (visitor && visitor.PROJECT_LOGO) ? visitor.PROJECT_LOGO : ''
    return { nickName: '游客', avatarUrl: logo }
  }

  // ③ 作者是绑定微信的普通用户 → 正常展示文档原始字段
  return {
    nickName: nickRaw || '穿越客',
    avatarUrl: avatarRaw || (visitor && visitor.PROJECT_LOGO) || ''
  }
}

/**
 * 批量处理数组的便捷方法（直接返回新数组，不修改原对象）
 */
function patchListForDisplay(list, opts) {
  if (!Array.isArray(list)) return []
  return list.map((it) => {
    const pd = patchAuthorForDisplay(it, opts)
    return Object.assign({}, it, pd)
  })
}

module.exports = {
  isMe,
  patchAuthorForDisplay,
  patchListForDisplay
}
