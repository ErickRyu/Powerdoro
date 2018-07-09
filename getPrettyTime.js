const moment = require('moment')
require('moment-duration-format')


module.exports = function(ms) {
    return moment.duration(ms, 'milliseconds').format('mm:ss', {trim: false})
}
