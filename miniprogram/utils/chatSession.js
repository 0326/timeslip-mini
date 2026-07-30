const { storage } = require('./storage')
const { QINGYUE } = require('./constants')

const SESSIONS_KEY = 'chat_sessions_local'
const MSG_KEY_PREFIX = 'chat_messages_'

// 青月欢迎消息
const QINGYUE_WELCOME = {
  _id: 'sys_qingyue_welcome',
  role: 'figure',
  figureId: QINGYUE.figureId,
  content: '你好呀，我是青月，穿越圈的向导。\n\n在这里你可以：\n· 前往「兰台」结识历史人物，与他们对话\n· 在「发现」浏览穿越朋友圈、飞鸽传书\n· 参与 DNA 测试，找到与你契合的历史灵魂\n\n有任何疑问，随时问我吧～',
  createdAt: 0
}

function msgKey(figureId) {
  return MSG_KEY_PREFIX + figureId
}

// 获取所有本地会话（按 lastTime 倒序）
function getSessions() {
  const list = storage.get(SESSIONS_KEY) || []
  return list.sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0))
}

// 保存全部会话列表
function saveSessions(list) {
  storage.set(SESSIONS_KEY, list || [])
}

// 根据 figureId 查找单个会话
function findSession(figureId) {
  const list = getSessions()
  return list.find(s => s.figureId === figureId) || null
}

// 新增或更新会话（按 figureId 去重）
// patch 会与现有会话合并，lastMessage / lastTime 会更新
// 空值不覆盖已有字段，避免丢失头像等信息
function upsertSession(session) {
  const list = storage.get(SESSIONS_KEY) || []
  const idx = list.findIndex(s => s.figureId === session.figureId)
  const now = Date.now()

  // 过滤掉空值，防止覆盖已有数据
  const patch = {}
  Object.keys(session).forEach(k => {
    const v = session[k]
    if (v !== '' && v !== null && v !== undefined) patch[k] = v
  })

  if (idx >= 0) {
    const merged = Object.assign({}, list[idx], patch)
    merged.lastTime = session.lastTime !== undefined ? session.lastTime : now
    list[idx] = merged
  } else {
    const item = Object.assign(
      {
        figureId: session.figureId,
        figureName: session.figureName || '',
        figureTitle: session.figureTitle || '',
        dynasty: session.dynasty || '',
        avatar: session.avatar || '',
        lastMessage: session.lastMessage || '',
        lastTime: now,
        unreadCount: 0,
        isSystem: !!session.isSystem
      },
      patch,
      { lastTime: session.lastTime !== undefined ? session.lastTime : now }
    )
    list.push(item)
  }
  saveSessions(list)
  return list
}

// 更新会话最后一条消息与时间
function bumpSession(figureId, lastMessage, lastTime) {
  const list = storage.get(SESSIONS_KEY) || []
  const idx = list.findIndex(s => s.figureId === figureId)
  const now = lastTime || Date.now()
  if (idx >= 0) {
    list[idx].lastMessage = lastMessage
    list[idx].lastTime = now
  }
  saveSessions(list)
}

// 清除未读
function clearUnread(figureId) {
  const list = storage.get(SESSIONS_KEY) || []
  const idx = list.findIndex(s => s.figureId === figureId)
  if (idx >= 0 && list[idx].unreadCount) {
    list[idx].unreadCount = 0
    saveSessions(list)
  }
}

// P1：累加未读（青月异步完成时，用户不在房间页则调用）
function incUnread(figureId) {
  const list = storage.get(SESSIONS_KEY) || []
  const idx = list.findIndex(s => s.figureId === figureId)
  if (idx >= 0) {
    list[idx].unreadCount = (list[idx].unreadCount || 0) + 1
    saveSessions(list)
  }
}

// P1：青月异步消息本地状态同步
function markProcessing(figureId, pendingMsg) {
  const list = storage.get(SESSIONS_KEY) || []
  const idx = list.findIndex(s => s.figureId === figureId)
  if (idx >= 0) {
    list[idx].status = 'processing'
    list[idx].pendingMessageId = pendingMsg || ''
    list[idx].lastMessage = pendingMsg ? '对方正在输入...' : list[idx].lastMessage
    list[idx].lastTime = Date.now()
    saveSessions(list)
  }
}

function markDone(figureId, aiContent) {
  const list = storage.get(SESSIONS_KEY) || []
  const idx = list.findIndex(s => s.figureId === figureId)
  if (idx >= 0) {
    list[idx].status = 'done'
    list[idx].pendingMessageId = ''
    list[idx].lastMessage = aiContent
    list[idx].lastTime = Date.now()
    saveSessions(list)
  }
}

function markFailed(figureId) {
  const list = storage.get(SESSIONS_KEY) || []
  const idx = list.findIndex(s => s.figureId === figureId)
  if (idx >= 0) {
    list[idx].status = 'failed'
    list[idx].pendingMessageId = ''
    list[idx].lastMessage = '暂时无法回复，请稍后重试。'
    list[idx].lastTime = Date.now()
    saveSessions(list)
  }
}

// 获取本地某会话最后一条消息时间（用于 syncMessages 的 since）
function getLocalLastTime(figureId) {
  const msgs = getMessages(figureId)
  if (!msgs.length) return 0
  return msgs[msgs.length - 1].createdAt || 0
}

// 用云端 session 状态更新本地（同步 processing/failed/unread/lastMessage）
function applyCloudSession(figureId, cloud) {
  if (!cloud) return
  const list = storage.get(SESSIONS_KEY) || []
  const idx = list.findIndex(s => s.figureId === figureId)
  if (idx < 0) return
  if (cloud.status) list[idx].status = cloud.status
  if (cloud.pendingMessageId !== undefined) list[idx].pendingMessageId = cloud.pendingMessageId
  if (cloud.unreadCount !== undefined) list[idx].unreadCount = cloud.unreadCount || 0
  // processing 时不覆盖 lastMessage（本地已写"对方正在输入..."）
  if (cloud.status === 'done' && cloud.lastMessage) {
    list[idx].lastMessage = cloud.lastMessage
  }
  // 时间统一转为毫秒数字，避免 Date 对象/字符串与数字混排导致排序错乱
  if (cloud.lastTime) {
    const t = new Date(cloud.lastTime).getTime()
    if (!isNaN(t)) list[idx].lastTime = t
  }
  saveSessions(list)
}

// 删除会话及其消息
function removeSession(figureId) {
  const list = storage.get(SESSIONS_KEY) || []
  const next = list.filter(s => s.figureId !== figureId)
  saveSessions(next)
  storage.remove(msgKey(figureId))
}

// 获取某个角色的本地消息记录
function getMessages(figureId) {
  return storage.get(msgKey(figureId)) || []
}

// 保存某个角色的消息记录（整体覆盖）
function saveMessages(figureId, messages) {
  storage.set(msgKey(figureId), messages || [])
}

// 追加消息（单条）
function appendMessage(figureId, message) {
  const list = getMessages(figureId)
  list.push(message)
  saveMessages(figureId, list)
}

// 清空某角色的消息
function clearMessages(figureId) {
  storage.remove(msgKey(figureId))
}

// 初始化青月默认会话（含欢迎消息）
// 仅当本地不存在青月会话时创建，避免覆盖已有对话
function initQingyueSession() {
  let list = storage.get(SESSIONS_KEY) || []
  const idx = list.findIndex(s => s.figureId === QINGYUE.figureId)
  if (idx < 0) {
    list.push({
      figureId: QINGYUE.figureId,
      figureName: QINGYUE.name,
      figureTitle: QINGYUE.title,
      dynasty: '',
      avatar: QINGYUE.avatar,
      lastMessage: QINGYUE_WELCOME.content.split('\n')[0],
      lastTime: Date.now(),
      unreadCount: 1,
      isSystem: true
    })
    saveSessions(list)

    const msgs = storage.get(msgKey(QINGYUE.figureId)) || []
    if (!msgs.length) {
      msgs.push(Object.assign({}, QINGYUE_WELCOME, { createdAt: Date.now() }))
      saveMessages(QINGYUE.figureId, msgs)
    }
  } else {
    // 已存在：强制更新头像等信息，防止旧缓存头像失效
    list[idx].avatar = QINGYUE.avatar
    list[idx].figureName = QINGYUE.name
    list[idx].figureTitle = QINGYUE.title
    list[idx].isSystem = true
    saveSessions(list)
  }
  return getSessions()
}

module.exports = {
  QINGYUE_WELCOME,
  getSessions,
  saveSessions,
  findSession,
  upsertSession,
  bumpSession,
  clearUnread,
  incUnread,
  removeSession,
  getMessages,
  saveMessages,
  appendMessage,
  clearMessages,
  initQingyueSession,
  markProcessing,
  markDone,
  markFailed,
  getLocalLastTime,
  applyCloudSession
}
