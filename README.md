# 穿越圈 · 穿越兰台小程序端

> 面向历史文化爱好者的「穿越式」微信小程序 — 与古人小叙、批奏折、收飞鸽、测历史人格 DNA。
> 产品线：穿越兰台 `timeslip.work` · 子站 穿越·史记 `shiji.timeslip.work` · 小程序 **穿越圈**

![微信小程序](https://img.shields.io/badge/小程序-原生微信-07C160?logo=wechat)
![云开发](https://img.shields.io/badge/后端-微信云开发-3B82F6)
![AppID](https://img.shields.io/badge/AppID-wx30e49a87f6326f1d-ffaa00)
![envId](https://img.shields.io/badge/envId-cloud1--d0gunpzup215cfd87-ffaa00)
![基础库](https://img.shields.io/badge/基础库-≥3.0.0-lightgrey)

---

## 一、产品定位

穿越圈是**穿越兰台**品牌的微信小程序端，主打轻量、社交、社区的移动端体验。与 PC 端（深度典籍/视觉小说）形成互补：

| 产品 | 端 | 技术栈 | 定位 |
|---|---|---|---|
| 穿越兰台 主站 | PC | 待定 | 品牌入口、完整世界观 |
| 穿越·史记 | PC | React19 + Vite + Hono + Cloudflare Workers | Ink 视觉小说引擎、史记深度互动阅读 |
| **穿越圈** | 微信小程序 | **原生小程序 + 云开发（wx.cloud）** | **AI 与古人小叙 · 朋友圈 · 奏折 · 飞鸽传书 · DNA 测试** |

---

## 二、功能总览 · 14 页面 × 11 组件 × 9 云函数

### 2.1 四大 Tab 共 14 个页面

| Tab | 页面路径 | 核心功能 |
|---|---|---|
| 💬 聊天 | `pages/chat/index` | 与古人的会话列表（10 位历史人物） |
| | `pages/chat/room` | 一对一聊天房间，含打字动画 / 快捷问题 / 清空 / 历史 |
| 📖 兰台 | `pages/lantai/index` | 兰台首页：名士图鉴 + 典籍卡片 + 朝代筛选 |
| | `pages/lantai/figure-detail` | 名士详情：生平 · 作品 · 名言 · 关系图谱 · 「立刻小叙」入口 |
| | `pages/lantai/book-reader` | 典籍阅读器：章节目录 · 批注 · 收藏 · Wd Markdown 古籍纸纹 |
| 🧭 发现 | `pages/discover/index` | 穿越朋友圈流：古代动态 + 现代动态 + 朝代切换 |
| | `pages/discover/moment-detail` | 动态详情：全文 · 点赞 · 评论嵌套 · AI 名士跟评 |
| | `pages/discover/dna-test` | 历史人格 DNA：10 题测试 · 六维雷达 · 人格画像 · 保存分享 |
| | `pages/discover/pigeon` | 飞鸽传书：选古人 · 写信 · 飞鸽动画投递 · 回信拆封 |
| | `pages/discover/memorial` | 批奏折：奏折原文 · 4 选项决策 · 朱批 · 历史真实结局 · 三月后推演 |
| 👤 我的 | `pages/profile/index` | 个人中心：穿越号 · 等级进度 · 积分 · 名士收藏 · 快捷入口 |
| | `pages/profile/letters` | 信鸽驿站：收件箱 / 发件箱 · 已读未读 · 拆封翻页 |
| | `pages/profile/achievements` | 成就陈列：徽章 · 达成条件 · 总进度 |
| | `pages/profile/settings` | 设置：通知 / 缓存 / 隐私 / 关于 / 版本 / 退出 |

### 2.2 11 个自定义组件

| 组件 | 目录 | 核心能力 |
|---|---|---|
| custom-nav-bar | `components/custom-nav-bar` | 古金顶栏 + 返回 + 胶囊占位 + 标题渐显 |
| custom-tab-bar | `custom-tab-bar/` | 小程序原生自定义 TabBar，4 个 Tab + 徽标 + 古金配色 |
| figure-avatar | `components/figure-avatar` | 名士头像：sm/md/lg/自定义尺寸，朝代色边框 |
| chat-bubble | `components/chat-bubble` | 聊天气泡：左(古)/右(我) + typing 动画 + 引用诗 |
| chat-input-bar | `components/chat-input-bar` | 聊天输入：表情 + 快捷问题 + 提交 |
| moment-card | `components/moment-card` | 朋友圈卡片：时间/朝代/图片九宫格/点赞/评论展开 |
| moment-comment | `components/moment-comment` | 评论嵌套：@回复 / 点赞 / 两层嵌套 |
| memorial-scroll | `components/memorial-scroll` | 奏折卷轴：宣纸纹 + 朱批 + 4 选项 + 真实结局展示 |
| pigeon-lottie | `components/pigeon-lottie` | 纯 CSS 飞鸽动画（挥动翅膀 + 位移路径） |
| wd-markdown | `components/wd-markdown` | 古纸纹 Markdown 渲染：h1-h6 / 列表 / 引用 / 诗句 |
| loading-skeleton | `components/loading-skeleton` | 通用骨架屏：指定 rows + fade-in 动画 |

### 2.3 9 个业务云函数（事件驱动，返回契约 `{code,message,data}`）

| 云函数 | 入口 | 说明 |
|---|---|---|
| **getUser** | `ensureUser / updateInfo / getPoints / addPoints` | OPENID 免登注入 + 积分/等级/穿越号生成 |
| **chat** | `chat / moment_comment / pigeon_reply / memorial_simulate + history + clear` | **4 种 AI 模式** 人设模板 + 内容安全预检 + 会话/消息归档 |
| **moment** | `list / detail / like / comment / share` | 朋友圈流：分页 + 朝代筛选 + 点赞幂等 + AI 名士评论 |
| **pigeon** | `send / getInbox / getOutbox / read / delete` | 飞鸽传书：动态时效送达（1-30 分钟）+ 已读回执 |
| **memorial** | `list / detail / decide / simulate + history / progress` | 批奏折：4 道经典本（晁错/魏徵/诸葛亮/韩信）+ 四维评分 + 朱批生成 |
| **dna** | `getQuestions / submit / getResult / getMyResults` | DNA 题库 · 六维评分 · 10 种人格画像 · 雷达图数据 |
| **shiji** | `getCatalog / getChapter / markProgress / getFavorites` | 典籍目录 · 章节阅读 · 书签进度 · 收藏列表 |
| **contentCheck** | `text / image` | 封装微信 msgSecCheck / imgSecCheck |
| **initDB** | `seedFigures / seedBooks / seedMoments / seedDna / seedAchievements` | 首次部署的种子数据（10 名士 + 10 典籍 + 10 动态 + 10 题 + 10 成就） |

---

## 三、技术栈 & 架构

```
┌────────────────────────────────────────────────────┐
│                   微信小程序前端                      │
│  原生框架 · 4 Tab · 14 Pages · 11 Components         │
│  全局状态：app.globalData + 订阅发布                   │
│  请求封装：utils/cloudRequest.js（Loading/错误统一）   │
└──────────────────────┬─────────────────────────────┘
                       │ wx.cloud.callFunction / wx.cloud.database
┌──────────────────────▼─────────────────────────────┐
│                   微信云开发                          │
│  · 云函数（事件函数为主）9 个                          │
│  · 文档数据库 16 集合（users / chat_messages / moments …） │
│  · 云存储  avatar / letter / moment                  │
│  · 安全：OPENID 注入 · msgSecCheck · DB 权限规则       │
└────────────────────────────────────────────────────┘
```

### 3.1 关键设计决策

| 决策项 | 选择 | 理由 |
|---|---|---|
| 前端框架 | **原生微信小程序**（非 Taro / uni-app） | 贴合微信生态，性能最优，包体积最小 |
| 后端 | **微信云开发** | 免登录 OPENID 鉴权、云函数、DB、存储一体化 |
| AI 模式 | 云函数代理，Prompt 模板化 | 4 模式（对话/评论/回信/奏折推演）+ 10 名士人设 |
| 状态管理 | `app.globalData` + 订阅发布（`subscribePoints`） | 无需引入三方库，够用且轻量 |
| 自定义 TabBar | `custom-tab-bar/index.js` 原生机制 | 古金配色 + 徽标 + 高亮动画 |
| 安全 | 前端直接查询走 DB 安全规则；写操作一律云函数端校 OPENID | 参考 [database_rules.json](file:///Users/quanfengmini/claudespace/timeslip-mini/database_rules.json) |

---

## 四、快速开始

### 4.1 环境准备

- **微信开发者工具**（≥ stable）
- 已开通云开发，环境 ID：`cloud1-d8guq74iacc68352a`
- AppID：`wx30e49a87f6326f1d`（项目内已配好 `project.config.json`）

### 4.2 本地打开

```bash
# 项目根目录：/Users/quanfengmini/claudespace/timeslip-mini
# 直接用微信开发者工具 → 导入项目 → 选择本目录
```

### 4.3 部署云函数（首次）

在微信开发者工具中，逐个右键 `cloudfunctions/<name>/` 目录 → **云端安装依赖并上传**（不上传 `node_modules`）：

```
cloudfunctions/
├── getUser/        # 先部署它（用户基础）
├── chat/           # 含 4 种 AI 模式，必部署
├── moment/
├── pigeon/
├── memorial/
├── dna/
├── shiji/
├── contentCheck/
└── initDB/         # 部署完后调用 initDB/seedFigures 等一次造种子数据
```

### 4.4 造种子数据

部署 `initDB` 云函数后，在 **云函数测试面板** 依次调用：

```json
{ "action": "seedFigures" }
{ "action": "seedBooks" }
{ "action": "seedMoments" }
{ "action": "seedDna" }
{ "action": "seedAchievements" }
```

### 4.5 数据库安全规则

将项目根目录的 [database_rules.json](file:///Users/quanfengmini/claudespace/timeslip-mini/database_rules.json) 内容复制到「云开发控制台 → 数据库 → 安全规则」。

---

## 五、项目结构

```
timeslip-mini/
├── README.md                         # 本文件
├── AGENTS.md                         # Agent 工作流 & 项目指南
├── project.config.json               # 开发者工具配置（AppID 等）
├── project.private.config.json       # 本地私有配置（不进 Git）
├── .gitignore
├── database_rules.json               # 云数据库安全规则（16 集合）
├── .trae/
│   ├── rules/project-rules.md        # ★ 项目开发铁律（AI 必看）
│   └── skills/                       # 专项技能（小程序/云函数/DB/CI…）
├── miniprogram/
│   ├── app.js / app.json / app.wxss  # 入口三件套
│   ├── sitemap.json
│   ├── custom-tab-bar/               # 自定义 TabBar（4 Tab）
│   ├── pages/
│   │   ├── chat/{index,room}/        # 2 页
│   │   ├── lantai/{index,figure-detail,book-reader}/  # 3 页
│   │   ├── discover/{index,moment-detail,dna-test,pigeon,memorial}/  # 5 页
│   │   └── profile/{index,letters,achievements,settings}/  # 4 页
│   ├── components/                   # 10 个自定义组件
│   ├── utils/                        # 5 个工具模块
│   │   ├── cloudRequest.js           # ★ 云函数统一调用
│   │   ├── db.js                     # db / _ / $ 导出
│   │   ├── auth.js                   # 用户免登/更新
│   │   ├── date.js                   # 朝代排序/干支/穿越号生成
│   │   └── storage.js                # 本地缓存带 TTL
│   └── images/                       # 静态图片
└── cloudfunctions/
    ├── getUser/ chat/ moment/ pigeon/ memorial/ dna/ shiji/ contentCheck/ initDB/
    └── quickstartFunctions/          # 模板示例，可删除
```

---

## 六、数据库集合（共 16 个）

| 集合 | 读 | 写 | 说明 |
|---|---|---|---|
| `users` | 仅本人 | 仅本人 | 用户档案（_openid、穿越号、积分、等级、偏好） |
| `chat_sessions` | 仅本人 | 云函数 | 与名士的会话列表 |
| `chat_messages` | 仅本人 | 云函数 | 聊天消息（含 prompt/AI 模式） |
| `messages` | 仅本人 | 云函数 | 系统通知 |
| `historical_figures` / `figures` | 全员 | 仅后台 | 10 名士数据（人设/朝代/画像/名言） |
| `books` | 全员 | 仅后台 | 典籍目录 & 章节 |
| `moments` | 全员 | 云函数 | 穿越朋友圈动态 |
| `moment_comments` | 全员 | 登录用户 | 动态评论 & 回复 & AI 名士评论 |
| `moment_likes` | 全员 | 登录用户 | 点赞（独立集合防数组膨胀） |
| `letters` | 仅本人 | 云函数 | 飞鸽传书 |
| `memorials` | 全员 | 仅后台 | 奏折题目 & 选项 & 历史结局 |
| `memorial_answers` | 仅本人 | 云函数 | 我的奏折决策历史 |
| `memorial_simulations` | 仅本人 | 云函数 | 奏折推演结果 |
| `user_memorial_progress` | 仅本人 | 云函数 | 奏折通关进度 |
| `dna_questions` / `dna_types` | 全员 | 仅后台 | DNA 题库 + 人格画像 |
| `dna_results` | 仅本人 | 登录用户 | 我做过的 DNA 结果 |
| `achievements` | 全员 | 仅后台 | 成就定义 |
| `user_achievements` | 仅本人 | 云函数 | 我的成就解锁记录 |
| `user_points` | 仅本人 | 云函数 | 积分流水 |
| `book_favorites` | 仅本人 | 登录用户 | 典籍书签 |

---

## 七、开发规范速查

> 完整规则见 [.trae/rules/project-rules.md](file:///Users/quanfengmini/claudespace/timeslip-mini/.trae/rules/project-rules.md)

- **代码风格**：2 空格缩进、单引号、小驼峰、不加/统一加分号
- **页面**：每个页面一套四件套（`.js` `.json` `.wxml` `.wxss`）
- **云函数**：永远用 `cloud.DYNAMIC_CURRENT_ENV`，**不硬编码 envId**；用户身份通过 `cloud.getWXContext().OPENID` 取，不信任前端传参
- **时间字段**：`createdAt` / `updatedAt` 用 `db.serverDate()`
- **AI 内容**：文字/图片经过 `contentCheck`（`msgSecCheck` / `imgSecCheck`）
- **Git 提交**：`Conventional Commits` 中文规范
  ```
  feat: 新增 xxx 页面
  fix: 修复 xxx 空指针
  refactor: 重构 chat 云函数 4 模式
  docs: 更新 README
  chore: 依赖/构建工具
  ```

---

## 八、CI/CD 自动化

使用 `.trae/skills/miniprogram-ci` 技能，生成「预览」「上传」「npm 打包」脚本：

| 能力 | 命令（示例） |
|---|---|
| 本地预览二维码 | `miniprogram-ci preview --pp . --pkp ~/private.wx30e49a87f6326f1d.key --appid wx30e49a87f6326f1d` |
| 上传体验版 | `miniprogram-ci upload --pp . --pkp ~/private.key --uv 1.2.0 --desc "feat: 批奏折上线"` |

> `.key` 密钥文件**严禁进入 Git**（已在 `.gitignore` 忽略 `*.key`）。

---

## 九、相关链接

| 名称 | 链接 |
|---|---|
| 产品方案 | https://share.traecontent.cn/artifact/9UJU56TGVHSW7E |
| 技术方案文档 | 仓库内：`穿越朋友圈_技术方案_v1.0.md` |
| 云开发文档 | https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html |
| 小程序官方文档 | https://developers.weixin.qq.com/miniprogram/dev/framework/ |
| Agent 指南 | 仓库内：[AGENTS.md](file:///Users/quanfengmini/claudespace/timeslip-mini/AGENTS.md) |

---

## 十、版本号

- **当前版本**：`1.0.0`
- **发版策略**：`主版本 . 次版本 . 修订号`
- 里程碑：
  - `1.0.0`：技术方案全量落地（14 页 / 11 组件 / 9 云函数 / 16 集合）

---

*© 2026 穿越兰台 · 穿越圈团队 · 史笔如铁，不虚美，不隐恶。*
