const cloud = require('wx-server-sdk')
const axios = require('axios')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ============================================================
// 批量转存：将外部视频/封面 URL 下载后上传到云存储，并更新数据库
// 用法：cloud.callFunction({ name: 'transferVideos', data: { action: 'run' } })
// ============================================================

exports.main = async (event, context) => {
  const { action = 'run' } = event

  switch (action) {
    case 'run': return await transferAll()
    case 'status': return await checkStatus()
    default: return { code: -1, message: '未知 action: ' + action }
  }
}

// 检查有多少条需要转存
async function checkStatus() {
  try {
    const res = await db.collection('videos')
      .where({ status: 'published' })
      .limit(100)
      .get()

    let needTransfer = 0
    let alreadyCloud = 0
    const list = []

    for (const v of res.data) {
      const isExternal = v.videoUrl && v.videoUrl.startsWith('http') && !v.videoUrl.startsWith('cloud://')
      if (isExternal) {
        needTransfer++
        list.push({ _id: v._id, title: v.title, videoUrl: v.videoUrl })
      } else {
        alreadyCloud++
      }
    }

    return {
      code: 0,
      message: `需要转存: ${needTransfer}，已是云存储: ${alreadyCloud}`,
      data: { needTransfer, alreadyCloud, list }
    }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}

// 批量转存主流程
async function transferAll() {
  const results = []
  let success = 0
  let fail = 0
  let skip = 0

  try {
    const res = await db.collection('videos')
      .where({ status: 'published' })
      .limit(100)
      .get()

    for (const video of res.data) {
      // 只转存 http 开头的外部链接
      const needVideo = video.videoUrl && video.videoUrl.startsWith('http') && !video.videoUrl.startsWith('cloud://')
      const needCover = video.coverUrl && video.coverUrl.startsWith('http') && !video.coverUrl.startsWith('cloud://')

      if (!needVideo && !needCover) {
        skip++
        continue
      }

      const item = { _id: video._id, title: video.title, videoOk: false, coverOk: false }

      try {
        // 转存视频
        if (needVideo) {
          const cloudPath = `videos/seed/${video.figureId || 'unknown'}/${video._id}.mp4`
          const fileID = await downloadAndUpload(video.videoUrl, cloudPath)
          if (fileID) {
            item.videoOk = true
            item.videoFileID = fileID
          }
        }

        // 转存封面
        if (needCover) {
          const coverPath = `video-covers/seed/${video.figureId || 'unknown'}/${video._id}.jpg`
          const coverID = await downloadAndUpload(video.coverUrl, coverPath)
          if (coverID) {
            item.coverOk = true
            item.coverFileID = coverID
          }
        }

        // 更新数据库
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
  } catch (e) {
    return { code: -1, message: e.message }
  }

  return {
    code: 0,
    message: `转存完成：成功 ${success}，失败 ${fail}，跳过 ${skip}`,
    data: { success, fail, skip, results }
  }
}

// 下载外部文件并上传到云存储
async function downloadAndUpload(url, cloudPath) {
  const maxRetries = 2
  let lastErr

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      })

      const buffer = Buffer.from(res.data)
      if (buffer.length < 100) {
        throw new Error('下载内容过小，可能不是有效文件')
      }

      const uploadRes = await cloud.uploadFile({
        cloudPath,
        fileContent: buffer
      })

      return uploadRes.fileID
    } catch (e) {
      console.warn(`下载失败 (第${i + 1}次) ${url}:`, e.message)
      lastErr = e
    }
  }

  throw lastErr
}
