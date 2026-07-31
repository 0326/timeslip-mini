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
  acpEndpoint: 'https://cloud1-d0gunpzup215cfd87.api.tcloudbasegateway.com/v1/aibot/bots/agt-timeslip-2g9bj8k1d6e7cf65/acp',
  publishableKey: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMWRjMzFlLWI0ZDAtNDQ4Yi1hNzZmLWIwY2M2M2Q4MTQ5OCJ9.eyJpc3MiOiJodHRwczovL2Nsb3VkMS1kMGd1bnB6dXAyMTVjZmQ4Ny5hcC1zaGFuZ2hhaS50Y2ItYXBpLnRlbmNlbnRjbG91ZGFwaS5jb20iLCJzdWIiOiJhbm9uIiwiYXVkIjoiY2xvdWQxLWQwZ3VucHp1cDIxNWNmZDg3IiwiZXhwIjo0MDg5MDIyMTg4LCJpYXQiOjE3ODUzMzg5ODgsIm5vbmNlIjoiekM3WmZVUmVRS0N5YzFoWjJ3TWdYUSIsImF0X2hhc2giOiJ6QzdaZlVSZVFLQ3ljMWhaMndNZ1hRIiwibmFtZSI6IkFub255bW91cyIsInNjb3BlIjoiYW5vbnltb3VzIiwicHJvamVjdF9pZCI6ImNsb3VkMS1kMGd1bnB6dXAyMTVjZmQ4NyIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJ1c2VyX3R5cGUiOiIiLCJjbGllbnRfdHlwZSI6ImNsaWVudF91c2VyIiwiaXNfc3lzdGVtX2FkbWluIjpmYWxzZX0.QeBz7kzMOwzUwUzYK1EBu3paT5wkFhOtHEmKB8_zRRcTtETV2JL400mjsPGNBzBi_STrjC61HdRdo__bIJ7EXhKCOZRhat4VDKMOjm6kkvLtXcljHKXo-pUn5ISnxRjI_SIMQo2jgE-eqFF4XlHGeiK3uUSeycZDS21XbPkYVCztZ4MowaPZq8eys9i7i8_WfghQ9gfH1eKiXyCyS5IsKxNuYtVNePFNGkpSPbbZ0jvISYS4JAQkjFLmHv-tI01899MQr0gRq930xEcZTIl5UocwPq_UsXuyltYr36G3WLEzx5tk1LBBvTAV9_KyqJV-5nrxnxHDerIVGwMNO2_ChA',
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
