// 从 initDB/index.js 提取 MEMORIAL_SEED_QING 数组并导出为 JSON 文件
const fs = require('fs')
const path = require('path')

const initDBPath = path.join(__dirname, '..', 'cloudfunctions', 'initDB', 'index.js')
const outPath = path.join(__dirname, 'memorials_100.json')

const code = fs.readFileSync(initDBPath, 'utf8')

// 匹配 MEMORIAL_SEED_QING = [ ... ] 直到下一个常量定义之前
const start = code.indexOf('const MEMORIAL_SEED_QING = [')
if (start === -1) {
  console.error('未找到 MEMORIAL_SEED_QING')
  process.exit(1)
}

// 找到对应的闭合 ] —— 下一行是 const ACHIEVEMENT_SEED
const endMarker = ']' + '\n' + 'const ACHIEVEMENT_SEED = ['
const end = code.indexOf(endMarker, start)
if (end === -1) {
  console.error('未找到数组结束位置')
  process.exit(1)
}

// 截取数组内容，提取 [ ... ] 部分
const arrStart = code.indexOf('[', start)
const arrEnd = end + 1
const arrCode = code.slice(arrStart, arrEnd)

// 用 Function 构造函数安全解析（JSON.parse解析不了，因为属性名是单引号且无引号）
// 但这里有一个问题：属性名不总是单引号包裹，所以需要转换为有效的 JS 表达式
// 构造一个沙箱求值
const fn = new Function('return ' + arrCode)
let data
try {
  data = fn()
} catch (e) {
  console.error('解析失败：', e.message)
  // 打印错误位置附近
  process.exit(1)
}

console.log('提取条数：', data.length)
fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8')
console.log('已写入：', outPath)
