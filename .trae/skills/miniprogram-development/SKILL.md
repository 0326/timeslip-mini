---
name: miniprogram-development
description: 微信小程序开发技能 — 项目结构、页面组件、配置、wx.cloud 云开发集成、调试预览发布。用于创建/修改小程序页面、组件、路由、项目配置，或处理微信开发者工具工作流。
alwaysApply: false
---

# 小程序开发技能 — 穿越圈

## 激活条件

用户提出以下任一需求时，先读本 skill：
- 创建 / 修改小程序页面或组件
- 调整项目结构、`app.json`、`project.config.json`
- 涉及 `wx.cloud`、云开发、云函数调用
- 预览、上传、发布小程序
- 小程序运行时问题排查

## 项目上下文

- 项目路径：`timeslip-mini/`
- 小程序根：`miniprogram/`
- 云函数根：`cloudfunctions/`
- AppID：`wx515b70782ea1aaf3`
- 云环境 ID：`cloud1-d0gunpzup215cfd87`
- 技术栈：原生小程序 + 微信云开发

## 核心规则

### 1. 项目结构

- 页面放在 `miniprogram/pages/<page-name>/`，四件套齐全：`index.js` / `index.json` / `index.wxml` / `index.wxss`
- 组件放在 `miniprogram/components/<component-name>/`，`index.json` 必须设 `{ "component": true }`
- 新增页面后必须在 `app.json` 的 `pages` 数组中注册
- tabBar 页面只能用 `wx.switchTab` 跳转

### 2. 云开发集成

- 在 `app.js` 的 `onLaunch` 中用 `wx.cloud.init({ env, traceUser: true })` 初始化
- 云环境 ID：`cloud1-d0gunpzup215cfd87`
- 调用云函数：优先使用 `utils/cloudRequest.js` 的 `requestCloud(name, action, data, config)`
- 云函数返回格式：`{ code: 0, message: 'ok', data: ... }`
- 数据库操作：简单 CRUD 直接用 `wx.cloud.database()`，复杂操作走云函数

### 3. 页面开发流程

1. 创建页面目录 + 四件套
2. 在 `app.json` 的 `pages` 中注册
3. 在页面 `.json` 中配置 `navigationBarTitleText` 等
4. 在页面 `.js` 中写 `Page({ data, onLoad, ... })`
5. 在 `.wxml` 中写结构，`.wxss` 中写样式

### 4. 常见坑

- 不要用 Web 思维写小程序：没有 DOM、没有 window、不能用 `document.querySelector`
- 自定义组件样式默认隔离（`styleIsolation: "isolated"`），需要外部样式传入用 `externalClasses`
- 页面间传参用 URL query，不要用全局变量存瞬时状态
- `setData` 是异步的，频繁调用会影响性能，尽量合并更新
- 图片资源不要放太多在包里，走云存储

### 5. 调试与预览

- 首选：微信开发者工具打开项目（`project.config.json` 所在目录）
- 真机调试：开发者工具 → 真机调试 → 扫码
- 预览：开发者工具 → 预览 → 扫码
- 自动化 CI 预览 / 上传：使用 `miniprogram-ci` skill

## 相关技能

- `auth-wechat-miniprogram` — 用户身份 / OPENID / 鉴权
- `cloudbase-document-database-in-wechat-miniprogram` — 数据库 CRUD / 分页 / 聚合
- `cloud-functions` — 云函数开发 / 部署 / 日志
- `miniprogram-ci` — CI 自动化预览 / 上传
- `miniprogram-automation` — E2E 自动化测试
