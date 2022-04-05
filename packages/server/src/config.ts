import nconf from 'nconf';
import { debug } from 'debug';
import * as fs from "fs";

const log = debug('sockethub:server:bootstrap:config');

export class Config {
  constructor() {
    log('initializing config');
    // assign config loading priorities (command-line, environment, cfg, defaults)
    nconf.argv({
      'info': {
        type: 'boolean',
        describe: 'Display Sockethub runtime information'
      },
      'examples': {
        type: 'boolean',
        describe: 'Enable the examples pages served at [host]:[port]/examples'
      },
      'config': {
        alias: 'c',
        default: '',
        describe: 'Path to sockethub.config.json'
      },
      'port': {
        alias: 'sockethub.port'
      },
      'host': {
        alias: 'sockethub.host'
      },
      'redis_host': {
        alias: 'redis.host'
      },
      'redis_port': {
        alias: 'redis.port'
      },
      'redis_url': {
        alias: 'redis.url'
      }
    });
    nconf.env();

    // get value of flags defined by any command-line params
    const examples = nconf.get('examples');

    // Load the main config
    let configFile = nconf.get('config');
    if (configFile) {
      if (! fs.existsSync(configFile)) {
        throw new Error(`Config file not found: ${configFile}`);
      }
    } else {
      configFile = __dirname + '/../sockethub.config.json';
    }
    nconf.file(configFile);

    // only override config file if explicitly mentioned in command-line params
    nconf.set('examples:enabled', (examples ? true : nconf.get('examples:enabled')));

    // load defaults
    const defaults: object = require(__dirname + '/defaults.json');
    nconf.defaults(defaults);

    nconf.required(['platforms']);

    function defaultEnvParams(host: string, port: string | number, prop: string) {
      nconf.set(prop + ':host', host);
      nconf.set(prop + ':port', port);
    }

    defaultEnvParams(
      process.env.HOST || nconf.get('sockethub:host'),
      process.env.PORT || nconf.get('sockethub:port'),
      'sockethub'
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
  }
  get = (key: string): any => nconf.get(key);
}

const config = new Config();
export default config;
