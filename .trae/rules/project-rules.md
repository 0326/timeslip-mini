# 穿越圈小程序 — 项目开发规则

> 本文件是 timeslip-mini 项目的开发铁律，所有 AI agent 与人工开发均须遵守。

---

## 一、总纲

1. **先读 skill 再动手**：涉及小程序开发、云函数、数据库、CI/CD、自动化测试时，先加载对应 skill（见 `.trae/skills/`）。
2. **小程序 = 原生 + 云开发**：不使用 Taro / uni-app 等跨端框架；后端用微信云开发（`wx.cloud`），不自建服务器。
3. **安全第一**：不硬编码密钥、envId 到代码里；云函数敏感操作一律在服务端校验权限，不信任前端传参。
4. **用户态 = OPENID**：用户身份以 `_openid` 为准，由微信自动注入，前端不伪造。

---

## 二、项目结构规范

### 2.1 目录

```
miniprogram/
├── app.js / app.json / app.wxss    # 入口三件套
├── pages/                          # 页面（每个页面一个目录，含四件套）
│   └── <page-name>/
│       ├── index.js
│       ├── index.json
│       ├── index.wxml
│       └── index.wxss
├── components/                     # 可复用自定义组件
│   └── <component-name>/
│       ├── index.js
│       ├── index.json
│       ├── index.wxml
│       └── index.wxss
├── utils/                          # 工具函数
│   ├── cloudRequest.js
│   ├── db.js
│   ├── auth.js
│   └── globalLogic.js
└── images/                         # 静态图片（png / jpg / svg）
```

### 2.2 页面约定

- 每个页面目录必须包含完整四件套：`.js`、`.json`、`.wxml`、`.wxss`
- 页面路径在 `app.json` 的 `pages` 数组中注册，首项为启动页
- 页面 `.json` 至少包含 `{ "usingComponents": {} }`（即使无自定义组件）

### 2.3 组件约定

- 自定义组件放在 `components/` 下，目录名即组件名
- 组件 `.json` 必须设置 `{ "component": true }`
- 在使用方的 `.json` 中通过 `usingComponents` 引入

---

## 三、云开发规范

### 3.1 初始化

- `app.js` 的 `onLaunch` 中调用 `wx.cloud.init()`
- env 参数：`cloud1-d0gunpzup215cfd87`
- `traceUser: true`（开启用户访问追踪）

### 3.2 云函数

- 云函数放在 `cloudfunctions/` 下，每个函数一个目录
- 入口文件：`index.js`，导出 `exports.main = async (event, context) => {}`
- 云函数内初始化：
  ```js
  const cloud = require('wx-server-sdk')
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
  ```
- **铁律：永远用 `cloud.DYNAMIC_CURRENT_ENV`，不硬编码 envId**
- 获取用户身份：`const { OPENID, APPID, UNIONID } = cloud.getWXContext()`
- 返回格式统一：
  ```js
  return { code: 0, message: 'ok', data: result }    // 成功
  return { code: -1, message: '错误描述', data: null } // 失败
  ```

### 3.3 事件函数 vs HTTP 函数

- 默认用**事件函数**（Event Function）：小程序端通过 `wx.cloud.callFunction` 调用
- 需要对外暴露 REST API 时才用 **HTTP 函数**（监听 9000 端口，需 `scf_bootstrap`）
- HTTP 函数需要手动安装依赖（`node_modules` 一起上传）

### 3.4 数据库

- 集合名：小写 + 下划线，如 `users`、`posts`、`comments`
- 前端简单查询直接用 `wx.cloud.database()`，不绕云函数
- 权限控制 / 聚合 / 复杂查询放云函数
- 时间字段：`createdAt` / `updatedAt`，用 `db.serverDate()` 生成
- 分页：`skip()` + `limit()`，限制单次 20 条起步，最多 100 条

### 3.5 云存储

- 文件上传用 `wx.cloud.uploadFile`
- 路径约定：`{类型}/{openid}/{时间戳}_{文件名}`，如 `avatar/oXXXXX/123456_avatar.jpg`
- 下载 / 获取临时链接用 `wx.cloud.downloadFile` 或 `getTempFileURL`

---

## 四、小程序前端规范

### 4.1 代码风格

- 缩进：2 空格
- 引号：单引号
- 语句结尾不加分号（或统一加，保持一致）
- 变量名：小驼峰 `userInfo`
- 常量：全大写下划线 `MAX_PAGE_SIZE`

### 4.2 页面生命周期

- 数据初始化放 `data` 或 `onLoad`
- 页面进入时刷新数据用 `onShow`（而非 `onLoad`，因为返回时不触发 onLoad）
- 清理工作放 `onUnload` 或 `onHide`

### 4.3 路由

- tabBar 页面用 `wx.switchTab`
- 普通页面跳转用 `wx.navigateTo`（最多 10 层）
- 重定向用 `wx.redirectTo`
- 清空栈跳转用 `wx.reLaunch`
- 页面间传参通过 URL query，接收方在 `onLoad(options)` 中读取

### 4.4 全局状态

- 简单全局状态放 `app.globalData`
- 需要响应式通知的，用「订阅-发布」模式（参考 `app.js` 的 `subscribePoints` / `emitPointsUpdate`）
- 复杂状态管理可引入 `mobx-miniprogram` 或 `westore`，但默认不引入

---

## 五、安全规范

1. **不信任前端**：云函数中所有关键操作（写入、删除、权限判断）必须用 `OPENID` 重新校验，不相信前端传来的用户身份
2. **防越权**：数据库安全规则默认「仅创建者可读写」，集合级别仔细配置
3. **不暴露密钥**：任何 SecretKey / 密码不得出现在前端代码、云函数日志、Git 仓库中
4. **内容安全**：用户生成内容（文字/图片）必须经过内容安全检测（微信提供 `security.msgSecCheck` / `imgSecCheck`）
5. **隐私合规**：收集用户数据前明示用途；遵循《微信小程序隐私保护指引》

---

## 六、性能规范

1. **包体积**：主包 < 2MB，整包 < 20MB；图片资源尽量走云存储
2. **分包加载**：非核心页面放入分包，减少主包体积
3. **图片优化**：列表图用缩略图；大图懒加载（`lazy-load`）
4. **setData 优化**：避免频繁 setData；合并多次更新；不传大数据
5. **列表渲染**：长列表用 `wx:key`；考虑使用 `recycle-view` 或分页加载

---

## 七、版本与发布

1. **开发版**：微信开发者工具 → 预览 / 真机调试
2. **体验版**：开发者工具 → 上传 → 后台设为体验版
3. **正式版**：提交审核 → 审核通过 → 发布
4. **版本号**：`主版本.次版本.修订号`，如 `1.0.0`
5. **CI 自动化**：使用 `miniprogram-ci`（见 `miniprogram-ci` skill），密钥文件 `.key` 不进 Git

---

## 八、Git 提交规范

Conventional Commits（中文）：

```
<type>: <subject>

<body>
```

type 可选值：

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `refactor` | 重构（不新增功能、不修 bug） |
| `style` | 格式调整（不影响代码逻辑） |
| `docs` | 文档变更 |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖等 |

示例：`feat: 新增首页推荐卡片列表`
