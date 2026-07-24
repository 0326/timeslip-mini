---
name: miniprogram-automation
description: 微信小程序自动化测试技能 — 使用 miniprogram-automator 驱动开发者工具做 E2E 测试、截图回归、交互验证。
alwaysApply: false
---

# 小程序自动化测试技能 — 穿越圈

## 激活条件

- E2E 测试 / 回归测试
- 自动截图 / 视觉回归
- 页面跳转与交互自动化
- 持续集成中的小程序测试

## 前置条件

1. **微信开发者工具**已安装（macOS 默认路径：`/Applications/wechatwebdevtools.app`）
2. 开发者工具 → 设置 → 安全设置 → **开启服务端口**
3. `miniprogram-automator` 版本 `>= 0.12.0`

安装：
```bash
npm install miniprogram-automator --save-dev
```

---

## 三种启动方式

| 方式 | 适用场景 | 注意事项 |
|------|---------|---------|
| `automator.launch()` | 全自动，脚本自己启动工具 | 工具必须完全退出，不能有运行实例 |
| CLI v2 + `automator.connect()` | 工具已打开，不想重开 | 先执行 `cli auto` 命令开端口 |
| 直接 `automator.connect()` | 自动化端口已就绪 | 只断连不关工具 |

---

## 独立脚本模板（最常用）

```js
const automator = require('miniprogram-automator')
const path = require('path')
const fs = require('fs')

const CLI_PATH = process.env.WECHAT_DEVTOOLS_CLI ||
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
const PROJECT_PATH = path.resolve(__dirname, '..')  // project.config.json 所在目录
const TARGET_PAGE = '/pages/index/index'
const OUTPUT_DIR = path.resolve(__dirname, '../test-artifacts')

async function main() {
  let miniProgram
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })

    // 启动开发者工具（首次运行需手动点「信任项目」）
    miniProgram = await automator.launch({
      cliPath: CLI_PATH,
      projectPath: PROJECT_PATH,
      timeout: 120000,  // 首次启动留足时间
    })

    // 跳转页面
    const page = await miniProgram.reLaunch(TARGET_PAGE)
    await page.waitFor(2000)  // 等页面稳定

    // 截图
    await miniProgram.screenshot({
      path: path.join(OUTPUT_DIR, 'index-page.png'),
    })
    console.log('✅ 截图完成')

  } finally {
    if (miniProgram) {
      await miniProgram.close()
    }
  }
}

main().catch(e => {
  console.error('❌ 测试失败:', e)
  process.exit(1)
})
```

---

## 核心操作

### 页面跳转

```js
// tabBar 页面
await miniProgram.switchTab('/pages/home/index')

// 普通跳转
const page = await miniProgram.navigateTo('/pages/detail/index?id=123')

// 重定向（清空栈）
const page = await miniProgram.reLaunch('/pages/login/index')
```

### 元素操作

```js
// 查询元素
const btn = await page.$('.submit-btn')
const items = await page.$$('.list-item')

// 点击
await btn.tap()

// 输入
const input = await page.$('.search-input')
await input.input('关键词')

// 读取文本
const text = await (await page.$('.title')).text()

// 读取属性
const src = await (await page.$('image')).attribute('src')
```

### 自定义组件内部元素

> ⚠️ `page.$` **不能穿透**自定义组件边界！

```js
// 错误 ❌
const input = await page.$('form-panel input')  // 选不到

// 正确 ✅
const panel = await page.$('form-panel')        // 先拿到组件
const input = await panel.$('input')             // 再在组件作用域内查
```

### Mock 微信 API

```js
// Mock wx.request
await miniProgram.mockWxMethod('request', (options = {}) => {
  const res = {
    data: { code: 0, list: [{ id: 1, title: 'Mock Post' }] },
    statusCode: 200,
    header: { 'content-type': 'application/json' },
    errMsg: 'request:ok',
  }
  Promise.resolve().then(() => {
    if (typeof options.success === 'function') options.success(res)
    if (typeof options.complete === 'function') options.complete(res)
  })
  return { abort() {}, onHeadersReceived() {}, offHeadersReceived() {}, onChunkReceived() {}, offChunkReceived() {} }
})

// 恢复
await miniProgram.restoreWxMethod('request')
```

### 监听事件

```js
const logs = []
miniProgram.on('console', payload => {
  logs.push(payload)
})

const exceptions = []
miniProgram.on('exception', payload => {
  exceptions.push(payload)
})
```

### 等待策略

```js
// 等选择器出现（首选）
await page.waitFor('.list-item')

// 等条件成立
await page.waitFor(async () => {
  const items = await page.$$('.list-item')
  return items.length > 0
})

// 固定时间兜底
await page.waitFor(1000)
```

---

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `launch` 失败 / 超时 | 工具没关 / 首次需信任项目 | 先 Cmd+Q 完全退出；timeout 设 120s |
| code 31 错误 | automator 版本太旧 | 升级到 `>= 0.12.0` |
| 选不到组件内元素 | 跨组件边界 | 先 `$` 组件再 `$` 内部元素 |
| 截图黑屏 | 页面没渲染完 | 增加等待时间或用 `waitFor` 等选择器 |
| connect 失败 | 自动化端口没开 | 用 CLI v2 先开端口 |

---

## Jest 集成（回归测试套件用）

```js
const automator = require('miniprogram-automator')
const path = require('path')

describe('首页测试', () => {
  let miniProgram
  let page

  beforeAll(async () => {
    miniProgram = await automator.launch({
      projectPath: path.resolve(__dirname, '..'),
      timeout: 120000,
    })
  }, 120000)

  afterAll(async () => {
    if (miniProgram) await miniProgram.close()
  })

  beforeEach(async () => {
    page = await miniProgram.reLaunch('/pages/index/index')
    await page.waitFor(1000)
  })

  test('页面标题正确', async () => {
    const title = await page.$('.page-title')
    expect(await title.text()).toContain('穿越圈')
  })
})
```

---

## 穿越圈测试建议

- **冒烟测试**：首页加载、tabBar 切换、发帖流程、个人中心
- **回归测试**：核心流程（浏览 → 详情 → 点赞 → 评论）
- **截图对比**：关键页面截图做视觉回归（可搭配 `pixelmatch`）
- **CI 集成**：每次 PR 跑 E2E，截图存 artifact

## 相关技能

- `miniprogram-development` — 小程序开发基础
- `miniprogram-ci` — CI/CD 上传发布
