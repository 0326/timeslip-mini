/**
 * DNA 算分引擎（前端镜像，用于结果页展示与本地预览）
 * 服务端权威计算在 cloudfunctions/dna/index.js
 * 这里保持算法一致，便于结果页拿到 record 后展示 dimLevels
 */

function sumToLevel(score) {
  if (score <= 3) return 'L'
  if (score === 4) return 'M'
  return 'H'
}

function levelNum(level) {
  return { L: 1, M: 2, H: 3 }[level] || 1
}

function levelName(level) {
  return { L: '低', M: '中', H: '高' }[level] || '中'
}

function parsePattern(pattern) {
  if (!pattern || typeof pattern !== 'string') return []
  return pattern.replace(/-/g, '').toUpperCase().split('')
}

/**
 * 计算维度等级（结果页展示用）
 * @param {Array} answers - [{dim, dimValue}]
 * @param {Array} dimOrder - [{value, name, model}]
 */
function calcDimLevels(answers, dimOrder) {
  const dims = (dimOrder || []).map(d => d.value)
  const scores = {}
  dims.forEach(d => { scores[d] = 0 })
  ;(answers || []).forEach(ans => {
    if (ans.dim && ans.dimValue !== undefined) {
      scores[ans.dim] = (scores[ans.dim] || 0) + Number(ans.dimValue)
    }
  })
  const levels = {}
  dims.forEach(d => { levels[d] = sumToLevel(scores[d] || 0) })
  return { scores, levels }
}

/**
 * 雷达图数据：从 radar 对象按 dimOrder 顺序取值
 * @param {Object} radar - {谋略: 92, ...}
 * @param {Array} dimOrder - [{value, name}]
 */
function radarData(radar, dimOrder) {
  if (!radar || !dimOrder) return []
  return dimOrder.map(d => ({
    name: d.name,
    value: radar[d.name] || 70
  }))
}

/**
 * 维度等级条数据
 */
function dimBars(dimLevels, dimScores, dimOrder) {
  if (!dimOrder) return []
  return dimOrder.map(d => ({
    name: d.name,
    model: d.model || d.name,
    level: dimLevels ? dimLevels[d.value] || 'M' : 'M',
    score: dimScores ? dimScores[d.value] || 0 : 0,
    percent: levelNum(dimLevels ? dimLevels[d.value] : 'M') / 3 * 100
  }))
}

module.exports = {
  sumToLevel,
  levelNum,
  levelName,
  parsePattern,
  calcDimLevels,
  radarData,
  dimBars
}
