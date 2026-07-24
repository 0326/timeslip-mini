---
name: cloudbase-document-database-in-wechat-miniprogram
description: 微信小程序云开发文档数据库技能 — CRUD、查询操作符、分页、聚合、地理位置。
alwaysApply: false
---

# 云开发文档数据库技能 — 穿越圈小程序

## 激活条件

- 数据库集合设计 / 数据建模
- CRUD 操作（增删改查）
- 条件查询、排序、分页
- 聚合查询（统计 / 分组 / 关联）
- 数据库安全规则

## 快速开始

### 初始化

```js
const db = wx.cloud.database()
const _ = db.command        // 查询操作符
const $ = db.command.aggregate // 聚合操作符
```

> 项目中已封装在 `utils/db.js`，直接 `const { db, _, $ } = require('../../utils/db')` 即可。

### 集合命名

- 小写 + 下划线：`users`、`posts`、`comments`、`likes`
- 穿越圈项目建议前缀可加 `c_` 区分（可选），默认不加

---

## CRUD 操作

### 查询（Read）

```js
// 查单条
const res = await db.collection('users').doc(openid).get()

// 条件查询
const res = await db.collection('posts')
  .where({ status: 'published' })
  .orderBy('createdAt', 'desc')
  .limit(20)
  .get()

// 分页
const res = await db.collection('posts')
  .orderBy('createdAt', 'desc')
  .skip(page * pageSize)
  .limit(pageSize)
  .get()
```

### 新增（Create）

```js
const res = await db.collection('posts').add({
  data: {
    title: '...',
    content: '...',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }
})
```

### 更新（Update）

```js
// 更新单条
await db.collection('posts').doc(id).update({
  data: {
    title: '新标题',
    updatedAt: db.serverDate()
  }
})

// 局部更新 — 数组操作
await db.collection('users').doc(openid).update({
  data: {
    points: _.inc(10),          // 原子自增
    favorites: _.push(postId)   // 数组追加
  }
})
```

### 删除（Delete）

```js
await db.collection('posts').doc(id).remove()
```

> 注意：前端只能删除自己创建的数据（受安全规则限制）。批量删除必须在云函数中进行。

---

## 查询操作符（`_`）

### 比较

```js
_.gt(10)          // > 10
_.gte(10)         // >= 10
_.lt(10)          // < 10
_.lte(10)         // <= 10
_.eq('value')     // == value
_.neq('value')    // != value
_.in([1, 2, 3])   // 在数组中
_.nin([1, 2])     // 不在数组中
```

### 逻辑

```js
_.and([_.gt(10), _.lt(20)])   // 且
_.or([{ a: 1 }, { b: 2 }])    // 或
_.not(_.gt(10))               // 非
```

### 数组

```js
_.push(item)       // 追加元素
_.pop()            // 弹出末尾
_.shift()          // 弹出开头
_.unshift(item)    // 开头插入
_.pull(item)       // 移除指定元素
_.addToSet(item)   // 不存在才加（去重）
```

### 字段操作

```js
_.inc(n)           // 数值原子增减
_.mul(n)           // 数值乘法
_.remove()         // 删除字段
_.set(value)       // 设置字段（替代整个值）
```

---

## 聚合（`$`）

用于复杂统计 / 分组 / 管道查询。

```js
const res = await db.collection('posts')
  .aggregate()
  .match({ status: 'published' })
  .group({
    _id: '$category',
    count: $.sum(1),
    avgViews: $.avg('views')
  })
  .sort({ count: -1 })
  .end()
```

常用聚合阶段：`match` / `group` / `sort` / `skip` / `limit` / `project` / `lookup`（关联）/ `unwind`。

---

## 安全规则

**原则：最小权限。**

- 默认规则：「仅创建者可读写」（前端操作时自动匹配 `_openid`）
- 需要公开读的集合（如帖子列表），设为「所有用户可读，仅创建者可写」
- 管理操作放云函数，用管理员权限（`cloud.DYNAMIC_CURRENT_ENV` 初始化的 SDK 拥有管理员权限）

---

## 性能与限制

| 限制 | 值 |
|------|----|
| 单次查询返回 | 20 条（小程序端） / 100 条（云函数） |
| 集合大小 | 无上限 |
| 单条文档大小 | 16 MB |
| 数据库连接 | 云函数中复用连接，不要每次初始化 |

最佳实践：
- 列表页一律分页，不要全量拉取
- 给常用查询字段建索引（控制台 → 集合 → 索引管理）
- 大数据量查询用 `skip + limit` 配合游标
- 不要在循环里做数据库操作，尽量批量

---

## 穿越圈核心集合参考

| 集合 | 用途 | 关键字段 |
|------|------|---------|
| `users` | 用户表 | `_openid`, `nickName`, `avatarUrl`, `points`, `createdAt` |
| `posts` | 帖子 / 动态 | `_openid`, `title`, `content`, `images`, `likes`, `comments`, `status`, `createdAt` |
| `comments` | 评论 | `postId`, `_openid`, `content`, `createdAt` |
| `likes` | 点赞记录 | `postId`, `_openid`, `createdAt` |
| `favorites` | 收藏 | `postId`, `_openid`, `createdAt` |

> 以上为参考设计，实际集合根据产品方案落地。

## 相关技能

- `cloud-functions` — 云函数中操作数据库
- `auth-wechat-miniprogram` — 用户身份与权限
- `miniprogram-development` — 小程序整体开发
