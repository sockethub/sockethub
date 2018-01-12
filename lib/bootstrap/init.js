const tv4       = require('tv4'),
      debug     = require('debug')('sockethub:bootstrap:init'),
      nconf     = require('nconf');

debug('running init routines');

const packageJSON    = require('./../../package.json');
const junk = require(__dirname + '/config.js')();
const platforms = require(__dirname + '/platforms.js')(Object.keys(packageJSON.dependencies));
const SockethubSchemas = require('sockethub-schemas');

// load sockethub-activity-stream schema and register it with tv4
tv4.addSchema(SockethubSchemas.ActivityStream.id, SockethubSchemas.ActivityStream);
// load sockethub-activity-object schema and register it with tv4
tv4.addSchema(SockethubSchemas.ActivityObject.id, SockethubSchemas.ActivityObject);

function defaultEnvParams(host, port, prop) {
  nconf.set(prop + ':host', host);
  nconf.set(prop + ':port', port);
}

defaultEnvParams(
    process.env.HOST || nconf.get('service:host'),
    process.env.PORT || nconf.get('service:port'),
    'service'
  );
defaultEnvParams(
    process.env.REDIS_HOST || nconf.get('redis:host'),
    process.env.REDIS_PORT || nconf.get('redis:port'),
    'redis'
  );

// allow a redis://user:host:port url, takes precedence
if (process.env.REDIS_URL) {
  nconf.set('redis:url', process.env.REDIS_URL);
  nconf.clear('redis:host');
  nconf.clear('redis:port');
}

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

  if (nconf.get('redis:url')) {
    console.log('redis URL: ' + nconf.get('redis:url'));
  } else {
    console.log('redis: ' + nconf.get('redis:host') + ':' + nconf.get('redis:port'));
  }
  if (nconf.get('kue:enabled')) {
    console.log('kue: ' + nconf.get('kue:host') + ':' + nconf.get('kue:port'));
  } else {
    console.log('kue: disabled');
  }
  console.log();
  console.log('public url: ' + nconf.get('public:host') + ':' + nconf.get('public:port') + nconf.get('public:path'));
  console.log();

  if (platforms.getIdentifiers().length > 0) {
    platforms.forEachRecord((platform, i) => {
      console.log('  ' + platform.id + ' v' + platform.version);
      console.log('    AS @types: ' + platform['@types']);
      console.log();
    }).finally(() => {
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