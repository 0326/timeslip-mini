/**
 * 本地访客身份与本地资料管理（方案 2 + C 规则）
 *
 * 设计：
 * - 首次启动生成一个永不重复的 UUID 作为 visitorId，永久存在 localStorage（除非清缓存/卸载）
 * - 用户可在「我的→编辑资料」填写昵称和选头像，只存本地 storage，不上传 users 集合
 * - 对外展示（发帖/评论/雁书）时在对方设备统一显示「游客 + 项目 logo」（C 规则）
 * - 自己设备上可以看到自己填的昵称头像（仅本地展示用）
 * - 提供 bindWx() 钩子：绑定微信后调用云函数 getUser.bindVisitor 做数据迁移
 */

const { storage } = require('./storage')

const VISITOR_ID_KEY = 'visitor_id_v1'
const LOCAL_PROFILE_KEY = 'visitor_local_profile_v1'

// 项目 logo（用作访客对外默认头像，C 规则）
const DEFAULT_VISITOR_AVATAR = '/images/logo-256.png'
// 对内展示的占位默认头像（用户未填头像时显示）
const DEFAULT_LOCAL_AVATAR = '/images/logo-256.png'
const DEFAULT_LOCAL_NICKNAME = '穿越游客'

function _uuid() {
  // 兼容小程序环境：不依赖 crypto.randomUUID，用时间戳 + 随机串生成 32 位 UUID（足够唯一）
  const s = '0123456789abcdef'
  let r = ''
  for (let i = 0; i < 32; i++) r += s.charAt(Math.floor(Math.random() * 16))
  const t = Date.now().toString(16).slice(0, 8)
  return (t + r).slice(0, 32)
}

function getVisitorId() {
  let id = storage.get(VISITOR_ID_KEY)
  if (!id || typeof id !== 'string' || id.length < 8) {
    id = _uuid()
    try { storage.set(VISITOR_ID_KEY, id, 86400 * 365 * 10) } catch (e) {}
  }
  return id
}

/**
 * 读取本地资料（昵称头像，仅自己设备展示用）
 * 返回 { nickName, avatarUrl } 永不为空
 */
function getLocalProfile() {
  let p = null
  try { p = storage.get(LOCAL_PROFILE_KEY) } catch (e) { p = null }
  if (!p || typeof p !== 'object') p = {}
  return {
    nickName: typeof p.nickName === 'string' && p.nickName.trim() ? p.nickName.trim() : DEFAULT_LOCAL_NICKNAME,
    avatarUrl: typeof p.avatarUrl === 'string' && p.avatarUrl ? p.avatarUrl : DEFAULT_LOCAL_AVATAR
  }
}

/**
 * 保存本地资料
 */
function setLocalProfile(profile) {
  if (!profile || typeof profile !== 'object') return false
  const cur = getLocalProfile()
  const next = {}
  if (typeof profile.nickName === 'string') next.nickName = profile.nickName.trim().slice(0, 10)
  if (typeof profile.avatarUrl === 'string') next.avatarUrl = profile.avatarUrl
  const merged = Object.assign({}, cur, next)
  try {
    storage.set(LOCAL_PROFILE_KEY, merged, 86400 * 365 * 10)
    return true
  } catch (e) {
    return false
  }
}

/**
 * 对外展示用（C 规则）：访客身份统一显示「游客 + logo」
 * 调用方：任何给别人看的列表/详情（朋友圈/评论/频道/观潮）
 */
function getPublicVisitorDisplay() {
  return {
    nickName: '游客',
    avatarUrl: DEFAULT_VISITOR_AVATAR
  }
}

/**
 * 对内展示用（自己设备上的气泡/我的页面头部）
 */
function getSelfDisplay(boundUserInfo) {
  // 如果已绑定微信，优先用 users 集合的官方资料
  if (boundUserInfo && typeof boundUserInfo === 'object' && boundUserInfo.avatarUrl && boundUserInfo.nickName) {
    return {
      nickName: boundUserInfo.nickName,
      avatarUrl: boundUserInfo.avatarUrl
    }
  }
  return getLocalProfile()
}

/**
 * 绑定微信成功后调用：可选择是否清除本地 visitor 标记（建议保留，便于诊断）
 * 真正的数据迁移交给云函数 getUser.bindVisitor
 */
function afterBindWx() {
  // 当前不删除本地 visitorId / localProfile，以防绑定后仍需要回溯
  return true
}

module.exports = {
  getVisitorId,
  getLocalProfile,
  setLocalProfile,
  getPublicVisitorDisplay,
  getSelfDisplay,
  afterBindWx,
  DEFAULT_VISITOR_AVATAR,
  DEFAULT_LOCAL_AVATAR,
  DEFAULT_LOCAL_NICKNAME,
  // 对外统一别名：其他文件统一引用 visitor.PROJECT_LOGO 即可
  PROJECT_LOGO: DEFAULT_VISITOR_AVATAR
}
