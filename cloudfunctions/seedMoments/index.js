const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const MOMENT_SEED = [
  {
    seedKey: 'libai',
    figureId: 'fig-libai',
    name: '李白',
    figureTitle: '诗仙 · 供奉翰林',
    dynasty: '唐',
    avatar: '',
    content: '今天游了趟庐山，瀑布真壮观，作诗一首：「日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。」大家觉得怎么样？',
    images: [
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600',
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600',
      'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=600',
      'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=600',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
      'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=600',
      'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=600',
      'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600',
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600'
    ],
    historicalEvent: '作品出处：《望庐山瀑布》',
    historicalDate: '盛唐 · 开元年间',
    likes: [
      { openid: 'seed_dufu', name: '杜甫', figureId: 'fig-dufu' },
      { openid: 'seed_wangwei', name: '王维', figureId: 'fig-wangwei' },
      { openid: 'seed_menghaoran', name: '孟浩然', figureId: 'fig-menghaoran' }
    ],
    createdAtOffset: -2
  },
  {
    seedKey: 'sushi',
    figureId: 'fig-sushi',
    name: '苏轼',
    figureTitle: '东坡居士 · 龙图阁学士',
    dynasty: '宋',
    avatar: '',
    content: '黄州好猪肉，价贱如泥土。贵者不肯吃，贫者不解煮。慢着火，少着水，火候足时它自美。每日早来打一碗，饱得自家君莫管。',
    images: [
      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600'
    ],
    historicalEvent: '作品出处：《猪肉颂》',
    historicalDate: '北宋 · 黄州谪居',
    likes: [
      { openid: 'seed_liqingzhao', name: '李清照', figureId: 'fig-liqingzhao' },
      { openid: 'seed_huangtingjian', name: '黄庭坚', figureId: 'fig-huangtingjian' }
    ],
    createdAtOffset: -0.25
  },
  {
    seedKey: 'liqingzhao',
    figureId: 'fig-liqingzhao',
    name: '李清照',
    figureTitle: '易安居士 · 婉约宗主',
    dynasty: '宋',
    avatar: '',
    content: '昨夜雨疏风骤，浓睡不消残酒。试问卷帘人，却道海棠依旧。知否？知否？应是绿肥红瘦。',
    images: [
      'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600',
      'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600',
      'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=600',
      'https://images.unsplash.com/photo-1509223197845-458d87318791?w=600'
    ],
    historicalEvent: '作品出处：《如梦令·昨夜雨疏风骤》',
    historicalDate: '北宋末年 · 汴京',
    likes: [
      { openid: 'seed_xinqiji', name: '辛弃疾', figureId: 'fig-xinqiji' }
    ],
    createdAtOffset: -5
  },
  {
    seedKey: 'dufu',
    figureId: 'fig-dufu',
    name: '杜甫',
    figureTitle: '诗圣 · 检校工部员外郎',
    dynasty: '唐',
    avatar: '',
    content: '两个黄鹂鸣翠柳，一行白鹭上青天。窗含西岭千秋雪，门泊东吴万里船。',
    images: [
      'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=600',
      'https://images.unsplash.com/photo-1476673160081-cf065607f449?w=600'
    ],
    historicalEvent: '作品出处：《绝句四首·其三》',
    historicalDate: '中唐 · 成都草堂',
    likes: [
      { openid: 'seed_libai2', name: '李白', figureId: 'fig-libai' },
      { openid: 'seed_gushi', name: '高适', figureId: 'fig-gaoshi' }
    ],
    createdAtOffset: -1
  },
  {
    seedKey: 'yuefei',
    figureId: 'fig-yuefei',
    name: '岳飞',
    figureTitle: '岳武穆 · 荆湖北路帅司',
    dynasty: '宋',
    avatar: '',
    content: '靖康耻，犹未雪；臣子恨，何时灭！驾长车，踏破贺兰山缺。壮志饥餐胡虏肉，笑谈渴饮匈奴血。待从头、收拾旧山河，朝天阙。',
    images: [],
    historicalEvent: '作品出处：《满江红·怒发冲冠》',
    historicalDate: '南宋 · 抗金前线',
    likes: [
      { openid: 'seed_xinqiji2', name: '辛弃疾', figureId: 'fig-xinqiji' },
      { openid: 'seed_wangshipeng', name: '王十朋', figureId: 'fig-wangshipeng' },
      { openid: 'seed_huyin', name: '胡寅', figureId: 'fig-huyin' },
      { openid: 'seed_liugang', name: '刘纲', figureId: 'fig-liugang' }
    ],
    createdAtOffset: -0.08
  }
]

const COMMENT_SEED = {
  libai: [
    {
      content: '太白此诗，气势如虹！"飞流直下三千尺，疑是银河落九天"真乃千古名句。',
      name: '杜甫',
      figureId: 'fig-dufu',
      figureTitle: '诗圣 · 检校工部员外郎',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 12
    },
    {
      content: '多谢子美兄谬赞！兄台「三吏三别」方为诗史也。',
      name: '李白',
      figureId: 'fig-libai',
      figureTitle: '诗仙 · 供奉翰林',
      dynasty: '唐',
      avatar: '',
      replyTo: 'seed_dufu',
      replyName: '杜甫',
      hoursAgo: 10
    },
    {
      content: '此景、此情、此诗，入画也！当以泼墨山水配之。',
      name: '王维',
      figureId: 'fig-wangwei',
      figureTitle: '诗佛 · 尚书右丞',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 8
    }
  ],
  sushi: [
    {
      content: '东坡先生的猪肉颂，真乃人间烟火也。慢着火少着水，妙哉妙哉！下次黄州聚首，定当讨教一碗。',
      name: '李清照',
      figureId: 'fig-liqingzhao',
      figureTitle: '易安居士 · 婉约宗主',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 4
    },
    {
      content: '哈哈，易安妹子若是来，我亲自下厨。除了猪肉，我这还有东坡羹、东坡肘子，管够！',
      name: '苏轼',
      figureId: 'fig-sushi',
      figureTitle: '东坡居士 · 龙图阁学士',
      dynasty: '宋',
      avatar: '',
      replyTo: 'seed_liqingzhao',
      replyName: '李清照',
      hoursAgo: 2
    }
  ],
  liqingzhao: [
    {
      content: '"绿肥红瘦"，四字道尽暮春心事。易安此阙，当为婉约压卷之作。',
      name: '辛弃疾',
      figureId: 'fig-xinqiji',
      figureTitle: '词中之龙 · 浙东安抚使',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 36
    }
  ],
  dufu: [
    {
      content: '子美此句，画面感极强！两个黄鹂、一行白鹭、西岭雪、东吴船——四景并置，时空交汇，妙！',
      name: '李白',
      figureId: 'fig-libai',
      figureTitle: '诗仙 · 供奉翰林',
      dynasty: '唐',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 20
    }
  ],
  yuefei: [
    {
      content: '将军豪情，令人敬仰！收复中原，还我河山——我辈虽为文人，亦愿执笔从戎，随将军左右！',
      name: '辛弃疾',
      figureId: 'fig-xinqiji',
      figureTitle: '词中之龙 · 浙东安抚使',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 1
    },
    {
      content: '鹏举兄壮志凌云，精忠报国之心，日月可鉴！吾皇若能重用将军，何愁中原不复！',
      name: '陆游',
      figureId: 'fig-luyou',
      figureTitle: '放翁 · 宝章阁待制',
      dynasty: '宋',
      avatar: '',
      replyTo: '',
      replyName: '',
      hoursAgo: 0.5
    }
  ]
}

exports.main = async (event, context) => {
  const { force = false } = event || {}
  const targetFigureIds = MOMENT_SEED.map(m => m.figureId)

  try {
    const existing = await db.collection('moments').where({
      figureId: _.in(targetFigureIds)
    }).limit(1).get()

    if (existing.data.length && !force) {
      return {
        code: 0,
        message: '测试数据已存在（fig-libai 等），使用 { force: true } 删除旧数据后重新插入'
      }
    }

    if (force) {
      const clearMoments = await db.collection('moments').where({
        figureId: _.in(targetFigureIds)
      }).remove()
      console.log('Clear moments:', clearMoments.stats.removed)
      try {
        const clearComments = await db.collection('moment_comments').where({
          momentId: db.RegExp({ regexp: '.*', options: 'i' })
        }).remove()
        const all = await db.collection('moment_comments').where({
          figureId: _.in(['fig-dufu', 'fig-wangwei', 'fig-liqingzhao', 'fig-xinqiji', 'fig-libai', 'fig-sushi', 'fig-luyou'])
        }).get()
        const idsToRemove = all.data.map(c => c._id)
        if (idsToRemove.length) {
          for (const id of idsToRemove) {
            try { await db.collection('moment_comments').doc(id).remove() } catch (_) {}
          }
        }
        console.log('Clear comments related:', all.data.length)
      } catch (e) {
        console.warn('Clear comments warn:', e.message)
      }
    }

    const insertedIds = []
    for (let i = 0; i < MOMENT_SEED.length; i++) {
      const m = MOMENT_SEED[i]
      const now = Date.now()
      const createdAtTs = now + (m.createdAtOffset || 0) * 86400000
      const doc = {
        figureId: m.figureId,
        name: m.name,
        figureTitle: m.figureTitle,
        dynasty: m.dynasty,
        avatar: m.avatar || '',
        content: m.content,
        images: Array.isArray(m.images) ? m.images.slice(0, 9) : [],
        historicalEvent: m.historicalEvent || '',
        historicalDate: m.historicalDate || '',
        location: '',
        visibility: 'public',
        likes: Array.isArray(m.likes) ? m.likes : [],
        commentCount: 0,
        createdAt: new Date(createdAtTs),
        updatedAt: new Date(now)
      }
      const r = await db.collection('moments').add({ data: doc })
      insertedIds.push({
        momentId: r._id,
        seedKey: m.seedKey,
        comments: COMMENT_SEED[m.seedKey] || [],
        createdAtTs
      })
    }

    let insertedCommentCount = 0
    for (let i = 0; i < insertedIds.length; i++) {
      const { momentId, comments, createdAtTs } = insertedIds[i]
      for (let j = 0; j < comments.length; j++) {
        const c = comments[j]
        const hoursAgo = typeof c.hoursAgo === 'number' ? c.hoursAgo : 1
        const doc = {
          momentId,
          name: c.name,
          avatar: c.avatar || '',
          dynasty: c.dynasty || '',
          figureId: c.figureId || '',
          figureTitle: c.figureTitle || '',
          content: c.content,
          replyTo: c.replyTo || '',
          replyName: c.replyName || '',
          authorSnapshot: {
            name: c.name,
            avatar: c.avatar || '',
            openid: 'seed_' + (c.figureId || ('u' + Math.random().toString(36).slice(2, 6)))
          },
          likes: [],
          createdAt: new Date(createdAtTs + hoursAgo * 3600000)
        }
        await db.collection('moment_comments').add({ data: doc })
        insertedCommentCount++
      }
      if (comments.length) {
        await db.collection('moments').doc(momentId).update({
          data: { commentCount: _.set(comments.length) }
        })
      }
    }

    return {
      code: 0,
      message: 'ok',
      data: {
        insertedMoments: insertedIds.length,
        insertedComments: insertedCommentCount,
        ids: insertedIds.map(x => ({ seedKey: x.seedKey, momentId: x.momentId, commentCount: x.comments.length }))
      }
    }
  } catch (err) {
    console.error('seedMoments err:', err)
    return {
      code: -1,
      message: err.message || 'seed fail',
      stack: err.stack
    }
  }
}
