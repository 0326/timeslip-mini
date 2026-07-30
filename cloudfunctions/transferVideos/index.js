const cloud = require('wx-server-sdk')
const https = require('https')
const http = require('http')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ============================================================
// 视频转存：将外部视频/封面下载后上传到云存储，并更新数据库
// 使用原生 http/https 下载，避免 axios 兼容性问题
// ============================================================

exports.main = async (event, context) => {
  const { action = 'transferBatch' } = event

  switch (action) {
    case 'transferBatch': return await transferBatch(event)
    case 'transferOne': return await transferOne(event)
    case 'status': return await checkStatus()
    case 'test': return await testConnection()
    default: return { code: -1, message: '未知 action: ' + action }
  }
}

// 测试外部连接是否可用
async function testConnection() {
  const url = 'https://assets.mixkit.co/videos/20806/20806-720.mp4'
  try {
    const buffer = await downloadFile(url)
    return { code: 0, message: `下载成功，大小: ${(buffer.length / 1024).toFixed(1)}KB`, data: { size: buffer.length } }
  } catch (e) {
    return { code: -1, message: '下载失败: ' + e.message }
  }
}

// 检查转存状态
async function checkStatus() {
  try {
    const res = await db.collection('videos')
      .where({ status: 'published' })
      .limit(100)
      .get()

    let needTransfer = 0
    let alreadyCloud = 0
    let emptyUrl = 0
    const list = []

    for (const v of res.data) {
      if (!v.videoUrl || v.videoUrl === '') {
        emptyUrl++
      } else if (v.videoUrl.startsWith('cloud://')) {
        alreadyCloud++
      } else if (v.videoUrl.startsWith('http')) {
        needTransfer++
        list.push({ _id: v._id, title: v.title })
      }
    }

    return {
      code: 0,
      message: `需转存: ${needTransfer}，已云存储: ${alreadyCloud}，空URL: ${emptyUrl}`,
      data: { needTransfer, alreadyCloud, emptyUrl, list }
    }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// 分批转存：每次最多处理 batchSize 条（默认2条），避免超时
async function transferBatch(event) {
  const batchSize = Math.min(event.batchSize || 2, 3)
  const results = []
  let success = 0
  let fail = 0

  try {
    const res = await db.collection('videos')
      .where({ status: 'published' })
      .limit(100)
      .get()

    const needTransfer = res.data.filter(v =>
      v.videoUrl && v.videoUrl.startsWith('http') && !v.videoUrl.startsWith('cloud://')
    )
    const batch = needTransfer.slice(0, batchSize)
    const remaining = needTransfer.length - batch.length

    for (const video of batch) {
      const item = { _id: video._id, title: video.title, videoOk: false, coverOk: false }

      try {
        if (video.videoUrl && video.videoUrl.startsWith('http')) {
          const cloudPath = `videos/seed/${video.figureId || 'unknown'}/${video._id}.mp4`
          const fileID = await downloadAndUpload(video.videoUrl, cloudPath)
          if (fileID) {
            item.videoOk = true
            item.videoFileID = fileID
          }
        }

        if (video.coverUrl && video.coverUrl.startsWith('http')) {
          const coverPath = `video-covers/seed/${video.figureId || 'unknown'}/${video._id}.jpg`
          const coverID = await downloadAndUpload(video.coverUrl, coverPath)
          if (coverID) {
            item.coverOk = true
            item.coverFileID = coverID
          }
        }

        const updateData = {}
        if (item.videoFileID) updateData.videoUrl = item.videoFileID
        if (item.coverFileID) updateData.coverUrl = item.coverFileID

        if (Object.keys(updateData).length > 0) {
          await db.collection('videos').doc(video._id).update({ data: updateData })
          success++
        } else {
          fail++
        }
      } catch (e) {
        console.error(`转存失败 ${video._id} (${video.title}):`, e.message)
        item.error = e.message
        fail++
      }

      results.push(item)
    }

    return {
      code: 0,
      message: `本批完成：成功 ${success}，失败 ${fail}，剩余 ${remaining}`,
      data: { success, fail, remaining, results }
    }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// 单条转存
async function transferOne(event) {
  const { videoId } = event
  if (!videoId) return { code: -1, message: '缺少 videoId' }

  try {
    const res = await db.collection('videos').doc(videoId).get()
    const video = res.data
    if (!video) return { code: -1, message: '视频不存在' }

    const result = { _id: videoId, title: video.title, videoOk: false, coverOk: false }

    if (video.videoUrl && video.videoUrl.startsWith('http')) {
      const cloudPath = `videos/seed/${video.figureId || 'unknown'}/${video._id}.mp4`
      const fileID = await downloadAndUpload(video.videoUrl, cloudPath)
      if (fileID) {
        result.videoOk = true
        result.videoFileID = fileID
      }
    }

    if (video.coverUrl && video.coverUrl.startsWith('http')) {
      const coverPath = `video-covers/seed/${video.figureId || 'unknown'}/${video._id}.jpg`
      const coverID = await downloadAndUpload(video.coverUrl, coverPath)
      if (coverID) {
        result.coverOk = true
        result.coverFileID = coverID
      }
    }

    const updateData = {}
    if (result.videoFileID) updateData.videoUrl = result.videoFileID
    if (result.coverFileID) updateData.coverUrl = result.coverFileID

    if (Object.keys(updateData).length > 0) {
      await db.collection('videos').doc(videoId).update({ data: updateData })
    }

    return { code: 0, message: '转存成功', data: result }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// 下载并上传
async function downloadAndUpload(url, cloudPath) {
  const buffer = await downloadFile(url)
  if (buffer.length < 100) {
    throw new Error('文件过小，可能不是有效文件')
  }

  const uploadRes = await cloud.uploadFile({
    cloudPath,
    fileContent: buffer
  })

  return uploadRes.fileID
}

// 使用原生 http/https 下载文件
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const timeout = 15000

    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': '*/*'
      },
      timeout: timeout
    }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location).then(resolve).catch(reject)
        return
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }

      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', (e) => reject(e))
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('下载超时'))
    })

    req.on('error', (e) => reject(e))
  })
}
