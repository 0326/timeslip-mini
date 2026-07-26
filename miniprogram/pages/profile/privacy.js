Page({
  viewPrivacy: function () {
    wx.showModal({
      title: '隐私政策',
      content: '穿越圈（timeslip-mini）非常重视您的隐私。\n\n本小程序仅收集必要的匿名登录凭证（openid）以提供服务，不收集真实姓名、手机号等敏感信息。用户生成内容会经过微信内容安全审核。\n\n数据存储于微信云开发（CloudBase），您可以通过"导出我的数据"获取本地数据副本。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  viewUserAgreement: function () {
    wx.showModal({
      title: '用户协议',
      content: '欢迎使用穿越圈小程序！\n\n1. 本产品仅供历史文化爱好者交流使用，请遵守国家法律法规。\n2. 禁止发布违法、违规、不友善的内容，违者内容将被删除并封号。\n3. AI 生成内容仅供娱乐，不代表真实历史观点，请勿当真。\n4. 如您继续使用，即视为同意以上条款。',
      showCancel: false,
      confirmText: '我已阅读'
    })
  }
})
