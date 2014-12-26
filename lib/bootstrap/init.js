var tv4      = require('tv4'),
    debug    = require('debug')('sockethub:bootstrap:init'),
    nconf    = require('nconf'),
    shSchema = require('./../schemas/sockethub-activity-streams.js');

debug('running init routines');

var platforms = require('./platforms').init();

// load sockethub-activity-streams schema and register it with tv4
tv4.addSchema('http://sockethub.org/schemas/v0/activity-stream#', shSchema);

module.exports = {
  platforms: platforms,
  host: process.env.HOST || nconf.get('service:host'),
  port: process.env.PORT || nconf.get('service:port'),
  path: nconf.get('service:path')
};

debug('finished init routines');
