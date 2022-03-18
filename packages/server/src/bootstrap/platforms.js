/**
 * bootstrap/platforms.js
 *
 * A Singleton responsible for finding and loading all valid Sockethub
 * platforms, and whitelisting or blacklisting (or neither) based on the
 * config.
 */
const debug   = require('debug'),
      schemas = require('@sockethub/schemas');

const log = debug('sockethub:server:bootstrap:platforms');

log('loading platforms');

// if the platform schema lists valid types it implements (essentially methods/verbs for
// Sockethub to call) then add it to the supported types list.
function platformListsSupportedTypes(p) {
  return ((p.schema.messages.properties) && (p.schema.messages.properties.type) &&
    (p.schema.messages.properties.type.enum) &&
    (p.schema.messages.properties.type.enum.length > 0));
}

module.exports = function platformLoad(platformsList, requireModule) {
  if (!requireModule) {
    requireModule = require;
  }
  // load platforms from config.platforms
  const platforms = new Map();

  if (platformsList.length <= 0) {
    throw new Error('No platforms defined. Please check your sockethub.config.json');
  }

  for (let moduleName of platformsList) {
    log(`loading ${moduleName}`);
    // try to load platform
    // eslint-disable-next-line security-node/detect-non-literal-require-calls
    const P = requireModule(moduleName);
    const p = new P();
    let types = [];

    const err = schemas.validator.validatePlatformSchema(p.schema);
    if (err) {
      throw new Error(`${moduleName} ${err}`);
    } else if (typeof p.config !== 'object') {
      throw new Error(
        `${moduleName} platform must have a config property that is an object.`);
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

    const platformName = p.schema.name;
    platforms.set(platformName, {
      id: platformName,
      moduleName: moduleName,
      config: p.config,
      schemas: {
        credentials: p.schema.credentials || {},
        messages: p.schema.messages || {}
      },
      version: p.schema.version,
      types: types
    });
  }
  return platforms;
};
