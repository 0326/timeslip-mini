const cloud = require('wx-server-sdk')
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ============================================================
// 种子视频映射表
// videoFile: 打包在代码包内的本地视频文件（videos/ 目录下）
// videoUrl: 外部视频 URL（云函数运行时下载，用于过大的文件）
// coverFile: 打包在代码包内的封面图（covers/ 目录下）
// records: 数据库中需要更新的记录，按 figureId + title 匹配
// ============================================================
const SEED_MAP = [
  {
    key: 'libai_jiangjinjiu',
    videoFile: 'libai_jiangjinjiu.mp4',
    coverFile: 'libai_jiangjinjiu.jpg',
    records: [
      { figureId: 'fig-libai', title: '将进酒' },
      { figureId: 'fig-simqian', title: '史记自序' }  // 复用同一个视频
    ]
  },
  {
    key: 'libai_wanglushan',
    videoFile: 'libai_wanglushan.mp4',
    coverFile: 'libai_wanglushan.jpg',
    records: [{ figureId: 'fig-libai', title: '望庐山瀑布' }]
  },
  {
    key: 'libai_zengwanglun',
    videoFile: 'libai_zengwanglun.mp4',
    coverFile: 'libai_zengwanglun.jpg',
    records: [{ figureId: 'fig-libai', title: '赠汪伦' }]
  },
  {
    key: 'sushi_chibi',
    videoFile: 'sushi_chibi.mp4',
    coverFile: 'sushi_chibi.jpg',
    records: [{ figureId: 'fig-sushi', title: '赤壁怀古' }]
  },
  {
    key: 'sushi_dongporou',
    videoFile: 'sushi_dongporou.mp4',
    coverFile: 'sushi_dongporou.jpg',
    records: [{ figureId: 'fig-sushi', title: '东坡肉秘方' }]
  },
  {
    key: 'zhugeliang_chushibiao',
    videoFile: 'zhugeliang_chushibiao.mp4',
    coverFile: 'zhugeliang_chushibiao.jpg',
    records: [{ figureId: 'fig-zhugeliang', title: '出师表' }]
  },
  {
    key: 'zhugeliang_kongchengji',
    videoFile: 'zhugeliang_kongchengji.mp4',
    coverFile: 'zhugeliang_kongchengji.jpg',
    records: [{ figureId: 'fig-zhugeliang', title: '空城计' }]
  },
  {
    key: 'wuzetian_wuzibei',
    videoFile: 'wuzetian_wuzibei.mp4',
    coverFile: 'wuzetian_wuzibei.jpg',
    records: [{ figureId: 'fig-wuzetian', title: '无字碑' }]
  },
  // 以下两个为大视频（各约15MB），代码包放不下，运行时从 archive.org 下载
  {
    key: 'liubang_dafengge',
    videoUrl: 'https://archive.org/download/ChinaCli1935/ChinaCli1935_512kb.mp4',
    coverFile: 'liubang_dafengge.jpg',
    records: [{ figureId: 'fig-liubang', title: '大风歌' }]
  },
  {
    key: 'liubang_hongmenyan',
    videoUrl: 'https://archive.org/download/6ca-65f-16-e-7b-5-4d-2b-824d-be-4f-1cef-63e-0/6ca65f16-e7b5-4d2b-824d-be4f1cef63e0.mp4',
    coverFile: 'liubang_hongmenyan.jpg',
    records: [{ figureId: 'fig-liubang', title: '鸿门宴惊魂' }]
  }
]

exports.main = async (event, context) => {
  const results = []
  let successCount = 0
  let skipCount = 0
  let failCount = 0

  for (const seed of SEED_MAP) {
    const item = { key: seed.key, records: seed.records.length, videoUploaded: false, coverUploaded: false, updatedDocs: 0 }

    try {
      // 1. 获取视频 Buffer
      let videoBuffer
      if (seed.videoFile) {
        // 从本地代码包读取
        const videoPath = path.join(__dirname, 'videos', seed.videoFile)
        if (!fs.existsSync(videoPath)) {
          throw new Error(`本地视频文件不存在: ${seed.videoFile}`)
        }
        videoBuffer = fs.readFileSync(videoPath)
        item.videoSource = 'local'
      } else if (seed.videoUrl) {
        // 从外部 URL 下载
        videoBuffer = await downloadFile(seed.videoUrl, 40000)
        item.videoSource = 'download'
      } else {
        throw new Error('无视频来源')
      }

      if (!videoBuffer || videoBuffer.length < 1024) {
        throw new Error('视频内容无效或过小')
      }
      item.videoSize = (videoBuffer.length / 1024 / 1024).toFixed(2) + 'MB'

      // 2. 上传视频到云存储
      const videoCloudPath = `videos/seed/${seed.key}.mp4`
      const videoUpload = await cloud.uploadFile({
        cloudPath: videoCloudPath,
        fileContent: videoBuffer
      })
      item.videoFileID = videoUpload.fileID
      item.videoUploaded = true

      // 释放内存
      videoBuffer = null

      // 3. 获取封面 Buffer（从本地读取，封面都很小）
      let coverFileID = ''
      if (seed.coverFile) {
        const coverPath = path.join(__dirname, 'covers', seed.coverFile)
        if (fs.existsSync(coverPath)) {
          const coverBuffer = fs.readFileSync(coverPath)
          if (coverBuffer.length > 100) {
            const coverCloudPath = `video-covers/seed/${seed.key}.jpg`
            const coverUpload = await cloud.uploadFile({
              cloudPath: coverCloudPath,
              fileContent: coverBuffer
            })
            coverFileID = coverUpload.fileID
            item.coverUploaded = true
            item.coverSize = (coverBuffer.length / 1024).toFixed(1) + 'KB'
          }
        }
      }

      // 4. 更新数据库中匹配的记录
      for (const record of seed.records) {
        try {
          const res = await db.collection('videos').where({
            figureId: record.figureId,
            title: record.title
          }).get()

          if (res.data.length === 0) {
            // 没找到匹配记录也不报错，可能是数据问题
            continue
          }

          for (const doc of res.data) {
            const updateData = { videoUrl: videoUpload.fileID }
            if (coverFileID) {
              updateData.coverUrl = coverFileID
            }
            await db.collection('videos').doc(doc._id).update({ data: updateData })
            item.updatedDocs++
          }
        } catch (e) {
          console.error(`更新数据库记录失败 ${record.figureId}/${record.title}:`, e.message)
        }
      }

      if (item.updatedDocs > 0) {
        successCount++
      } else {
        skipCount++
      }
    } catch (e) {
      console.error(`处理 ${seed.key} 失败:`, e.message)
      item.error = e.message
      failCount++
    }

    results.push(item)
  }

  return {
    code: 0,
    message: `上传完成：成功 ${successCount}，跳过 ${skipCount}，失败 ${failCount}`,
    data: { successCount, skipCount, failCount, results }
  }
}

// 使用原生 https 下载文件
function downloadFile(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const timeout = timeoutMs || 30000

    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': '*/*'
      },
      timeout: timeout
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, timeoutMs).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }

      const chunks = []
      let totalSize = 0
      res.on('data', (chunk) => {
        chunks.push(chunk)
        totalSize += chunk.length
      })
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        resolve(buffer)
      })
      res.on('error', (e) => reject(e))
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('下载超时'))
    })
    req.on('error', (e) => reject(e))
  })
}
