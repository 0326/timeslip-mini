const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const DEFAULT_AVATARS = [
  'https://img.icons8.com/color/96/emperor.png',
  'https://img.icons8.com/color/96/empress.png',
  'https://img.icons8.com/color/96/samurai.png',
  'https://img.icons8.com/color/96/geisha.png'
]

function generateCrossNo() {
  const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return 'CY' + rand
}

function randomAncientName() {
  const prefixes = ['青衫', '墨染', '白衣', '东篱', '南窗', '北辰', '西冷', '东皋']
  const suffixes = ['居士', '山人', '墨客', '散人', '先生', '子', '郎', '君']
  return prefixes[Math.floor(Math.random() * prefixes.length)] + suffixes[Math.floor(Math.random() * suffixes.length)]
}

exports.main = async (event, context) => {
  try {
    const { OPENID, APPID } = cloud.getWXContext()
    const { action } = event

    if (action === 'warmup') {
      return { code: 0, message: 'ok', data: { warmed: true } }
    }

    if (action === 'ensure') {
      const existing = await db.collection('users').where({ _openid: OPENID }).get()
      if (existing.data && existing.data.length > 0) {
        const user = existing.data[0]
        await db.collection('users').doc(user._id).update({
          data: { lastActiveAt: db.serverDate(), updatedAt: db.serverDate() }
        })
        user._openid = OPENID
        return { code: 0, message: 'ok', data: user }
      }

      const newUser = {
        nickName: '穿越客_' + Math.floor(Math.random() * 10000),
        avatarUrl: DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)],
        ancientName: randomAncientName(),
        crossNo: generateCrossNo(),
        points: 10,
        memberLevel: '布衣',
        dnaResult: null,
        achievements: [],
        stats: {
          chatCount: 0,
          letterCount: 0,
          memorialCount: 0,
          momentLikeCount: 0,
          momentCommentCount: 0
        },
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
        lastActiveAt: db.serverDate()
      }

      const addRes = await db.collection('users').add({ data: newUser })
      newUser._id = addRes._id
      newUser._openid = OPENID
      return { code: 0, message: 'ok', data: newUser, isNewUser: true }
    }

    if (action === 'get') {
      const res = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      if (!res.data || res.data.length === 0) {
        return { code: -1, message: '用户不存在', data: null }
      }
      const u = res.data[0]
      u._openid = OPENID
      return { code: 0, message: 'ok', data: u }
    }

    if (action === 'update') {
      const allowedFields = ['nickName', 'avatarUrl', 'ancientName']
      const updateData = { updatedAt: db.serverDate() }
      allowedFields.forEach(f => {
        if (event[f] !== undefined) updateData[f] = event[f]
      })

      const res = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      if (!res.data || res.data.length === 0) {
        return { code: -1, message: '用户不存在', data: null }
      }
      await db.collection('users').doc(res.data[0]._id).update({ data: updateData })
      return { code: 0, message: 'ok', data: { updated: true } }
    }

    if (action === 'addPoints') {
      const points = Math.max(0, Number(event.points) || 0)
      const reason = event.reason || ''
      if (points <= 0) return { code: 0, message: 'ok', data: null }

      const res = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
      if (!res.data || res.data.length === 0) return { code: -1, message: '用户不存在', data: null }

      await db.collection('users').doc(res.data[0]._id).update({
        data: {
          points: _.inc(points),
          updatedAt: db.serverDate(),
          [`stats.${reason}`]: _.inc(1)
        }
      })
      return { code: 0, message: 'ok', data: { added: points } }
    }

    return { code: -1, message: '未知操作: ' + (action || 'none'), data: null }
  } catch (err) {
    console.error('getUser 云函数错误:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
