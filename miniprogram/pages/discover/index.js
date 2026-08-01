const { requestCloud } = require('../../utils/cloudRequest')
const { storage } = require('../../utils/storage')

Page({
  data: {
    groups: [
      {
        items: [
          {
            key: 'moments',
            iconSrc: '/images/pyq.png',
            name: '朋友圈',
            url: '/pages/discover/moments',
            badge: 0,
            tip: ''
          }
        ]
      },
      {
        items: [
          {
            key: 'channels',
            iconClass: 'shipinhao',
            name: '视频号',
            color: '#FA5151',
            url: '/pages/discover/channels/index',
            badge: 0,
            tip: '',
            latestVideoId: ''
          },
          {
            key: 'memorial',
            iconClass: 'pyp',
            name: '批奏折',
            color: '#C9A24D',
            url: '/pages/discover/memorial',
            badge: 0,
            tip: ''
          },
          {
            key: 'letters',
            iconClass: 'mail',
            name: '雁书',
            color: '#C9A24D',
            url: '/pages/yan/index',
            badge: 0,
            tip: ''
          }
        ]
      },
      {
        items: [
          {
            key: 'dna',
            iconClass: 'cyc',
            name: '测一测',
            color: '#722ED1',
            url: '/pages/discover/dna-hall/index',
            badge: 0,
            tip: '测试你更像哪位皇帝'
          },
          {
            key: 'look',
            iconClass: 'kyk',
            name: '看一看',
            color: '#1890FF',
            url: '/pages/discover/look/index',
            badge: 0,
            tip: '发现历史的真相'
          }
        ]
      }
    ]
  },

  onLoad() {
    this.loadBadges()
  },

  onShow() {
    const app = getApp()
    app.setCurrentTab(this, 2)
    this.loadBadges()
  },

  async loadBadges() {
    try {
      const lastViewMoments = storage.get('discover_last_view_moments', 0)
      const lastViewChannels = storage.get('discover_last_view_channels', 0)
      const lastViewYanReplies = storage.get('discover_last_view_yan_replies', 0)

      const data = await requestCloud('discoverBadge', 'get', {
        lastViewMoments,
        lastViewChannels,
        lastViewYanReplies
      }, { throwError: false })

      if (!data) return

      const groups = this.data.groups.map(group => ({
        ...group,
        items: group.items.map(item => {
          const next = { ...item }
          switch (item.key) {
            case 'moments':
              next.badge = data.moments ? data.moments.unreadCount : 0
              next.tip = ''
              break
            case 'channels':
              if (data.channels && data.channels.hasNew) {
                next.tip = data.channels.figureName ? `${data.channels.figureName}发布了新视频` : '有新视频发布'
                next.latestVideoId = data.channels.videoId || ''
              } else {
                next.tip = ''
                next.latestVideoId = ''
              }
              break
            case 'memorial':
              const pendingCount = data.memorial ? data.memorial.pendingCount : 0
              if (pendingCount > 0) {
                next.tip = `陛下，有${pendingCount}份奏折待您批阅`
              } else {
                next.tip = '今日已清'
              }
              break
            case 'letters':
              if (data.yan) {
                if (data.yan.newReplyCount > 0) {
                  next.tip = '雁归来，快来看看带回什么宝贝'
                  next.badge = data.yan.newReplyCount
                } else if (data.yan.travelingCount > 0) {
                  next.tip = '你的大雁正在送信中...'
                  next.badge = 0
                } else {
                  next.tip = '你的大雁正在等你派遣任务'
                  next.badge = 0
                }
              }
              break
          }
          return next
        })
      }))

      this.setData({ groups })
    } catch (e) {
      console.warn('[discover] loadBadges failed:', e)
    }
  },

  markAsViewed(key) {
    const now = Date.now()
    switch (key) {
      case 'moments':
        storage.set('discover_last_view_moments', now)
        break
      case 'channels':
        storage.set('discover_last_view_channels', now)
        break
      case 'letters':
        storage.set('discover_last_view_yan_replies', now)
        break
    }
    this.loadBadges()
  },

  onItemTap(e) {
    const { url, key, latestvideoid } = e.currentTarget.dataset
    if (!url) {
      wx.showToast({ title: '即将上线', icon: 'none' })
      return
    }

    this.markAsViewed(key)

    let navigateUrl = url
    if (key === 'channels' && latestvideoid) {
      navigateUrl = `${url}?videoId=${latestvideoid}`
    }

    wx.navigateTo({
      url: navigateUrl,
      fail: () => wx.showToast({ title: '功能开发中', icon: 'none' })
    })
  }
})
