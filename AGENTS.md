# 穿越圈（timeslip-mini）— AGENTS 指南

## 一、项目定位

**穿越圈**是「穿越兰台」产品线的微信小程序端，面向历史文化爱好者的社区与轻交互产品。

### 产品线矩阵

| 项目 | 域名 / 标识 | 技术栈 | 定位 |
|------|------------|--------|------|
| **穿越兰台 主站** | `timeslip.work` | （待确认） | PC 主站，品牌入口与核心内容 |
| **穿越·史记** | `shiji.timeslip.work` | React19 + Vite + Hono + Cloudflare Workers | PC 子站，Ink 视觉小说引擎 + 史记互动阅读 |
| **穿越圈** | 小程序 `wx515b70782ea1aaf3` | 原生微信小程序 + 云开发（wx.cloud） | 移动端社区 / 轻互动 / 用户体系 |

> 三项目共享同一世界观与内容体系（史记 / 典籍 / 角色），但端侧技术栈不同。小程序侧重轻量、社交、社区；PC 站侧重深度阅读与视觉表现。

---

## 二、技术栈

- **框架**：原生微信小程序（非 Taro / uni-app）
- **后端**：微信云开发（CloudBase）
  - 云函数（事件函数为主，HTTP 函数按需）
  - 文档数据库（NoSQL）
  - 云存储（图片 / 文件）
- **云环境 ID**：`cloud1-d0gunpzup215cfd87`
- **AppID**：`wx515b70782ea1aaf3`
- **基础库版本**：>= 3.0.0

---

## 三、目录结构

```
timeslip-mini/
├── AGENTS.md                  # 本文件
├── README.md                  # 项目说明
├── project.config.json        # 开发者工具项目配置
├── project.private.config.json
├── .gitignore
├── .trae/                     # AI agent 配置（Trae IDE）
│   ├── rules/
│   │   └── project-rules.md   # 项目开发铁律
│   └── skills/                # 专项技能
│       ├── miniprogram-development/
│       ├── auth-wechat-miniprogram/
│       ├── cloudbase-document-database-in-wechat-miniprogram/
│       ├── cloud-functions/
│       ├── miniprogram-ci/
│       └── miniprogram-automation/
├── miniprogram/               # 小程序前端源码
│   ├── app.js                 # 入口（wx.cloud.init + 用户初始化）
│   ├── app.json               # 全局配置（页面 / tabBar / 窗口）
│   ├── app.wxss               # 全局样式
│   ├── sitemap.json
│   ├── pages/                 # 页面（每个页面四件套）
│   │   └── index/
│   │       ├── index.js
│   │       ├── index.json
│   │       ├── index.wxml
│   │       └── index.wxss
│   ├── components/            # 自定义组件
│   ├── utils/                 # 工具函数
│   │   ├── cloudRequest.js    # 云函数统一调用封装
│   │   ├── db.js              # 数据库实例
│   │   ├── auth.js            # 用户认证与用户态
│   │   └── globalLogic.js     # 全局逻辑（tabBar 等）
│   └── images/                # 静态图片资源
└── cloudfunctions/            # 云函数
    └── quickstartFunctions/   # 模板示例（可替换）
```

---

## 四、核心约定

### 4.1 云开发初始化

- 在 `app.js` 的 `onLaunch` 中调用 `wx.cloud.init({ env, traceUser: true })`
- env 值：`cloud1-d0gunpzup215cfd87`
- 云函数中一律使用 `cloud.DYNAMIC_CURRENT_ENV`，**不硬编码 envId**

### 4.2 用户身份

- 小程序端免登录，OPENID 由微信自动注入
- 云函数中通过 `cloud.getWXContext()` 获取 `{ OPENID, APPID, UNIONID }`
- `users` 集合以 `_openid` 作为用户唯一标识

### 4.3 云函数调用规范

- 统一使用 `utils/cloudRequest.js` 的 `requestCloud(name, action, data, config)`
- 每个云函数采用 `{ action, ...params }` 的事件格式，便于一个函数内聚合多个操作
- 返回值约定：`{ code: 0, message: 'ok', data: ... }`，非 0 为失败

### 4.4 数据库约定

- 集合名使用小写 + 下划线，如 `users`、`posts`、`comments`
- 时间字段统一用 `db.serverDate()` 生成
- 前端查库优先直接走 `wx.cloud.database()`，简单操作不绕云函数
- 需要权限控制 / 复杂计算 / 聚合的操作放云函数

### 4.5 代码风格

- 缩进：2 空格
- 引号：单引号
- 文件名：小写 + 中划线（页面/组件目录用小写下划线或中划线一致）
- 提交：Conventional Commits（中文），如 `feat: 新增首页卡片`、`fix: 修复云函数超时`

---

## 五、与 PC 站的协同边界

| 能力 | PC 站（shiji.timeslip.work） | 小程序（穿越圈） |
|------|------------------------------|------------------|
| Ink 视觉小说 | ✅ 核心体验 | ⚠️ 轻量片段或外链引导 |
| 角色立绘 / 场景 | ✅ 全量高清 | ⚠️ 压缩版 / 头像级 |
| 社区 / 用户体系 | ⚠️ 极简 | ✅ 核心 |
| 典籍阅读 | ✅ 深度阅读 | ⚠️ 摘要 / 卡片 |
| 成就 / 收藏 | 各端独立（未来打通） | ✅ |

> 数据层：目前两端独立。未来如需打通用户数据，通过云函数 + 主站 API 桥接。

---

## 六、Agent 工作流

1. **读规则**：先读 `.trae/rules/project-rules.md`
2. **读技能**：按任务类型加载对应 skill（小程序开发 / 云函数 / 数据库 / CI / 自动化）
3. **写代码**：遵循目录结构与命名约定
4. **验证**：小程序用「微信开发者工具」打开项目验证编译
5. **提交**：Conventional Commits 规范

---

## 七、相关资源

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [微信开发者工具下载](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 参考项目：`/Users/liquanfeng/WeChatProjects/intelligentmoms`（成熟的云开发小程序架构）
