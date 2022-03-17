import debug from 'debug';

import config from '../config';
import * as platformBootstrap from './platforms';

const log = debug('sockethub:server:bootstrap:init');
log('running init routines');

const packageJSON = require('./../../package.json');
const platforms = platformBootstrap.platformLoad(config.get('platforms'));

log('loaded platforms');

if (config.get('info')) {
  // eslint-disable-next-line security-node/detect-crlf
  console.log('sockethub ' + packageJSON.version);
  console.log();

  // eslint-disable-next-line security-node/detect-crlf
  console.log('websocket: ' + config.get('sockethub:host') + ':' + config.get('sockethub:port')
              + config.get('sockethub:path'));

  console.log();
  // eslint-disable-next-line security-node/detect-crlf
  console.log('examples enabled: ' + config.get('examples:enabled'));
  // eslint-disable-next-line security-node/detect-crlf
  console.log('examples url: ' + config.get('public:host') + ':' + config.get('public:port')
    + config.get('public:path') + 'examples');

  console.log();
  if (config.get('redis:url')) {
    // eslint-disable-next-line security-node/detect-crlf
    console.log('redis URL: ' + config.get('redis:url'));
  } else {
    // eslint-disable-next-line security-node/detect-crlf
    console.log('redis: ' + config.get('redis:host') + ':' + config.get('redis:port'));
  }

  console.log();
  // eslint-disable-next-line security-node/detect-crlf
  console.log('platforms: ' + Array.from(platforms.keys()).join(', '));

  if (platforms.size > 0) {
    for (let platform of platforms.values()) {
      console.log();
      // eslint-disable-next-line security-node/detect-crlf
      console.log(platform.moduleName);
      // eslint-disable-next-line security-node/detect-crlf
      console.log(' name: ' + platform.id + ' version: ' + platform.version);
      // eslint-disable-next-line security-node/detect-crlf
      console.log(' AS types: ' + platform.types.join(', '));
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
    schemas: {
      credentials?: object,
      messages?: object
    },
    version: string,
    types: Array<string>
  }>,
}

const init: IInitObject = {
  version: packageJSON.version,
  platforms: platforms
};
export default init;
