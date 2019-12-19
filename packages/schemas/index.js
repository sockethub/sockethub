var debug = require('debug')('sockethub:schemas');
debug('loading sockethub activity stream schemas');
module.exports = {
  ActivityStream: require('./schemas/activity-stream.js'),
  ActivityObject: require('./schemas/activity-object.js'),
  platform: require('./src/platform.js')
};
