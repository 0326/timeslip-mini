---
name: cloud-functions
description: 微信云开发云函数技能 — 事件函数 / HTTP 函数开发、部署、日志、调试。
alwaysApply: false
---

# 云函数开发技能 — 穿越圈

## 激活条件

- 创建 / 修改 / 部署云函数
- 云函数日志排查
- HTTP 云函数 / API 端点
- 定时触发器

## 两种函数类型

| 类型 | 触发方式 | 语言 | 适用场景 |
|------|---------|------|---------|
| **事件函数** | `wx.cloud.callFunction`、定时触发器 | Node.js | 小程序后端逻辑、数据处理 |
| **HTTP 函数** | HTTP 请求 | Node.js / Python / Go / Java | 对外 API、Webhook、SSE / WebSocket |

> 穿越圈小程序**默认用事件函数**。只有需要对外暴露 REST API 时才用 HTTP 函数。

---

## 事件函数（Event Function）

### 目录结构

```
cloudfunctions/
└── <function-name>/
    ├── index.js        # 入口
    ├── package.json    # 依赖
    └── config.json     # 配置（可选）
```

### 基础模板

```js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { action, ...params } = event

    // 按 action 分发
    switch (action) {
      case 'list':
        return await handleList(OPENID, params)
      case 'create':
        return await handleCreate(OPENID, params)
      default:
        return { code: -1, message: '未知操作', data: null }
    }
  } catch (error) {
    console.error('函数执行错误:', error)
    return { code: -1, message: error.message || '服务异常', data: null }
  }
}
```

### 关键要点

1. **永远用 `cloud.DYNAMIC_CURRENT_ENV`**，不硬编码 envId
2. **用 `cloud.getWXContext()` 获取可信身份**，不信任前端传来的用户信息
3. **统一返回格式**：`{ code, message, data }`，`code: 0` 为成功
4. **错误兜底**：`try/catch` 包住主逻辑，返回友好错误信息
5. **一个函数多 action**：通过 `event.action` 分发，减少函数数量

### 依赖管理

在函数目录下 `npm install`，`package.json` 声明依赖。部署时云开发会自动安装依赖（事件函数）。

常用依赖：
- `wx-server-sdk` — 云开发 Node SDK（已内置，通常无需手动安装）
- `tcb-router` — 类 Koa 路由（可选，大型项目）

---

## HTTP 函数（HTTP Function）

### 适用场景

- 对外提供 REST API（给 H5、第三方服务）
- Webhook 回调
- SSE 流式输出
- WebSocket

### 基础模板（Node.js + Express）

```js
const express = require('express')
const app = express()

app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/posts', async (req, res) => {
  // ... 数据库查询
  res.json({ code: 0, data: [] })
})

app.all('*', (req, res) => {
  res.status(405).json({ error: 'Method Not Allowed' })
})

app.listen(9000)  // 必须监听 9000 端口
```

### 关键文件

```
my-http-function/
├── index.js          # 应用代码
├── package.json      # 依赖（含 express 等）
├── node_modules/     # HTTP 函数必须手动安装依赖后上传
└── scf_bootstrap     # 启动脚本，必须有执行权限
```

`scf_bootstrap` 内容：
```bash
#!/bin/bash
node index.js
```

设置权限：`chmod +x scf_bootstrap`

### 注意事项

- HTTP 函数**不会自动安装依赖**，必须包含 `node_modules`
- 必须监听 `9000` 端口
- `scf_bootstrap` 必须有执行权限且行尾为 LF
- 需要匿名访问时，配置网关访问路径 + 安全规则

---

## 部署

### 方式一：微信开发者工具（推荐日常）

右键云函数目录 → 「上传并部署：云端安装依赖」

### 方式二：命令行（CI）

使用 `@cloudbase/cli` 或云开发 MCP 工具。

---

## 日志与调试

### 查看日志

- 开发者工具 → 云开发控制台 → 云函数 → 日志
- 或云函数内 `console.log`，在「调试」中查看

### 本地调试

- 开发者工具 → 云函数 → 右键 → 「本地调试」
- 可设置断点、查看变量

### 常见问题

| 现象 | 可能原因 |
|------|---------|
| 超时 | 数据库操作慢 / 死循环 / 忘记 `return` |
| 依赖缺失 | HTTP 函数没带 `node_modules` |
| 权限不足 | 安全规则限制，需在云函数中用管理员权限 |
| `cloud not defined` | 忘记 `require('wx-server-sdk')` 或 `cloud.init()` |

---

## 定时触发器

在 `config.json` 中配置：

```json
{
  "triggers": [
    {
      "name": "dailyCleanup",
      "type": "timer",
      "config": "0 0 2 * * * *"
    }
  ]
}
```

Cron 表达式：7 段（秒 分 时 日 月 周 年）。

---

## 穿越圈建议函数划分

| 函数名 | 职责 |
|--------|------|
| `user` | 用户注册 / 信息更新 / 积分 / 等级 |
| `post` | 发帖 / 删帖 / 列表 / 详情 |
| `comment` | 评论 / 回复 |
| `like` | 点赞 / 取消 |
| `contentCheck` | 内容安全检测（文字/图片） |

> 每个函数内部用 `action` 字段分多操作，减少函数数量、便于管理。

## 相关技能

- `auth-wechat-miniprogram` — 用户身份鉴权
- `cloudbase-document-database-in-wechat-miniprogram` — 数据库操作
- `miniprogram-development` — 小程序端调用方式
- `miniprogram-ci` — CI/CD 自动化
