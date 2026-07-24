const db = wx.cloud.database()
const _ = db.command
const $ = db.command.aggregate

module.exports = { db, _, $ }
