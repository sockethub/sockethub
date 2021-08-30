import debug from 'debug';

import config from '../config';
import platformLoad from './platforms';

const log = debug('sockethub:bootstrap:init');
log('running init routines');

const packageJSON = require('./../../package.json');
const platforms = platformLoad(Object.keys(packageJSON.dependencies));
log('loaded platforms');

if (config.get('help')) {
  // eslint-disable-next-line security-node/detect-crlf
  console.log(packageJSON.name + ' ' + packageJSON.version);
  console.log('command line args: ');
  console.log();
  console.log('  --help     : this help screen');
  console.log('  --info     : displays some basic runtime info');
  console.log();
  console.log('  --examples : enables examples page and serves helper files like jquery');
  console.log();
  console.log('  --host     : hostname to bind to');
  console.log('  --port     : port to bind to');
  console.log();
  process.exit();
} else if (config.get('info')) {
  // eslint-disable-next-line security-node/detect-crlf
  console.log(packageJSON.name + ' ' + packageJSON.version);
  console.log();
  // eslint-disable-next-line security-node/detect-crlf
  console.log('examples enabled: ' + config.get('examples:enabled'));
  // eslint-disable-next-line security-node/detect-crlf
  console.log('sockethub: ' + config.get('service:host') + ':' + config.get('service:port')
              + config.get('service:path'));

  if (config.get('redis:url')) {
    // eslint-disable-next-line security-node/detect-crlf
    console.log('redis URL: ' + config.get('redis:url'));
  } else {
    // eslint-disable-next-line security-node/detect-crlf
    console.log('redis: ' + config.get('redis:host') + ':' + config.get('redis:port'));
  }
  // eslint-disable-next-line security-node/detect-crlf
  console.log('public url: ' + config.get('public:host') + ':' + config.get('public:port')
              + config.get('public:path'));

  console.log();
  // eslint-disable-next-line security-node/detect-crlf
  console.log('platforms: ' + Array.from(platforms.keys()).join(', '));

  if (platforms.size > 0) {
    for (let platform of platforms.values()) {
      console.log();
      // eslint-disable-next-line security-node/detect-crlf
      console.log('  ' + platform.id + ' v' + platform.version);
      // eslint-disable-next-line security-node/detect-crlf
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

export interface IInitObject {
  version: string,
  platforms: Map<string, {
    id: string,
    moduleName: string,
    config: {
      persist?: boolean
    },
    version: string,
    '@types': string
  }>,
}

const init: IInitObject = {
  version: packageJSON.version,
  platforms: platforms
};
export default init;