/**
 * 看一看种子数据导入脚本
 *
 * 使用方式：
 * 1. 在微信开发者工具的云开发控制台中，手动创建以下集合：
 *    articles, article_likes, article_bookmarks, article_polls, article_comments
 * 2. 将 seed_articles.json 中的数据通过云开发控制台导入 articles 集合
 *    或使用本脚本通过云函数批量导入
 *
 * 集合权限设置：
 *   articles:        读=公开, 写=禁止（云函数写入）
 *   article_likes:   读=仅自己, 写=禁止
 *   article_bookmarks: 读=仅自己, 写=禁止
 *   article_polls:   读=仅自己, 写=禁止
 *   article_comments: 读=公开, 写=禁止
 */

const articles = require('./seed_articles.json')

console.log(`共 ${articles.length} 篇文章待导入`)
console.log('分类统计:')
const stats = {}
articles.forEach(a => {
  stats[a.category] = (stats[a.category] || 0) + 1
})
Object.entries(stats).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count} 篇`)
})

console.log('\n导入方式：')
console.log('1. 微信开发者工具 → 云开发 → 数据库 → articles 集合 → 导入数据')
console.log('   选择 seed_articles.json 文件即可')
console.log('2. 或通过云函数 look 的 adminArticleCreate 接口逐条导入')

module.exports = articles
