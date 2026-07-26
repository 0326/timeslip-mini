const CATEGORY_NAMES = {
  figure_truth: '人物真相',
  perspective: '史观解读',
  fun_fact: '冷知识'
}

const DYNASTY_NAMES = {
  xianqin: '先秦', xia: '夏', shang: '商', zhou: '周', chunqiu: '春秋', zhanguo: '战国',
  han: '秦汉', xihan: '西汉', donghan: '东汉', sanguo: '三国',
  jin: '晋', nanbeichao: '南北朝',
  tang: '唐', wuzhou: '武周',
  song: '宋', beisong: '北宋', nansong: '南宋',
  yuan: '元', ming: '明', qing: '清'
}

/**
 * 格式化数字
 */
function formatCount(num) {
  const n = Number(num) || 0
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

/**
 * 处理单篇文章，添加展示字段
 */
function processArticle(article) {
  if (!article) return null
  const id = article._id || ''
  if (!id) return null
  const coverImage = article.coverImage && article.coverImage.indexOf('/images/') !== 0
    ? article.coverImage
    : ''

  return {
    ...article,
    _id: id,
    coverImage,
    categoryName: CATEGORY_NAMES[article.category] || article.category || '',
    dynastyName: DYNASTY_NAMES[article.dynasty] || article.dynasty || '',
    viewText: formatCount(article.viewCount),
    likeText: formatCount(article.likeCount),
    bookmarkText: formatCount(article.bookmarkCount)
  }
}

module.exports = {
  CATEGORY_NAMES,
  DYNASTY_NAMES,
  formatCount,
  processArticle
}
