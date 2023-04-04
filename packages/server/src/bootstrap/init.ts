import debug from 'debug';

import config from '../config';
import loadPlatforms, { PlatformMap } from "./load-platforms";

const log = debug('sockethub:server:bootstrap:init');

export interface IInitObject {
  version: string,
  platforms: PlatformMap
}

let init: IInitObject;

function printSettingsInfo(version, platforms) {
  // eslint-disable-next-line security-node/detect-crlf
  console.log('sockethub ' + version);
  console.log();

  // eslint-disable-next-line security-node/detect-crlf
  console.log('websocket: ws://' + config.get('sockethub:host') + ':'
    + config.get('sockethub:port')
    + config.get('sockethub:path'));

  console.log();
  // eslint-disable-next-line security-node/detect-crlf
  console.log('examples: ' + (config.get('examples:enabled') ?
    'http://' +
    config.get('public:host') + ':' + config.get('public:port') + config.get('public:path')
    : 'disabled'));

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
    for (const platform of platforms.values()) {
      console.log();
      // eslint-disable-next-line security-node/detect-crlf
      console.log(platform.moduleName);
      // eslint-disable-next-line security-node/detect-crlf
      console.log(' name: ' + platform.id + ' version: ' + platform.version);
      // eslint-disable-next-line security-node/detect-crlf
      console.log(' AS types: ' + platform.types.join(', '));
    }
  }
  console.log();
  process.exit();
}
export default async function getInitObject(): Promise<IInitObject> {
  if (init) { return init; } else { return await loadInit(); }
}
async function loadInit(): Promise<IInitObject> {
  log('running init routines');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const packageJSON = require('./../../package.json');
  const version = packageJSON.version;
  const platforms = await loadPlatforms(config.get('platforms') as Array<string>);

  if (config.get('info')) {
    printSettingsInfo(packageJSON.version, platforms);
  }
  log('finished init routines');
  return {
    version: version,
    platforms: platforms
  };
}
