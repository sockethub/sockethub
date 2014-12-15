var debug = require('debug')('sockethub:bootstrap:init'),
    nconf = require('nconf');

debug('running init routines');

var platforms = require('./platforms').init();

module.exports = {
  platforms: platforms,
  host: process.env.HOST || nconf.get('service:host'),
  port: process.env.PORT || nconf.get('service:port'),
  path: nconf.get('service:path')
};

debug('finished init routines');
