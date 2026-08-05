# 青月 Agent 智能化技术方案 v2（可落地修订版）

> 将穿越圈小程序系统向导「青月」从前端直连 ACP 的一次性问答，升级为服务端代理、会话可延续、结果可落库、后续可接工具的 Agent。
>
> 创建日期：2026-07-30  
> 方案版本：v2.1  
> 状态：待实施  
> 实施原则：先稳定收口 P0，再逐步加异步消息、工具调用和知识增强。

---

## 一、当前基线

当前已经落地：

1. 青月会话入口仍复用 `pages/chat/room`。
2. 青月使用 CloudBase Agent：`agt-timeslip-4gbqdboj2f9f506d`。
3. 前端通过 `wx.request` 直连 ACP endpoint：
   `https://cloud1-d8guq74iacc68352a.api.tcloudbasegateway.com/v1/aibot/bots/agt-timeslip-4gbqdboj2f9f506d/acp`
4. ACP 鉴权使用客户端 Publishable Key。
5. 前端已处理 SSE 文本过滤：只展示 `agent_message_chunk` 等可见回复，不展示 `agent_thought_chunk`、`usage_update`、`agent_phase`。
6. UI 已按微信式体验调整：处理期间不插入 AI 气泡，只把标题改成“对方正在输入中...”；完成后一次性追加完整消息。
7. 青月 Agent 人格已写入 `agt-timeslip-4gbqdboj2f9f506d` runtime fallback，并已线上验证。

当前主要缺口：

1. 前端直连 ACP，页面退出/小程序切后台可能中断请求。
2. 当前 `session/prompt` 未传 `sessionId`，属于 one-shot 模式，Agent 不持久记忆。
3. 青月回复结果只存在本地，不稳定落云端 `chat_messages`。
4. 无工具调用，不能查兰台人物、用户成就、最近聊天等真实数据。
5. 异步消息体验未完成：离开页面后无法可靠同步“处理中/完成/未读”。

---

## 二、目标架构

### 2.1 P0 目标架构

P0 只做最小稳定闭环：

```text
room.js
  ↓ wx.cloud.callFunction
qingyue-agent 代理云函数
  ↓ ACP JSON-RPC
agt-timeslip-4gbqdboj2f9f506d
  ↓ SSE
qingyue-agent 解析纯文本
  ↓
room.js 一次性追加 AI 消息
```

P0 不做工具调用、不做复杂异步红点、不做 Skills。先把前端直连改成服务端代理，并让 Agent session 可延续。

### 2.2 为什么需要代理云函数

代理云函数解决三个问题：

1. **安全边界**：前端不再持有 ACP endpoint / Publishable Key 细节。
2. **会话持久化**：由服务端维护 `agentSessionId`，每轮传给 ACP 的 `sessionId`。
3. **服务端解析**：SSE、错误、重试逻辑统一在云函数处理，前端只拿纯文本。

---

## 三、字段命名统一

旧方案里混用了 `threadId`、`conversationId`、`sessionId`，容易实现错误。新方案统一：

| 场景 | 字段名 |
|---|---|
| 业务存储字段 | `agentSessionId` |
| ACP JSON-RPC 参数 | `sessionId` |
| 本地 storage key | `qingyue_agent_session_id` |

不再使用 `threadId` / `conversationId`。

---

## 四、P0 ｜ 云函数代理 + Agent 会话延续

### 4.1 新增云函数

新增：

```text
cloudfunctions/qingyue-agent/
  index.js
  package.json
  config.json
```

`qingyue-agent` 是代理云函数，不是新的 Agent。真正的 Agent 仍是：

```text
agt-timeslip-4gbqdboj2f9f506d
```

### 4.2 云函数 action

P0 只需要三个 action：

| action | 用途 |
|---|---|
| `send` | 发送用户消息，调用 Agent，返回 AI 文本 |
| `history` | 拉取青月云端历史消息 |
| `clearSession` | 清空青月消息，并删除 Agent session |

### 4.3 `send` 流程

```text
qingyue-agent.send
  1. cloud.getWXContext() 获取 OPENID
  2. 校验 text 长度与内容安全
  3. 获取或创建 agentSessionId
  4. 写入 user message 到 chat_messages
  5. 调 ACP session/prompt，参数带 sessionId
  6. 解析 SSE，只提取最终可见回复
  7. 写入 assistant message 到 chat_messages
  8. 更新 chat_sessions
  9. 返回 { aiMsg }
```

注意：云函数写数据库时必须显式写 `_openid: OPENID`，不要假设 `_openid` 自动注入。

### 4.4 Agent session 创建策略

优先使用数据库存储的 `agentSessionId`：

```js
chat_sessions {
  _openid,
  figureId: 'sys_qingyue',
  agentSessionId: 'uuid-v4',
  status: 'done',
  lastMessage,
  lastTime,
  unread,
  createdAt,
  updatedAt
}
```

调用策略：

```js
async function ensureAgentSession(OPENID) {
  const session = await getQingyueSession(OPENID)
  if (session.agentSessionId) return session.agentSessionId

  const agentSessionId = uuid()
  await acpRequest('session/new', { sessionId: agentSessionId })
  await saveAgentSessionId(OPENID, agentSessionId)
  return agentSessionId
}
```

如果 `session/new` 对自定义 `sessionId` 不兼容，则改为：

```js
const res = await acpRequest('session/new', {})
const agentSessionId = res.sessionId
```

以真实接口返回为准。

### 4.5 ACP 调用

```js
await acpRequest('session/prompt', {
  sessionId: agentSessionId,
  prompt: [
    { type: 'text', text }
  ]
})
```

不传 `sessionId` 只能作为降级 one-shot，不作为主路径。

### 4.6 前端改造

`room.js` 中青月分支从：

```js
wx.request(QINGYUE.acpEndpoint)
```

改为：

```js
const data = await requestCloud('qingyue-agent', 'send', {
  text,
  localMessageId: userMsg._id
}, { throwError: true })

this.addAiMessage(data.aiMsg.content)
```

UI 保持当前规则：

1. 用户消息立即出现。
2. 处理期间只改标题为“对方正在输入中...”。
3. 不插入 AI 占位气泡。
4. 完成后一次性追加完整 AI 气泡。
5. 不做打字机效果。

---

## 五、P1 ｜ 云端消息同步与轻量异步体验

P1 在 P0 稳定后实施。

### 5.1 能保证什么

异步体验的可靠性边界：

1. 请求已经到达云函数后，云函数可继续执行并落库。
2. 请求尚未到达云函数前，小程序被杀，消息可能失败。
3. `app.globalData.agentPromises` 只能解决页面切换，不解决杀进程。
4. 杀进程重进必须依赖云端 `chat_sessions` / `chat_messages` 同步。

文档和实现中不要把“不 await Promise”等同于可靠后台任务。

### 5.2 `chat_sessions` 扩展

不要新建同名集合。项目已有 `chat_sessions`，只扩展字段：

```js
{
  _openid,
  figureId: 'sys_qingyue',
  figureName: '青月',
  avatar: '/images/qingyue.jpg',
  lastMessage: '...',
  lastTime: Date,
  unread: 0,
  status: 'processing' | 'done' | 'failed',
  agentSessionId: 'uuid-v4',
  pendingMessageId: 'u_xxx',
  createdAt,
  updatedAt
}
```

### 5.3 发送状态

`qingyue-agent.send` 一进入云函数即写：

```js
status: 'processing'
pendingMessageId: localMessageId
lastMessage: text
```

成功后更新：

```js
status: 'done'
lastMessage: aiReply
unread: inc(1) // 如果用户不在房间页，前端同步时展示
```

失败后更新：

```js
status: 'failed'
lastMessage: '暂时无法回复，请稍后重试。'
```

### 5.4 前端页面切换

`app.globalData` 用普通对象，不用 `Set`：

```js
globalData: {
  agentPromises: {},
  activePages: {}
}
```

```js
setActivePage(key) {
  this.globalData.activePages[key] = true
}

clearActivePage(key) {
  delete this.globalData.activePages[key]
}

isPageActive(key) {
  return !!this.globalData.activePages[key]
}
```

页面 key：

```text
chat/room:sys_qingyue
```

### 5.5 onShow 同步

`room.js onShow`：

1. 检查本地是否有 pending promise，有则恢复标题“对方正在输入中...”。
2. 调 `qingyue-agent.syncMessages` 拉取比本地新的消息。
3. 清除青月 unread。

`chat/index.js onShow`：

1. 调 `qingyue-agent.syncSessions` 拉取云端 session 状态。
2. 本地会话列表展示：
   - `status === 'processing'`：显示“对方正在输入中...”
   - `unread > 0`：显示红点

---

## 六、P2 ｜ 工具调用

工具调用不要和 P0 一起做。必须先做线上实测，确认 ACP custom tool 帧格式。

### 6.1 最小验证工具

先只做一个工具：

```text
get_feature_guide
```

用途：根据功能名返回硬编码玩法说明。

先验证：

1. Agent 是否真的发出 `client/<toolName>` 帧。
2. tool call id 字段在哪里。
3. `tool_result` block 的字段名是否为 `tool_use_id`。
4. `stopReason` 的实际值。
5. 多轮 `session/prompt` 是否能稳定继续。

### 6.2 工具循环

确认协议后再实现：

```js
for (let i = 0; i < MAX_TOOL_ROUNDS; i++) {
  const raw = await callAgentWithSession(agentSessionId, promptBlocks)
  const parsed = parseAcpFrames(raw)

  if (!parsed.toolCalls.length) return parsed.text

  const toolResults = await Promise.all(
    parsed.toolCalls.map(tc => executeTool(tc.name, tc.input, userContext))
  )

  promptBlocks = toolResults.map((r, i) => ({
    type: 'tool_result',
    tool_use_id: parsed.toolCalls[i].toolCallId,
    content: JSON.stringify(r),
    is_error: !!r.error
  }))
}
```

`MAX_TOOL_ROUNDS` 初始设为 3，不建议一开始设 5。

### 6.3 首批工具顺序

| 优先级 | 工具 | 数据源 | 原因 |
|---|---|---|---|
| P2-1 | `get_feature_guide` | 云函数常量 | 最小验证工具协议 |
| P2-2 | `query_recent_chats` | `chat_sessions` | 能体现个性化，查询简单 |
| P2-3 | `query_figures` | `figures` | 支持“兰台有哪些人” |
| P2-4 | `query_user_achievements` | `users.achievements` 或实际成就集合 | 需要先确认现有数据结构 |

注意：当前项目里成就看起来在 `users.achievements` 字段中，不一定存在 `user_achievements` 集合。实现前必须先确认数据库结构。

---

## 七、P3 ｜ 身份感知与知识增强

### 7.1 身份上下文

不要使用云函数实例级 `Set` 判断是否已注入上下文。实例会冷启动，多实例也不共享。

短期建议：每次都注入极短上下文，控制在 100 字以内。

```js
function buildContextPrefix(ctx) {
  const parts = []
  if (ctx.nickName) parts.push(`昵称=${ctx.nickName}`)
  if (ctx.recentFigures?.length) parts.push(`最近聊过=${ctx.recentFigures.join('、')}`)
  return parts.length ? `[用户上下文：${parts.join('，')}] ` : ''
}
```

长期如果要只注入一次，使用数据库字段：

```js
chat_sessions.contextInjectedAt
```

### 7.2 产品知识

短期不要依赖 `skills/` 目录。原因：本项目已经验证过，根目录 `agent.yaml` 不一定会按预期进入线上运行读取路径。

推荐顺序：

1. P0：核心产品知识放 Agent system fallback。
2. P2：详细玩法放 `get_feature_guide` 工具常量。
3. P3：迁移到 `product_guides` 集合或 CloudBase 知识库。
4. 确认部署工具会保留 `/var/user/skills` 后，再考虑 `skills/product-faq/SKILL.md`。

---

## 八、Agent system prompt 优化

当前已经写入青月基础人格。P2 工具可用后，再补充工具使用规则。

建议结构：

```text
你是「青月」，穿越圈小程序的系统向导。

【身份】
- 不扮演历史人物。
- 不说自己是通用 AI。
- 负责功能答疑、入口引导、玩法解释。

【工具使用】
- 用户问功能玩法：调用 get_feature_guide。
- 用户问最近聊过谁：调用 query_recent_chats。
- 用户问兰台人物/朝代人物：调用 query_figures。
- 用户问成就/积分：调用 query_user_achievements。
- 简单问候不调用工具。

【回答红线】
- 不输出 JSON、usage、phase、sessionUpdate、工具细节。
- 不回答“去看看”“有很多”这类空泛引导。
- 必须给具体入口路径、具体人物名或可执行步骤。
```

---

## 九、改动文件总览

### P0

| 文件 | 改动 |
|---|---|
| `cloudfunctions/qingyue-agent/index.js` | 新建代理云函数：send/history/clearSession |
| `cloudfunctions/qingyue-agent/package.json` | 新建依赖 |
| `cloudfunctions/qingyue-agent/config.json` | 新建，超时建议 60s |
| `miniprogram/pages/chat/room.js` | 青月分支改为调用云函数；保留当前 UI 逻辑 |
| `miniprogram/utils/chatSession.js` | 新增青月 agentSessionId 本地缓存和清理 |

### P1

| 文件 | 改动 |
|---|---|
| `cloudfunctions/qingyue-agent/index.js` | 增加 syncMessages/syncSessions |
| `miniprogram/pages/chat/room.js` | onShow 同步新消息 |
| `miniprogram/pages/chat/index.js` | onShow 同步 session 状态 |
| `miniprogram/pages/chat/index.wxml` | 增加红点/processing 展示 |
| `miniprogram/pages/chat/index.wxss` | 增加红点/processing 样式 |
| `miniprogram/app.js` | agentPromises/activePages 状态跟踪 |

### P2

| 文件 | 改动 |
|---|---|
| `cloudfunctions/qingyue-agent/index.js` | 增加工具循环和工具实现 |
| `cloudfunctions/agt-timeslip-4gbqdboj2f9f506d/src/config.ts` | 增加工具使用 prompt |
| `cloudfunctions/agt-timeslip-4gbqdboj2f9f506d/dist/config.js` | 同步运行时 fallback |

---

## 十、验证清单

### P0 验证

- [ ] 青月发送“你是谁”返回青月身份。
- [ ] 连续问“兰台是什么”“那我怎么进去”，第二问能基于同一 `sessionId` 延续上下文。
- [ ] 前端不再出现 raw SSE / JSON / usage / phase。
- [ ] 处理期间不出现 AI 占位气泡，只显示标题“对方正在输入中...”。
- [ ] 完成后一次性出现完整 AI 回复。
- [ ] 清空对话后 Agent session 重置。
- [ ] 云端 `chat_messages` 能看到 user/assistant 两条消息。

### P1 验证

- [ ] 发消息后切到聊天列表，列表显示“对方正在输入中...”。
- [ ] 回复完成后列表更新最后消息。
- [ ] 用户离开 room 页后完成，回到 room 页能同步新消息。
- [ ] 杀进程后重进，能从云端拉到已完成消息。
- [ ] 失败时 `status: failed`，前端展示重试。

### P2 验证

- [ ] `get_feature_guide` 工具真实触发并返回玩法说明。
- [ ] 工具调用超过上限时失败可控。
- [ ] 工具失败时 Agent 能降级回答。
- [ ] `query_figures` 返回真实 `figures` 数据。
- [ ] `query_recent_chats` 返回当前用户最近聊天。

---

## 十一、实施顺序

1. P0-1：新建 `qingyue-agent` 代理云函数，只实现 `send`。
2. P0-2：服务端维护 `agentSessionId`，调用 `session/new` + `session/prompt`。
3. P0-3：服务端解析 SSE，前端只接收纯文本。
4. P0-4：前端青月分支从直连 ACP 改为调用 `qingyue-agent.send`。
5. P0-5：实现 `history` / `clearSession`，验证清空后上下文重置。
6. P1-1：扩展 `chat_sessions.status`，列表页显示 processing。
7. P1-2：实现 `syncMessages` / `syncSessions`。
8. P2-1：只接 `get_feature_guide`，抓线上 SSE 验证工具协议。
9. P2-2：接 `query_recent_chats` / `query_figures`。
10. P3：再考虑知识库、Skills、成就工具和更完整身份感知。

---

## 十二、暂缓项

以下能力暂不进入 P0：

1. Skills 自动注入：部署路径和运行读取路径未完全验证。
2. 完整工具调用循环：先用单工具验证协议。
3. 成就工具：先确认真实成就数据结构。
4. 完整异步队列：当前只做“请求到达云函数后可继续落库”的轻量异步。
5. 多设备强一致：P1 先以云端 `chat_sessions.agentSessionId` 为准，复杂冲突后续处理。

