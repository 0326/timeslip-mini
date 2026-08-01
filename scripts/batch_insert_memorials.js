// 分批把 memorials_100.json 插入到云数据库
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const BATCH_SIZE = 20
const ENV_ID = 'cloud1-d0gunpzup215cfd87'
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'memorials_100.json'), 'utf8'))
console.log(`总数: ${data.length}，每批: ${BATCH_SIZE}，批数: ${Math.ceil(data.length / BATCH_SIZE)}`)

function runTcb(cmd) {
  // 在 timeslip-mini 目录执行，确保 tcb 配置读取
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

// 1. 先清空旧数据（先 count，再按 limit 多次删除）
function clearOld() {
  console.log('\n=== 步骤1：查询并清空 memorials 旧数据 ===')
  const countCmd = [
    'db', 'nosql', 'execute',
    '-e', ENV_ID,
    '--command', JSON.stringify([{
      TableName: 'memorials',
      CommandType: 'COMMAND',
      Command: JSON.stringify({ count: 'memorials', query: {} })
    }])
  ]
  const out = runTcb(countCmd)
  console.log('count out:', out)
  console.log('count:', out)
  // 循环删除，每次按 limit 删100条，10次机会
  for (let i = 0; i < 5; i++) {
    const delCmd = [
      'db', 'nosql', 'execute',
      '-e', ENV_ID,
      '--command', JSON.stringify([{
        TableName: 'memorials',
        CommandType: 'DELETE',
        Command: JSON.stringify({
          delete: 'memorials',
          deletes: [{ q: {}, limit: 100 }]
        })
      }])
    ]
    const delOut = runTcb(delCmd)
    console.log('删除输出：', delOut)
  }
}

clearOld()

// 2. 分批插入
console.log('\n=== 步骤2：分批插入 100 条数据 ===')
for (let i = 0; i < data.length; i += BATCH_SIZE) {
  const batch = data.slice(i, i + BATCH_SIZE)
  console.log(`\n批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(data.length / BATCH_SIZE)}：插入 ${batch.length} 条 (index ${i}-${i + batch.length - 1})`)
  const insertCmd = [
    'db', 'nosql', 'execute',
    '-e', ENV_ID,
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
  const out = runTcb(insertCmd)
  console.log('插入结果：', out)
}

// 3. 最终count验证
console.log('\n=== 步骤3：验证最终总数 ===')
const finalCount = runTcb([
  'db', 'nosql', 'execute',
  '-e', ENV_ID,
  '--command', JSON.stringify([{
    TableName: 'memorials',
    CommandType: 'COMMAND',
    Command: JSON.stringify({ count: 'memorials', query: {} })
  }])
])
console.log('最终统计：', finalCount)
