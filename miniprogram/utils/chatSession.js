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
function upsertSession(session) {
  const list = storage.get(SESSIONS_KEY) || []
  const idx = list.findIndex(s => s.figureId === session.figureId)
  const now = Date.now()
  if (idx >= 0) {
    const merged = Object.assign({}, list[idx], session)
    if (session.lastTime !== undefined) {
      merged.lastTime = session.lastTime
    } else {
      merged.lastTime = now
    }
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
      session,
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
  const exists = list.some(s => s.figureId === QINGYUE.figureId)
  if (!exists) {
    const session = {
      figureId: QINGYUE.figureId,
      figureName: QINGYUE.name,
      figureTitle: QINGYUE.title,
      dynasty: '',
      avatar: QINGYUE.avatar,
      lastMessage: QINGYUE_WELCOME.content.split('\n')[0],
      lastTime: Date.now(),
      unreadCount: 1,
      isSystem: true
    }
    list.push(session)
    saveSessions(list)

    const msgs = storage.get(msgKey(QINGYUE.figureId)) || []
    if (!msgs.length) {
      msgs.push(Object.assign({}, QINGYUE_WELCOME, { createdAt: Date.now() }))
      saveMessages(QINGYUE.figureId, msgs)
    }
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
  removeSession,
  getMessages,
  saveMessages,
  appendMessage,
  clearMessages,
  initQingyueSession
}
