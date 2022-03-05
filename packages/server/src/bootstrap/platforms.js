/**
 * bootstrap/platforms.js
 *
 * A Singleton responsible for finding and loading all valid Sockethub
 * platforms, and whitelisting or blacklisting (or neither) based on the
 * config.
 */
const debug   = require('debug'),
      schemas = require('@sockethub/schemas'),
      findup  = require('findup-sync');

const config = require('../config').default;
const log = debug('sockethub:server:bootstrap:platforms');

const whitelist = config.get('platforms:whitelist'),
      blacklist = config.get('platforms:blacklist');

log('loading platforms');

// checks platform against black and whitelist.
function platformIsAccepted(platformName) {
  let willLoad = false;
  if (whitelist.length > 0) {
    if (whitelist.indexOf(platformName) >= 0) {
      willLoad = true;
    }
  } else if (blacklist.length > 0) {
    if (blacklist.indexOf(platformName) < 0) {
      willLoad = true;
    }
  } else {
    willLoad = true;
  }
  return willLoad;
}

// if the platform schema lists valid types it implements (essentially methods/verbs for
// Sockethub to call) then add it to the supported types list.
function platformListsSupportedTypes(p) {
  return ((p.schema.messages.properties) && (p.schema.messages.properties.type) &&
    (p.schema.messages.properties.type.enum) &&
    (p.schema.messages.properties.type.enum.length > 0));
}

module.exports = function platformLoad(moduleList) {
  // load platforms from package.json
  const rx = new RegExp('^@sockethub/platform-', 'i');
  const platforms = new Map();
  log('finding and registering platforms from package list');

  for (let moduleName of moduleList) {
    if (rx.test(moduleName)) {
      // found a sockethub platform
      const platformName = moduleName.replace(rx, '');
      log(`registering ${platformName} platform`);

      if (platformIsAccepted(platformName)) {
        // try to load platform
        // eslint-disable-next-line security-node/detect-non-literal-require-calls
        const P = require(moduleName);
        const p = new P();
        let path = findup(moduleName, { cwd: __dirname + '/../../node_modules' });
        if (! path) {
          path = findup(moduleName, { cwd: 'node_modules' });
        }
        // eslint-disable-next-line security-node/detect-non-literal-require-calls
        const packageJson = require(path + '/package.json');
        let types = [];

        const err = schemas.validator.validatePlatformSchema(p.schema);
        if (err) {
          throw new Error(`${platformName} ${err}`);
        } else if (typeof p.config !== 'object') {
          throw new Error(
            `${platformName} platform must have a config property that is an object.`);
        } else {
          if (p.schema.credentials) {
            // register the platforms credentials schema
            types.push('credentials');
          } else {
            p.config.noCredentials = true;
          }
        }

        if (platformListsSupportedTypes(p)) {
          types = [...types, ...p.schema.messages.properties.type.enum];
        }

        platforms.set(platformName, {
          id: platformName,
          moduleName: moduleName,
          config: p.config,
          schemas: {
            credentials: p.schema.credentials || {},
            messages: p.schema.messages || {}
          },
          version: packageJson.version,
          types: types
        });
      }
    }
  }

  return platforms;
};
