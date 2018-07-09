const getPrettyTime = require('./getPrettyTime');

module.exports = (tray, webContents, ms) => {
  tray.setTitle( getPrettyTime(ms) )
  webContents.send('time-update', getPrettyTime(ms))
}
