var tv4       = require('tv4'),
    debug     = require('debug')('sockethub:bootstrap:init'),
    nconf     = require('nconf');

debug('running init routines');

var junk = require(__dirname + '/config.js')();
var platforms = require(__dirname + '/platforms.js')();


var schemaSHAS = require('./../schemas/sockethub-activity-stream');
var schemaSHAO = require('./../schemas/sockethub-activity-object');

// load sockethub-activity-stream schema and register it with tv4
tv4.addSchema(schemaSHAS.id, schemaSHAS);
// load sockethub-activity-object schema and register it with tv4
tv4.addSchema(schemaSHAO.id, schemaSHAO);

debug('finished init routines');

module.exports = {
  platforms: platforms,
  host: process.env.HOST || nconf.get('service:host'),
  port: process.env.PORT || nconf.get('service:port'),
  path: nconf.get('service:path')
};
