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
  DNA_COMPLETED: 'dna_completed',
  CHAT_10: 'chat_10',
  COLLECT_10_FIGURES: 'collect_10'
}

module.exports = {
  CLOUD_ENV_ID,
  APP_ID,
  APP_NAME,
  OFFICIAL_SITE,
  PAGINATION,
  DYNASTY_FILTERS,
  AI_CONFIG,
  CONTENT_SECURITY,
  ACHIEVEMENT_KEYS
}
