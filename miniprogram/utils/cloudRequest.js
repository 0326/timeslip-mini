async function requestCloud(name, action, data = {}, config = {}) {
  const { showLoading = false, loadingText = '加载中...', throwError = true } = config

  if (showLoading) {
    wx.showLoading({ title: loadingText, mask: true })
  }

  try {
    const res = await wx.cloud.callFunction({
      name,
      data: { action, ...data }
    })

    if (showLoading) wx.hideLoading()

    if (res.result && res.result.code === 0) {
      return res.result.data
    } else {
      const errMsg = (res.result && res.result.message) ? res.result.message : '请求失败'
      if (throwError) {
        wx.showToast({ title: errMsg, icon: 'none' })
        throw new Error(errMsg)
      }
      return null
    }
  } catch (err) {
    if (showLoading) wx.hideLoading()
    console.error(`Cloud API [${name}/${action}] Error:`, err)
    if (throwError) {
      wx.showToast({ title: '网络或服务异常', icon: 'none' })
      throw err
    }
    return null
  }
}

module.exports = { requestCloud }
