---
name: auth-wechat-miniprogram
description: 微信小程序云开发身份认证技能 — 原生免登、OPENID 获取、云函数鉴权、用户体系构建。
alwaysApply: false
---

# 微信小程序认证技能 — 穿越圈

## 激活条件

- 用户身份、登录、鉴权相关需求
- 涉及 `OPENID`、`wx.cloud` 用户态
- 用户注册 / 用户信息 / 权限判断

## 核心概念

### 免登机制

小程序 + 云开发模式下，用户身份是**自动注入**的：
- 小程序端调用 `wx.cloud.callFunction` 时，微信自动附带用户身份
- 云函数中通过 `cloud.getWXContext()` 获取 `{ OPENID, APPID, UNIONID }`
- **不需要**复杂的 OAuth 流程，**不需要**前端手动登录

### 标识符

| 标识 | 说明 | 何时可用 |
|------|------|---------|
| `OPENID` | 用户在当前小程序的唯一标识 | 始终可用 |
| `APPID` | 小程序的 AppID | 始终可用 |
| `UNIONID` | 用户在同一开放平台账号下的跨应用标识 | 小程序绑定了微信开放平台账号时可用 |

## 使用模式

### 1. 云函数中获取用户身份

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID, APPID, UNIONID } = cloud.getWXContext()
  
  // 用 OPENID 作为用户唯一标识
  return { code: 0, data: { openid: OPENID } }
}
```

**铁律：**云函数中所有需要权限校验的操作，必须用 `cloud.getWXContext().OPENID` 重新校验，**不能信任前端传来的用户身份**。

### 2. 小程序端初始化用户

在 `app.js` 或 `utils/auth.js` 中提供 `ensureUser()`：
- 调用 `getUser` 云函数，查询或创建用户记录
- 将用户信息存入 `app.globalData`

```js
async function ensureUser(appInstance) {
  const app = appInstance || getApp()
  if (app.globalData && app.globalData.userInfo && app.globalData.openid) {
    return app.globalData.userInfo
  }
  const res = await wx.cloud.callFunction({ name: 'getUser' })
  if (res.result.code === 0) {
    app.globalData.openid = res.result.data._openid
    app.globalData.userInfo = res.result.data
    return res.result.data
  }
  return null
}
```

### 3. 数据库权限控制

- `users` 集合以 `_openid` 为用户唯一字段
- 安全规则默认设为「仅创建者可读写」
- 需要他人可读的内容（如帖子、评论），单独设置集合权限

### 4. 头像 / 昵称（用户资料）

- 使用微信「头像昵称填写能力」（`button open-type="chooseAvatar"` / `input type="nickname"`）
- 用户主动选择后调用 `updateUserInfo` 保存到 `users` 集合
- 不要用 `wx.getUserProfile`（已废弃）

## 穿越圈用户表设计（参考）

`users` 集合字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `_openid` | string | 用户唯一标识（自动创建） |
| `nickName` | string | 昵称 |
| `avatarUrl` | string | 头像 URL |
| `points` | number | 积分（默认 0） |
| `memberLevel` | string | 会员等级 |
| `createdAt` | Date | 注册时间 |
| `updatedAt` | Date | 更新时间 |

## 常见坑

- **不要在前端存 openid 作为可信身份**：前端存的只做展示用，鉴权一律在云函数用 `getWXContext()`
- **UNIONID 可能为空**：只有绑定了开放平台的小程序才有，做兼容处理
- **新用户首次**：首次调用云函数时在服务端创建用户记录，返回 `isNewUser` 标记
- **不要用 `wx.login` + 后端换 openid**：云开发模式下不需要，直接 `getWXContext()`

## 相关技能

- `cloud-functions` — 云函数开发
- `cloudbase-document-database-in-wechat-miniprogram` — 数据库操作
- `miniprogram-development` — 小程序整体开发
