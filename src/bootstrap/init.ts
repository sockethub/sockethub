import debug from 'debug';

import config from '../config';
import platformLoad from './platforms';

const log = debug('sockethub:bootstrap:init');
log('running init routines');

const packageJSON = require('./../../package.json');
const platforms = platformLoad(Object.keys(packageJSON.dependencies));
log('loaded platforms');

if (config.get('help')) {
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
} else if (config.get('info')) {
  console.log(packageJSON.name + ' ' + packageJSON.version);
  console.log();
  console.log('examples enabled: ' + config.get('examples:enabled'));
  console.log('sockethub: ' + config.get('service:host') + ':' + config.get('service:port')
              + config.get('service:path'));

  if (config.get('redis:url')) {
    console.log('redis URL: ' + config.get('redis:url'));
  } else {
    console.log('redis: ' + config.get('redis:host') + ':' + config.get('redis:port'));
  }
  if (config.get('kue:enabled')) {
    console.log('kue: ' + config.get('kue:host') + ':' + config.get('kue:port'));
  } else {
    console.log('kue: disabled');
  }
  console.log('public url: ' + config.get('public:host') + ':' + config.get('public:port')
              + config.get('public:path'));

  console.log();
  console.log('platforms: ' + Array.from(platforms.keys()).join(', '));

  if (platforms.size > 0) {
    for (let platform of platforms.values()) {
      console.log();
      console.log('  ' + platform.id + ' v' + platform.version);
      console.log('    AS @types: ' + platform['@types']);
    }
    console.log();
    process.exit();
  } else {
    console.log();
    process.exit();
  }
}

log('finished init routines');

const init = {
  version: packageJSON.version,
  platforms: platforms,
  host: config.get('service:host'),
  port: config.get('service:port'),
  path: config.get('service:path')
};
export default init;