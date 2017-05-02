  console.log();
var tv4       = require('tv4'),
    debug     = require('debug')('sockethub:bootstrap:init'),
    nconf     = require('nconf');

debug('running init routines');

var packageJSON    = require('./../../package.json');
var junk = require(__dirname + '/config.js')();
var platforms = require(__dirname + '/platforms.js')(Object.keys(packageJSON.dependencies));

var SockethubSchemas = require('sockethub-schemas');
// load sockethub-activity-stream schema and register it with tv4
tv4.addSchema(SockethubSchemas.ActivityStream.id, SockethubSchemas.ActivityStream);
// load sockethub-activity-object schema and register it with tv4
tv4.addSchema(SockethubSchemas.ActivityObject.id, SockethubSchemas.ActivityObject);

// we want users to be able to define server locations via. ENV variables, and optionally set host:port or host= port=
function normalizeHoststring(host, port, prop) {
  var hostline = host.split(':');
  if (hostline[1]) {
    host = hostline[0];
    port = hostline[1];
  }
  nconf.set(prop + ':host', host);
  nconf.set(prop + ':port', port);
}

normalizeHoststring(
    process.env.HOST || nconf.get('service:host'),
    process.env.PORT || nconf.get('service:port'),
    'service'
  );
normalizeHoststring(
    process.env.REDIS_HOST || nconf.get('redis:host'),
    process.env.REDIS_PORT || nconf.get('redis:port'),
    'redis'
  );

if (nconf.get('help')) {
  console.log(packageJSON.name + ' ' + packageJSON.version);
  console.log('command line args: ');
  console.log();
  console.log('  --help     : this help screen');
  console.log('  --info     : displays some basic runtime info');
  console.log();
  console.log('  --examples : enabled examples page and serves helper files like jquery');
  console.log();
  console.log('  --host     : hostname to bind to');
  console.log('  --port     : port to bind to');
  console.log();
  process.exit();
} else if (nconf.get('info')) {
  console.log(packageJSON.name + ' ' + packageJSON.version);
  console.log();
  console.log('examples enabled: ' + nconf.get('examples:enabled'));
  console.log('platforms: ' + platforms.getIdentifiers().join(', '));
  console.log('sockethub: ' + nconf.get('service:host') + ':' + nconf.get('service:port') + nconf.get('service:path'));
  console.log('redis: ' + nconf.get('redis:host') + ':' + nconf.get('redis:port'));
  if (nconf.get('kue:enabled')) {
    console.log('kue: ' + nconf.get('kue:host') + ':' + nconf.get('kue:port'));
  } else {
    console.log('kue: disabled');
  }
  console.log();
  console.log('public url: ' + nconf.get('public:host') + ':' + nconf.get('public:port') + nconf.get('public:path'));
  console.log();

  if (platforms.getIdentifiers().length > 0) {
    platforms.forEachRecord(function (platform, i) {
      console.log('  ' + platform.id + ' v' + platform.version);
      console.log('    AS @types: ' + platform['@types']);
      console.log();
    }).finally(function () {
      console.log()
      process.exit();
    });
  } else {
    process.exit();
  }
}

debug('finished init routines');

module.exports = {
  version: packageJSON.version,
  platforms: platforms,
  host: nconf.get('service:host'),
  port: nconf.get('service:port'),
  path: nconf.get('service:path')
};
