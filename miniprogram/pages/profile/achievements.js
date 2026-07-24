const { storage } = require('../../utils/storage')
const { formatChatTime } = require('../../utils/date')

const ALL_ACHIEVEMENTS = [
  { key: 'first_chat', icon: '💬', name: '初遇古人', desc: '第一次与历史人物聊天', category: 'beginner',
    unlockCondition: '与任意历史人物发送第一条消息', reward: '+10 穿越点' },
  { key: 'first_letter', icon: '🕊️', name: '飞鸽初试', desc: '第一次通过飞鸽传书', category: 'beginner',
    unlockCondition: '成功发送并收到第一封回信', reward: '+10 穿越点' },
  { key: 'first_like', icon: '👍', name: '点赞之交', desc: '第一次点赞朋友圈动态', category: 'beginner',
    unlockCondition: '在朋友圈点赞任意一条动态', reward: '+5 穿越点' },
  { key: 'dna_done', icon: '🧬', name: '身世之谜', desc: '完成历史人格DNA测试', category: 'beginner',
    unlockCondition: '答完全部DNA测试题并生成结果', reward: '+20 穿越点' },

  { key: 'chat_10', icon: '📚', name: '话痨之友', desc: '累计发送10条聊天消息', category: 'communicate',
    unlockCondition: '聊天消息发送总数达到10条', reward: '+30 穿越点' },
  { key: 'chat_50', icon: '🎭', name: '忘年之交', desc: '累计发送50条聊天消息', category: 'communicate',
    unlockCondition: '聊天消息发送总数达到50条', reward: '+80 穿越点' },
  { key: 'letter_5', icon: '✉️', name: '鸿雁传情', desc: '累计收到5封回信', category: 'communicate',
    unlockCondition: '共收到5封历史人物的回信', reward: '+50 穿越点' },
  { key: 'comment_10', icon: '✍️', name: '说古道今', desc: '累计在朋友圈发布10条评论', category: 'communicate',
    unlockCondition: '朋友圈评论数达到10条', reward: '+30 穿越点' },

  { key: 'first_memorial', icon: '📋', name: '初批奏折', desc: '第一次批阅奏折', category: 'explore',
    unlockCondition: '完成第一份奏折决策并查看推演结果', reward: '+20 穿越点' },
  { key: 'memorial_5', icon: '👑', name: '勤政之君', desc: '累计批阅5份奏折', category: 'explore',
    unlockCondition: '共完成5份奏折的批阅', reward: '+80 穿越点' },
  { key: 'figure_10', icon: '🧑‍🎨', name: '博物君子', desc: '解锁10位历史人物图鉴', category: 'explore',
    unlockCondition: '人物图鉴中已解锁人物达10位', reward: '+60 穿越点' },
  { key: 'read_book', icon: '📖', name: '博览群书', desc: '第一次开启史书阅读', category: 'explore',
    unlockCondition: '进入兰台史书阅读页并阅读超过3分钟', reward: '+15 穿越点' },

  { key: 'all_dynasties', icon: '🏯', name: '千古一帝', desc: '与各朝代至少一位人物聊过天', category: 'legend',
    unlockCondition: '秦汉、三国、唐、宋、明、清各朝至少一人都有过聊天记录', reward: '+200 穿越点 + 专属古风称号' },
  { key: 'collector', icon: '🏅', name: '金石收藏家', desc: '解锁80%的成就', category: 'legend',
    unlockCondition: '成就解锁进度达到80%', reward: '+500 穿越点 + 金色个人主页边框' },
  { key: 'time_master', icon: '⏳', name: '时空主宰', desc: '累计穿越积分达到1000', category: 'legend',
    unlockCondition: '总穿越点数累积达到1000点', reward: '+1000 穿越点 + 专属稀有头像框' }
]

Page({
  data: {
    achievementList: [],
    unlockedCount: 0,
    totalCount: ALL_ACHIEVEMENTS.length,
    progressPercent: 0,
    categoryProgress: { beginner: '0/4', communicate: '0/4', explore: '0/4', legend: '0/3' },
    showModal: false,
    detailData: null
  },

  onShow() {
    this.loadAchievements()
  },

  loadAchievements() {
    const unlockedKeys = storage.get('unlocked_achievements') || {
      first_chat: Date.now() - 86400000 * 3,
      dna_done: Date.now() - 86400000 * 2
    }
    const points = storage.get('user_points') || 35
    storage.set('user_points', points, 86400 * 30)

    const list = ALL_ACHIEVEMENTS.map(a => {
      const unlockedAt = unlockedKeys[a.key]
      return {
        ...a,
        unlocked: !!unlockedAt,
        unlockTime: unlockedAt ? formatChatTime(unlockedAt).split(' ')[0] : ''
      }
    })

    const unlocked = list.filter(a => a.unlocked).length
    const calcCatProgress = (cat) => {
      const catItems = list.filter(a => a.category === cat)
      const catUnlocked = catItems.filter(a => a.unlocked).length
      return `${catUnlocked}/${catItems.length}`
    }

    this.setData({
      achievementList: list,
      unlockedCount: unlocked,
      progressPercent: Math.round(unlocked / ALL_ACHIEVEMENTS.length * 100),
      categoryProgress: {
        beginner: calcCatProgress('beginner'),
        communicate: calcCatProgress('communicate'),
        explore: calcCatProgress('explore'),
        legend: calcCatProgress('legend')
      }
    })
  },

  showDetail(e) {
    const { item } = e.currentTarget.dataset
    if (!item) return
    const detail = {
      ...item,
      unlockCondition: item.unlockCondition || '完成指定任务后自动解锁'
    }
    this.setData({ showModal: true, detailData: detail })
  },
  closeModal() { this.setData({ showModal: false, detailData: null }) },
  stopProp() {}
})
