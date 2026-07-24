# 历史人格 DNA 测试 — 重构方案

> 本文档是 `timeslip-mini` 小程序「历史人格DNA」模块的完整重构方案。
> 旧实现位于 `pages/discover/dna-test`，单页硬编码、云函数 action 不匹配导致功能不可用。

---

## 一、问题诊断

### 1.1 旧实现的问题

| 问题 | 现象 | 根因 |
|------|------|------|
| 功能不可用 | 进入测试只能答 mock 题 | 前端调 `dna/getQuestions`，云函数注册的是 `dna-getQuestions`，action 名不匹配 |
| 单一测试 | 只有 1 套固定题 | 题目/结果全部硬编码在 `dna-test.js` 的 `MOCK_QUESTIONS` / `MOCK_RESULTS` |
| 算分粗糙 | 结果几乎随机 | `calcResult` 用 `if (opt === 'A')` 给固定人物加分，最后取最高，且叠加 `Math.random()` |
| 无大厅页 | 一进来就是题目 | 入口直接跳 `dna-test`，没有测试列表 |
| 雷达图老旧 | 在新机型上模糊 | 用了已 deprecated 的 `wx.createCanvasContext` |
| 分享弱 | 只有文字卡片 | 只实现了 `onShareAppMessage`，无海报、无朋友圈分享 |
| 云函数臃肿 | 职责混乱 | `cloudfunctions/dna/index.js` 同时处理 DNA 测试和奏折（memorial）逻辑 |
| memorial 页面也坏 | 调用 `'memorial'` 云函数不存在 | 前端调 `requestCloud('memorial', 'list')`，但 memorial 逻辑在 dna 云函数里 |

### 1.2 重构目标

1. **数据驱动**：题目、结果、维度配置全部进数据库，支持多个测试
2. **三层结构**：大厅 → 答题 → 结果，清晰解耦
3. **服务端算分**：服务端用维度向量距离算法，遵循「不信任前端」铁律
4. **结果页视觉冲击 + 强分享**：Canvas 2.0 雷达、海报生成、3 层分享
5. **拆分云函数**：dna 只管 DNA，memorial 独立

---

## 二、整体架构

### 2.1 页面流

```
发现页 quickEntries / 我的页
        ↓
/pages/discover/dna-hall        ← 大厅：测试列表 + 分类筛选
        ↓ 点击某个测试
/pages/discover/dna-quiz?id=xxx ← 答题
        ↓ 答完跳转
/pages/discover/dna-result?recordId=xxx ← 结果 + 分享
```

### 2.2 文件结构

```
miniprogram/
├── pages/discover/
│   ├── dna-hall/         ← 新增：大厅
│   │   ├── index.js
│   │   ├── index.json
│   │   ├── index.wxml
│   │   └── index.wxss
│   ├── dna-quiz/         ← 新增：答题
│   │   ├── index.js
│   │   ├── index.json
│   │   ├── index.wxml
│   │   └── index.wxss
│   ├── dna-result/       ← 新增：结果
│   │   ├── index.js
│   │   ├── index.json
│   │   ├── index.wxml
│   │   └── index.wxss
│   └── dna-test.*        ← 删除
├── utils/
│   └── dna-engine.js     ← 新增：维度向量算分引擎（前端镜像，用于结果页展示）
└── cloudfunctions/
    ├── dna/              ← 重写：DNA 专属
    │   └── index.js
    └── memorial/         ← 新增：奏折专属（从 dna 拆出）
        ├── index.js
        ├── config.json
        └── package.json
```

---

## 三、数据库设计

### 3.1 集合一：`dna_quizzes`（测试列表）

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 系统自动 |
| `id` | string | slug，如 `emperor` / `poet` / `general` |
| `title` | string | 「测测你更像哪位皇帝？」 |
| `subtitle` | string | 副标题 |
| `desc` | string | 简介 |
| `cover` | string | 封面图（cloud:// 或 https://） |
| `icon` | string | emoji 或图标 |
| `themeColor` | string | 主题色，如 `#B71C1C` |
| `questionsCount` | number | 实际使用题数 n（可小于题目总数） |
| `dimOrder` | array | `[{value, name, model}]` 维度配置 |
| `category` | string | `emperor` / `poet` / `general` / `minister` / `other` |
| `isOffline` | boolean | 下线开关 |
| `order` | number | 排序权重 |
| `createdAt` | date | `db.serverDate()` |

### 3.2 集合二：`dna_questions`（题目）

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | |
| `quizId` | string | 关联 quiz.id |
| `order` | number | 题目顺序 |
| `text` | string | 题干 |
| `dim` | string | 维度 code，如 `L` (谋略) |
| `options` | array | `[{label, text, dimValue}]`，dimValue 通常 1/2/3 |

### 3.3 集合三：`dna_results`（结果配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | |
| `quizId` | string | |
| `tag` | string | 唯一标识，如 `LiBai` |
| `figureId` | string | 关联兰台 `HISTORICAL_FIGURES` 的 figureId |
| `figureName` | string | 李白 |
| `figureTitle` | string | 诗仙 |
| `dynasty` | string | 朝代 code |
| `dynastyName` | string | 唐 |
| `pattern` | string | 维度向量，如 `HHL-LLM-HHH` |
| `title` | string | 结果标题，如「李白式浪漫」 |
| `intro` | string | 一句话简介 |
| `desc` | string | 详细描述 |
| `bio` | string | 人物简介 |
| `quote` | string | 名言 |
| `reasons` | array | `['理由1', '理由2', '理由3']` |
| `radar` | object | `{谋略:85, 魄力:60, ...}` 雷达图数据 |
| `cover` | string | 结果图 |
| `themeColor` | string | 结果主题色 |
| `bgStart` / `bgEnd` | string | 渐变背景色 |

### 3.4 集合四：`dna_records`（用户记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | |
| `_openid` | string | 微信注入 |
| `quizId` | string | |
| `quizTitle` | string | 冗余，列表展示用 |
| `answers` | array | `[{q, a, dim, dimValue}]` |
| `scores` | object | `{L: 5, W: 4, ...}` 各维度累计分 |
| `dimLevels` | object | `{L: 'H', W: 'M', ...}` 各维度等级 |
| `winner` | string | 命中的 result tag |
| `similarity` | number | 匹配度 0-100 |
| `resultData` | object | 结果快照（避免后续 result 改动影响历史） |
| `createdAt` | date | |

---

## 四、算分引擎（WEIGHT 模式）

### 4.1 算法流程

1. **维度累积**：遍历答案，按 `dim` 累加 `dimValue`，得到 `scores: {L:5, W:4, ...}`
2. **维度等级化**：每维度总分 → L/M/H 三档
   - `≤ 3` → L
   - `= 4` → M
   - `≥ 5` → H
3. **用户向量**：按 `dimOrder` 顺序，把各维度等级转成 1/2/3 数值序列
4. **遍历 results**：每个 result 的 `pattern`（如 `HHL-LLM-HHH`）解析成向量，计算与用户向量的曼哈顿距离
5. **匹配度**：`similarity = max(0, round((1 - distance / maxDist) * 100))`，`maxDist = dimCount * 2`
6. **排序选优**：距离最小 → 精准命中维度多 → 相似度高
7. **兜底**：若最高匹配度 < 60%，命中 `__fallback__` 结果

### 4.2 代码位置

- 服务端：`cloudfunctions/dna/index.js` 内嵌 `calculateWeight()` 函数
- 前端镜像：`miniprogram/utils/dna-engine.js`（结果页用于展示 dimLevels）

---

## 五、页面设计

### 5.1 大厅页 `dna-hall`

**UI 借鉴 persontest index，古风化：**

- 顶部 Hero 卡：精选测试大图 + 标题 + 「立即挑战」按钮
- 分类筛选条：横向 chip — 全部 / 皇帝 / 诗人 / 武将 / 文臣 / 其他
- 测试卡片列表：纵向列表
  - 左：封面缩略图 100×100
  - 右：标题、描述、tag（题数、参与人数）
- 空状态 + 下拉刷新
- 分享：`onShareAppMessage` / `onShareTimeline`

### 5.2 答题页 `dna-quiz`

**借鉴 persontest quiz：**

- 顶部进度条 + 「第 X 题 / 共 N 题」
- 退出确认弹窗（`onConfirmExit`）
- 题干 + 4 选项
- 选中后 300ms 自动下一题（`setTimeout` + `_navigating` 锁）
- 最后一题：「查看结果」
- 答完调 `dna/submit` → 拿 `recordId` → `wx.redirectTo` 到结果页

### 5.3 结果页 `dna-result`（核心）

**视觉重点 + 分享传播：**

#### Hero 区（全屏冲击力）
- 渐变背景（`themeColor` + 朱砂红/水墨黑）
- 大字「你的历史DNA · 匹配度 92%」
- 人物名（Ma Shan Zheng 书法字体，72rpx+）+ 称号 + 朝代
- 印章装饰

#### 雷达图
- Canvas 2.0（`<canvas type="2d">`）
- 6 维度，金/朱砂配色

#### 内容卡片区
- 人物简介（古纸背景）
- 经典名言（书法字体）
- 为什么是Ta（3 条理由 + 印章）
- 维度分析（6 条渐变进度条）

#### 底部操作栏（固定）
- 主按钮：`open-type="share"` 分享给好友
- 次按钮：**生成海报**（Canvas 2.0 绘制 → 保存相册）
- 三按钮：再测一次 / 测其他 / 找Ta聊天（跳 chat/room）

### 5.4 三层分享

1. **好友/群分享**（`onShareAppMessage`）
   - 标题：`我的历史DNA是【李白·诗仙】匹配度92%！你也来测测？`
   - path: `/pages/discover/dna-result?recordId=xxx`
   - imageUrl: 结果 cover

2. **朋友圈分享**（`onShareTimeline`）
   - 同标题，query 带 `recordId`

3. **海报分享**（Canvas 2.0）
   - 750×1334 竖版
   - 顶部：渐变背景 + 人物立绘占位 + 「我的历史DNA」
   - 中部：人物名 + 称号 + 匹配度 + 6 维雷达缩略
   - 底部：穿越圈品牌 + 小程序码
   - `wx.canvasToTempFilePath` → `wx.saveImageToPhotosAlbum`

---

## 六、云函数 API

### 6.1 `cloudfunctions/dna/index.js`

| action | 入参 | 出参 | 说明 |
|--------|------|------|------|
| `quiz-list` | `{category?}` | `{quizzes: [{...quiz, participantCount}]}` | 测试列表，含参与人数 |
| `quiz-detail` | `{id}` | `{quiz, questions, results}` | 三合一，一次拉全 |
| `submit` | `{quizId, answers}` | `{recordId, winner, similarity, dimLevels, resultData}` | 服务端算分 + 存记录 |
| `get-record` | `{recordId}` | `{record}` | 结果页用 |
| `my-records` | `{page, pageSize}` | `{records, total}` | 我的测试历史 |

### 6.2 `cloudfunctions/memorial/index.js`（新拆出）

| action | 入参 | 出参 | 说明 |
|--------|------|------|------|
| `list` | `{chapter?}` | `{list: [...]}` | 奏折列表 |
| `get` | `{_id}` | `{memorial}` | 单个奏折详情 |
| `decide` | `{memorialId, decision, zhupi}` | `{result}` | 提交决策 |
| `history` | `{limit?}` | `{list}` | 我的批阅历史 |

---

## 七、种子数据（首期 3 个测试）

### 7.1 测试列表

| id | title | 题数 | 结果数 | category | 维度 |
|---|---|---|---|---|---|
| `emperor` | 测测你更像哪位皇帝？ | 8 | 6 | emperor | 谋略(L)/魄力(P)/文采(W)/隐忍(R)/果断(D)/包容(T) |
| `poet` | 测测你更像哪位诗人？ | 6 | 5 | poet | 才情(T)/豪放(H)/婉约(W)/旷达(K)/浪漫(R) |
| `general` | 测测你更像哪位武将？ | 8 | 6 | general | 勇(Y)/谋(M)/忠(Z)/义(I)/烈(L)/稳(S) |

### 7.2 结果映射（关联兰台 figureId）

- 皇帝：刘邦 / 曹操 / 武则天 / 李世民 / 赵匡胤 / 朱元璋
- 诗人：李白 / 杜甫 / 苏轼 / 白居易 / 李清照
- 武将：项羽 / 岳飞 / 关羽 / 韩信 / 卫青 / 霍去病

---

## 八、入口调整

| 文件 | 改动 |
|------|------|
| `app.json` | pages 数组：删 `pages/discover/dna-test`，加 `dna-hall` / `dna-quiz` / `dna-result` |
| `pages/discover/index.js` | quickEntries: `/pages/discover/dna-test` → `/pages/discover/dna-hall` |
| `pages/profile/index.js` | 入口 url 同上 |
| `pages/discover/dna-test.*` | 删除四件套 |

---

## 九、实施顺序

1. **数据层**：重写 `cloudfunctions/dna/index.js` + 拆 `cloudfunctions/memorial/`
2. **大厅页**：`dna-hall` 四件套 + `app.json` 注册 + 入口替换 + 删除旧 `dna-test`
3. **答题页**：`dna-quiz` 四件套 + `utils/dna-engine.js`
4. **结果页**：`dna-result` 四件套（Canvas 2.0 雷达 + 海报生成）+ 3 层分享

---

## 十、风险与注意

- **服务端算分**：必须服务端重算，不信前端 `answers`（项目铁律第五条）
- **Canvas 2.0 迁移**：用 `<canvas type="2d">` + `canvas.getContext('2d')`，废弃 `wx.createCanvasContext`
- **包体积**：3 新页面 + 1 utils，控制在主包内，无需分包
- **种子数据幂等**：首次 `quiz-list` 时 upsert，避免重复插入
- **历史记录兼容**：旧 `dna_results` 集合不迁移，新数据进 `dna_records`
- **memorial 拆分**：保留 dna 云函数中原 memorial 数据常量，迁移到 memorial 云函数；前端 memorial.js 已用 `'memorial'` 调用，拆分后即可正常工作
