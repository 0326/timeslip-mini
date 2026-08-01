// 清除所有数据，然后干净地重插100条（按_id逐条删除，因为delete limit只能0/1）
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ENV_ID = 'cloud1-d0gunpzup215cfd87'
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'memorials_100.json'), 'utf8'))

function runTcb(cmd) {
  const result = spawnSync('tcb', cmd, {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    timeout: 120000,
    env: process.env,
    shell: process.platform === 'win32' ? true : false
  })
  if (result.stderr) process.stderr.write(result.stderr)
  return result.stdout
}

// 1. 先查询当前的全部_id，再按_id逐条删除（100条或103条都一样处理）
console.log('=== 查询所有memorials的_id ===')
const queryCmd = [
  'db', 'nosql', 'execute', '-e', ENV_ID,
  '--command', JSON.stringify([{
    TableName: 'memorials',
    CommandType: 'QUERY',
    Command: JSON.stringify({
      find: 'memorials',
      filter: {},
      projection: { _id: 1 },
      limit: 200,
      batchSize: 200
    })
  }])
]
const qOut = runTcb(queryCmd)
console.log('查询结果：', qOut)

// 解析出_ids（从输出中找 _id: 'mem_xxx' 等字段）
let ids = []
const idRegex = /"_id"\s*:\s*"([^"]+)"/g
let m
while ((m = idRegex.exec(qOut)) !== null) ids.push(m[1])
console.log(`找到 ${ids.length} 条待删除`)

if (ids.length > 0) {
  console.log('=== 开始逐条删除 ===')
  let delCount = 0
  for (const id of ids) {
    const delCmd = [
      'db', 'nosql', 'execute', '-e', ENV_ID,
      '--command', JSON.stringify([{
        TableName: 'memorials',
        CommandType: 'DELETE',
        Command: JSON.stringify({
          delete: 'memorials',
          deletes: [{ q: { _id: id }, limit: 1 }]
        })
      }])
    ]
    runTcb(delCmd)
    delCount++
    if (delCount % 20 === 0) console.log(`已删除 ${delCount}/${ids.length} ...`)
  }
  console.log(`删除完成，共${delCount}条`)
}

// 2. 验证删除干净
console.log('=== 验证删除后count ===')
const cnt0 = runTcb([
  'db', 'nosql', 'execute', '-e', ENV_ID,
  '--command', JSON.stringify([{
    TableName: 'memorials',
    CommandType: 'COMMAND',
    Command: JSON.stringify({ count: 'memorials', query: {} })
  }])
])
console.log('count after delete:', cnt0)

// 3. 重插100条
const BATCH_SIZE = 20
console.log(`\n=== 分批插入100条（每批${BATCH_SIZE}） ===`)
for (let i = 0; i < data.length; i += BATCH_SIZE) {
  const batch = data.slice(i, i + BATCH_SIZE)
  console.log(`批次 ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(data.length/BATCH_SIZE)}：${batch.length}条`)
  const insCmd = [
    'db', 'nosql', 'execute', '-e', ENV_ID,
    '--command', JSON.stringify([{
      TableName: 'memorials',
      CommandType: 'INSERT',
      Command: JSON.stringify({
        insert: 'memorials',
        documents: batch,
        ordered: false
      })
    }])
  ]
  const out = runTcb(insCmd)
  // 简单提取 n 值
  const nMatch = out.match(/"n"\s*:\s*\{\s*"\$number(Int|Long)"\s*:\s*"(\d+)"\s*\}/)
  console.log('  插入成功数:', nMatch ? nMatch[2] : '(未识别)')
}

// 4. 最终验证 count=100
console.log('\n=== 最终验证 ===')
const finalOut = runTcb([
  'db', 'nosql', 'execute', '-e', ENV_ID,
  '--command', JSON.stringify([{
    TableName: 'memorials',
    CommandType: 'COMMAND',
    Command: JSON.stringify({ count: 'memorials', query: {} })
  }])
])
console.log('最终输出:', finalOut)
const finalN = finalOut.match(/"n"\s*:\s*\{\s*"\$number(Int|Long)"\s*:\s*"(\d+)"\s*\}/)
if (finalN && finalN[2] === '100') {
  console.log('\n✅ 验证通过！memorials总数 = 100')
} else {
  console.log('\n⚠️  验证失败，期望100条')
}

// 5. 抽样验证：查一下5种分类的数量
console.log('\n=== 分类数量抽样验证 ===')
const types = ['奏事折', '密折', '请安折', '谢恩折', '奇葩折']
for (const t of types) {
  const tOut = runTcb([
    'db', 'nosql', 'execute', '-e', ENV_ID,
    '--command', JSON.stringify([{
      TableName: 'memorials',
      CommandType: 'COMMAND',
      Command: JSON.stringify({ count: 'memorials', query: { type: t } })
    }])
  ])
  const nm = tOut.match(/"n"\s*:\s*\{\s*"\$number(Int|Long)"\s*:\s*"(\d+)"\s*\}/)
  console.log(`${t}：${nm ? nm[2] : '-'}条`)
}
