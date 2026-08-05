---
name: miniprogram-ci
description: 微信小程序 CI 自动化技能 — 代码预览、上传、npm 打包的脚本生成与 CI/CD 集成。
alwaysApply: false
---

# 小程序 CI 自动化技能 — 穿越圈

## 激活条件

- 自动化预览（生成二维码）
- 自动化上传（提交到微信后台版本管理）
- npm 依赖打包
- GitHub Actions / GitLab CI 集成
- 批量 / 定时发布

## 前置条件

### 1. 安装

```bash
npm install miniprogram-ci --save-dev
```

### 2. 上传密钥

从微信公众平台下载：
- 开发管理 → 开发设置 → 小程序代码上传 → 生成密钥
- 保存为 `private.wx30e49a87f6326f1d.key`
- **绝对不能提交到 Git**，`.gitignore` 加 `*.key`

### 3. IP 白名单

- 微信公众平台 → 开发设置 → IP 白名单
- 本地开发可临时关闭白名单
- CI 环境需添加 runner 出口 IP

---

## 脚本模板

### pack-npm.js（打包 npm 依赖）

```js
#!/usr/bin/env node
const ci = require('miniprogram-ci')
const path = require('path')

const project = new ci.Project({
  appid: process.env.MP_APPID || 'wx30e49a87f6326f1d',
  type: 'miniProgram',
  projectPath: path.resolve(__dirname, '..'),
  ignores: ['node_modules/**/*'],
})

async function main() {
  await ci.packNpm(project, { reporter: console.log })
  console.log('✅ npm 打包完成')
}
main().catch(e => { console.error(e); process.exit(1) })
```

### preview.js（生成预览二维码）

```js
#!/usr/bin/env node
const ci = require('miniprogram-ci')
const fs = require('fs')
const path = require('path')

const CONFIG = {
  appid: process.env.MP_APPID || 'wx30e49a87f6326f1d',
  privateKeyPath: process.env.MP_PRIVATE_KEY_PATH || './private.wx30e49a87f6326f1d.key',
  projectPath: path.resolve(__dirname, '..'),
  robot: Number(process.env.MP_ROBOT || 1),
  outputDir: path.resolve(__dirname, '../ci-artifacts/previews'),
}

async function main() {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true })
  const qrcodePath = path.join(CONFIG.outputDir, `preview-${Date.now()}.png`)

  const project = new ci.Project({
    appid: CONFIG.appid,
    type: 'miniProgram',
    projectPath: CONFIG.projectPath,
    privateKeyPath: CONFIG.privateKeyPath,
    ignores: ['node_modules/**/*'],
  })

  await ci.preview({
    project,
    desc: `Preview by robot ${CONFIG.robot}`,
    setting: { es6: true, es7: true, minify: true, autoPrefixWXSS: true },
    qrcodeFormat: 'image',
    qrcodeOutputDest: qrcodePath,
    robot: CONFIG.robot,
  })

  console.log(`✅ 预览二维码: ${qrcodePath}`)
}
main().catch(e => { console.error(e); process.exit(1) })
```

### upload.js（上传代码）

```js
#!/usr/bin/env node
const ci = require('miniprogram-ci')
const fs = require('fs')
const path = require('path')

const CONFIG = {
  appid: process.env.MP_APPID || 'wx30e49a87f6326f1d',
  privateKeyPath: process.env.MP_PRIVATE_KEY_PATH || './private.wx30e49a87f6326f1d.key',
  projectPath: path.resolve(__dirname, '..'),
  robot: Number(process.env.MP_ROBOT || 1),
  outputDir: path.resolve(__dirname, '../ci-artifacts/uploads'),
}

function parseArgs() {
  const args = process.argv.slice(2)
  const result = { version: null, desc: null, packNpm: false }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version' && args[i + 1]) result.version = args[++i]
    else if (args[i] === '--desc' && args[i + 1]) result.desc = args[++i]
    else if (args[i] === '--pack-npm') result.packNpm = true
  }
  return result
}

async function main() {
  const args = parseArgs()
  if (!args.version) { console.error('❌ --version 必填'); process.exit(1) }
  if (!args.desc) { console.error('❌ --desc 必填'); process.exit(1) }

  const project = new ci.Project({
    appid: CONFIG.appid,
    type: 'miniProgram',
    projectPath: CONFIG.projectPath,
    privateKeyPath: CONFIG.privateKeyPath,
    ignores: ['node_modules/**/*'],
  })

  if (args.packNpm) {
    console.log('📦 执行 npm 构建...')
    await ci.packNpm(project, { reporter: console.log })
  }

  console.log('🚀 上传代码...')
  const result = await ci.upload({
    project,
    version: args.version,
    desc: args.desc,
    robot: CONFIG.robot,
    setting: { es6: true, es7: true, minify: true, autoPrefixWXSS: true },
    onProgressUpdate: console.log,
  })

  fs.mkdirSync(CONFIG.outputDir, { recursive: true })
  const outPath = path.join(CONFIG.outputDir, `upload-${args.version}-${Date.now()}.json`)
  fs.writeFileSync(outPath, JSON.stringify({ success: true, version: args.version, desc: args.desc, result }, null, 2))

  console.log('✅ 上传成功!')
}
main().catch(e => { console.error(e); process.exit(1) })
```

---

## 注册 npm scripts

在 `package.json` 中添加：

```json
{
  "scripts": {
    "ci:pack-npm": "node scripts/pack-npm.js",
    "ci:preview": "node scripts/preview.js",
    "ci:upload": "node scripts/upload.js",
    "ci:upload:npm": "node scripts/upload.js --pack-npm"
  }
}
```

---

## GitHub Actions 示例

```yaml
name: 小程序 CI

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      desc:
        description: '版本描述'
        required: false
        default: ''

jobs:
  upload:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: 生成版本号
        id: version
        run: echo "version=$(date +%Y%m%d).$(git rev-parse HEAD | cut -c1-6)" >> "$GITHUB_OUTPUT"
      - name: 写入密钥
        run: |
          echo "${{ secrets.MP_PRIVATE_KEY }}" > private.key
          chmod 600 private.key
      - name: 上传微信
        env:
          MP_APPID: ${{ secrets.MP_APPID }}
          MP_PRIVATE_KEY_PATH: ./private.key
          MP_PROJECT_PATH: ./
        run: |
          DESC="${{ github.event.inputs.desc }}"
          if [ -z "$DESC" ]; then DESC="CI 自动上传"; fi
          npm run ci:upload -- --version "${{ steps.version.outputs.version }}" --desc "$DESC"
      - if: always()
        run: rm -f private.key
```

---

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `invalid ip` | IP 不在白名单 | 加白名单或临时关闭 |
| `permission denied` | 密钥无效 | 重新生成密钥 |
| timeout / undefined | 跨境网络不稳定 | 加自动重试逻辑 |
| 包体积超限 | 资源太多 | 分包 + 云存储放图片 |

## 相关技能

- `miniprogram-development` — 小程序开发基础
- `miniprogram-automation` — E2E 自动化测试
