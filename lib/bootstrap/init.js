var tv4      = require('tv4'),
    debug    = require('debug')('sockethub:bootstrap:init'),
    nconf    = require('nconf');

var shSchema = require('./../schemas/sockethub-activity-streams');

debug('running init routines');

var junk = require('./config.js')();
var platforms = require('./platforms.js')();


// load sockethub-activity-streams schema and register it with tv4
tv4.addSchema(shSchema.id, shSchema);

debug('finished init routines');

module.exports = {
  platforms: platforms,
  host: process.env.HOST || nconf.get('service:host'),
  port: process.env.PORT || nconf.get('service:port'),
  path: nconf.get('service:path')
};
