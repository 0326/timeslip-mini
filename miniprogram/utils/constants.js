const CLOUD_ENV_ID = 'cloud1-d0gunpzup215cfd87'
const APP_ID = 'wx515b70782ea1aaf3'

const APP_NAME = '穿越圈'
const OFFICIAL_SITE = 'https://shiji.timeslip.work'

const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MOMENT_PAGE_SIZE: 10,
  CHAT_PAGE_SIZE: 20,
  MAX_LIMIT: 100
}

const DYNASTY_FILTERS = [
  { key: 'all', name: '全部' },
  { key: 'xianqin', name: '先秦' },
  { key: 'han', name: '秦汉' },
  { key: 'sanguo', name: '三国' },
  { key: 'tang', name: '唐' },
  { key: 'song', name: '宋' },
  { key: 'ming', name: '明' },
  { key: 'qing', name: '清' }
]

const AI_CONFIG = {
  chatMaxLength: 500,
  chatTemperature: 0.8,
  maxHistoryPairs: 10,
  typingSpeedMs: 40
}

// 系统引导 AI 角色：青月
const QINGYUE = {
  figureId: 'sys_qingyue',
  name: '青月',
  title: '系统',
  avatar: '/images/qingyue.jpg',
  agentId: 'agt-timeslip-2g9bj8k1d6e7cf65',
  isSystem: true
}

const CONTENT_SECURITY = {
  maxTextLength: 2000,
  maxCommentLength: 500,
  maxLetterLength: 300
}

const ACHIEVEMENT_KEYS = {
  FIRST_CHAT: 'first_chat',
  FIRST_LETTER: 'first_letter',
  FIRST_MEMORIAL: 'first_memorial',
  FIRST_MOMENT_LIKE: 'first_like',
  FIRST_VISIT: 'first_visit',
  FIRST_PROFILE: 'first_profile',
  DNA_COMPLETED: 'dna_completed',
  DNA_DONE: 'dna_done',
  DNA_SHARE: 'dna_share',
  CHAT_10: 'chat_10',
  CHAT_50: 'chat_50',
  CHAT_100: 'chat_100',
  LETTER_5: 'letter_5',
  LETTER_10: 'letter_10',
  COMMENT_10: 'comment_10',
  MEMORIAL_5: 'memorial_5',
  MEMORIAL_20: 'memorial_20',
  MEMORIAL_MASTER: 'memorial_master',
  READ_BOOK: 'read_book',
  READ_5: 'read_5',
  ALL_DYNASTIES: 'all_dynasties',
  ALL_FIGURES: 'all_figures',
  COLLECTOR: 'collector',
  TIME_MASTER: 'time_master',
  MOMENT_POPULAR: 'moment_popular'
}

module.exports = {
  CLOUD_ENV_ID,
  APP_ID,
  APP_NAME,
  OFFICIAL_SITE,
  PAGINATION,
  DYNASTY_FILTERS,
  AI_CONFIG,
  QINGYUE,
  CONTENT_SECURITY,
  ACHIEVEMENT_KEYS
}
