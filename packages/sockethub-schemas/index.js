const debug = require('debug');
const log = debug('sockethub:schemas');
log('loading sockethub activity stream schemas');
module.exports = {
  ActivityStream: require('./schemas/activity-stream.js'),
  ActivityObject: require('./schemas/activity-object.js'),
  platform: require('./src/platform.js')
};
