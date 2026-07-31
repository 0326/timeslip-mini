const { requestCloud } = require('../../utils/cloudRequest')
const { formatChatTime } = require('../../utils/date')
const loginGuard = require('../../utils/loginGuard')

// ── 云存储图标地址 ──
const STORAGE = 'cloud://cloud1-d0gunpzup215cfd87.636c-cloud1-d0gunpzup215cfd87-1457646459/mini-assets/achievements'
const iconUrl = (key) => `${STORAGE}/icons/${key}.jpg`

// ── 成就配置（前端兜底，云函数未部署也能正常显示）──
const ACHIEVEMENT_CONFIG = [
  // 初入穿越
  { key: 'first_chat', name: '初遇古人', desc: '第一次与历史人物聊天', category: 'beginner', rarity: 'common',
    unlockCondition: '与任意历史人物发送第一条消息', reward: '+10 穿越点' },
  { key: 'first_letter', name: '飞鸽初试', desc: '第一次通过飞鸽传书', category: 'beginner', rarity: 'common',
    unlockCondition: '成功发送并收到第一封回信', reward: '+10 穿越点' },
  { key: 'first_like', name: '点赞之交', desc: '第一次点赞朋友圈动态', category: 'beginner', rarity: 'common',
    unlockCondition: '在朋友圈点赞任意一条动态', reward: '+5 穿越点' },
  { key: 'dna_done', name: '身世之谜', desc: '完成历史人格DNA测试', category: 'beginner', rarity: 'rare',
    unlockCondition: '答完全部DNA测试题并生成结果', reward: '+20 穿越点' },
  { key: 'first_visit', name: '初探兰台', desc: '第一次进入兰台史书', category: 'beginner', rarity: 'common',
    unlockCondition: '首次进入兰台史书阅读页', reward: '+10 穿越点' },
  { key: 'first_profile', name: '身份认证', desc: '完成个人资料设置', category: 'beginner', rarity: 'common',
    unlockCondition: '设置昵称和头像完成个人资料', reward: '+10 穿越点' },

  // 交流互动
  { key: 'chat_10', name: '话痨之友', desc: '累计发送10条聊天消息', category: 'communicate', rarity: 'common',
    unlockCondition: '聊天消息发送总数达到10条', reward: '+30 穿越点' },
  { key: 'chat_50', name: '忘年之交', desc: '累计发送50条聊天消息', category: 'communicate', rarity: 'rare',
    unlockCondition: '聊天消息发送总数达到50条', reward: '+80 穿越点' },
  { key: 'letter_5', name: '鸿雁传情', desc: '累计收到5封回信', category: 'communicate', rarity: 'rare',
    unlockCondition: '共收到5封历史人物的回信', reward: '+50 穿越点' },
  { key: 'comment_10', name: '说古道今', desc: '累计发布10条评论', category: 'communicate', rarity: 'common',
    unlockCondition: '朋友圈评论数达到10条', reward: '+30 穿越点' },
  { key: 'chat_100', name: '知音难觅', desc: '累计发送100条消息', category: 'communicate', rarity: 'epic',
    unlockCondition: '聊天消息发送总数达到100条', reward: '+150 穿越点' },
  { key: 'letter_10', name: '尺素往来', desc: '累计收到10封回信', category: 'communicate', rarity: 'epic',
    unlockCondition: '共收到10封历史人物的回信', reward: '+100 穿越点' },

  // 历史探索
  { key: 'first_memorial', name: '初批奏折', desc: '第一次批阅奏折', category: 'explore', rarity: 'common',
    unlockCondition: '完成第一份奏折决策并查看推演结果', reward: '+20 穿越点' },
  { key: 'memorial_5', name: '勤政之君', desc: '累计批阅5份奏折', category: 'explore', rarity: 'rare',
    unlockCondition: '共完成5份奏折的批阅', reward: '+80 穿越点' },
  { key: 'read_book', name: '博览群书', desc: '第一次开启史书阅读', category: 'explore', rarity: 'common',
    unlockCondition: '进入兰台史书阅读页并阅读超过3分钟', reward: '+15 穿越点' },
  { key: 'memorial_20', name: '日理万机', desc: '累计批阅20份奏折', category: 'explore', rarity: 'epic',
    unlockCondition: '共完成20份奏折的批阅', reward: '+200 穿越点' },
  { key: 'read_5', name: '学富五车', desc: '累计阅读5本史书', category: 'explore', rarity: 'rare',
    unlockCondition: '在兰台阅读5本不同的史书', reward: '+100 穿越点' },
  { key: 'dna_share', name: '身世分享', desc: '分享DNA测试结果', category: 'explore', rarity: 'common',
    unlockCondition: '将历史人格DNA测试结果分享到朋友圈', reward: '+30 穿越点' },

  // 稀世传奇
  { key: 'all_dynasties', name: '千古一帝', desc: '与各朝代人物聊过天', category: 'legend', rarity: 'legend',
    unlockCondition: '秦汉、三国、唐、宋、明、清各朝至少一人都有过聊天记录', reward: '+200 穿越点 + 专属古风称号' },
  { key: 'collector', name: '金石收藏家', desc: '解锁80%的成就', category: 'legend', rarity: 'legend',
    unlockCondition: '成就解锁进度达到80%', reward: '+500 穿越点 + 金色个人主页边框' },
  { key: 'time_master', name: '时空主宰', desc: '累计穿越积分达1000', category: 'legend', rarity: 'legend',
    unlockCondition: '总穿越点数累积达到1000点', reward: '+1000 穿越点 + 专属稀有头像框' },
  { key: 'all_figures', name: '交友满天下', desc: '与所有人物聊过天', category: 'legend', rarity: 'epic',
    unlockCondition: '与全部历史人物至少有过一次聊天记录', reward: '+300 穿越点 + 限定称号' },
  { key: 'moment_popular', name: '名动天下', desc: '动态获得50个赞', category: 'legend', rarity: 'epic',
    unlockCondition: '单条朋友圈动态累计获得50个赞', reward: '+200 穿越点 + 热门标识' },
  { key: 'memorial_master', name: '批阅狂人', desc: '累计批阅50份奏折', category: 'legend', rarity: 'legend',
    unlockCondition: '共完成50份奏折的批阅', reward: '+500 穿越点 + 帝师称号' }
]

// 注入 iconUrl
ACHIEVEMENT_CONFIG.forEach(a => { a.iconUrl = iconUrl(a.key) })

const CATEGORY_DEFS = [
  { key: 'beginner', title: '初入穿越', icon: '🌱' },
  { key: 'communicate', title: '交流互动', icon: '💬' },
  { key: 'explore', title: '历史探索', icon: '📖' },
  { key: 'legend', title: '稀世传奇', icon: '👑' }
]

const RARITY_LABELS = { common: '普通', rare: '稀有', epic: '史诗', legend: '传说' }

Page({
  data: {
    loading: true,
    categories: [],
    unlockedCount: 0,
    totalCount: 0,
    progressPercent: 0,
    showModal: false,
    detailData: null
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return
    this.loadAchievements()
  },

  async loadAchievements() {
    this.setData({ loading: true })
    const data = await requestCloud('getUser', 'achievements', {}, { throwError: false })

    if (!data) {
      // 云函数不可用时用前端配置展示全部未解锁
      const categories = CATEGORY_DEFS.map(cat => {
        const items = ACHIEVEMENT_CONFIG.filter(a => a.category === cat.key).map(a => ({
          ...a,
          unlocked: false,
          unlockTime: '',
          rarityLabel: RARITY_LABELS[a.rarity] || '普通'
        }))
        const unlocked = items.filter(a => a.unlocked).length
        return { ...cat, items, progress: `${unlocked}/${items.length}` }
      })
      this.setData({
        loading: false,
        categories,
        unlockedCount: 0,
        totalCount: ACHIEVEMENT_CONFIG.length,
        progressPercent: 0
      })
      return
    }

    const serverList = data.list || []
    const serverMap = {}
    serverList.forEach(a => { serverMap[a.key] = a })

    // 用前端配置为权威，云函数返回的解锁状态合并进来
    const fullList = ACHIEVEMENT_CONFIG.map(a => {
      const server = serverMap[a.key] || {}
      const unlockedAt = server.unlockedAt || 0
      return {
        ...a,
        unlocked: !!unlockedAt,
        unlockedAt,
        unlockTime: unlockedAt ? formatChatTime(unlockedAt).split(' ')[0] : '',
        rarityLabel: RARITY_LABELS[a.rarity] || '普通'
      }
    })

    const categories = CATEGORY_DEFS.map(cat => {
      const items = fullList.filter(a => a.category === cat.key)
      const unlocked = items.filter(a => a.unlocked).length
      return { ...cat, items, progress: `${unlocked}/${items.length}` }
    })

    const totalCount = fullList.length
    const unlockedCount = fullList.filter(a => a.unlocked).length

    this.setData({
      loading: false,
      categories,
      unlockedCount,
      totalCount,
      progressPercent: totalCount ? Math.round(unlockedCount / totalCount * 100) : 0
    })
  },

  showDetail(e) {
    const { item } = e.currentTarget.dataset
    if (!item) return
    this.setData({ showModal: true, detailData: { ...item, unlockCondition: item.unlockCondition || '完成指定任务后自动解锁' } })
  },
  closeModal() { this.setData({ showModal: false, detailData: null }) },
  stopProp() {}
})
