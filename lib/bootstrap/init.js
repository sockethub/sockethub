  console.log();
var tv4       = require('tv4'),
    debug     = require('debug')('sockethub:bootstrap:init'),
    nconf     = require('nconf');

debug('running init routines');

var packageJSON    = require('./../../package.json');
var junk = require(__dirname + '/config.js')(); 
var platforms = require(__dirname + '/platforms.js')(Object.keys(packageJSON.dependencies));

var schemaSHAS = require('./../schemas/sockethub-activity-stream');
var schemaSHAO = require('./../schemas/sockethub-activity-object');

// load sockethub-activity-stream schema and register it with tv4
tv4.addSchema(schemaSHAS.id, schemaSHAS);
// load sockethub-activity-object schema and register it with tv4
tv4.addSchema(schemaSHAO.id, schemaSHAO);

var host = process.env.HOST || nconf.get('service:host');
var port = process.env.PORT || nconf.get('service:port');

if (nconf.get('help')) {
  console.log(packageJSON.name + ' ' + packageJSON.version);
  console.log('command line args: ');
  console.log();
  console.log('  --help  : this help screen');
  console.log('  --info  : displays some basic runtime info');
  console.log();
  console.log('  --dev : enabled examples page and serves helper files like jquery');
  console.log();
  console.log('  --host  : hostname to bind to');
  console.log('  --port  : port to bind to');
  console.log();
  process.exit();
} else if (nconf.get('info')) {
  console.log(packageJSON.name + ' ' + packageJSON.version);
  console.log();
  console.log('platforms: ' + platforms.getIdentifiers().join(', '));
  console.log('sockethub: ' + host + ':' + port + nconf.get('service:path'));
  console.log('redis: ' + nconf.get('redis:host') + ':' + nconf.get('redis:port'));
  if (nconf.get('kue:enabled')) {
    console.log('kue: ' + nconf.get('kue:host') + ':' + nconf.get('kue:port'));
  } else {
    console.log('kue: disabled');
  }
  console.log();
  console.log('public url: ' + nconf.get('public:host') + ':' + nconf.get('public:port') + nconf.get('public:path'));
  console.log();
  process.exit();  
}

debug('finished init routines');

module.exports = {
  version: packageJSON.version,
  platforms: platforms,
  host: host,
  port: port,
  path: nconf.get('service:path')
};
