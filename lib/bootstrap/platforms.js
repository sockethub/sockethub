/**
 * bootstrap/platforms.js
 *
 * A Singleton responsible for finding and loading all valid sockethub
 * platforms, and whitelisting or blacklisting (or neither) based on the
 * config.
 */
const tv4            = require('tv4'),
      debug          = require('debug')('sockethub:bootstrap:platforms'),
      whitelist      = require('nconf').get('platforms:whitelist'),
      blacklist      = require('nconf').get('platforms:blacklist'),
      platformSchema = require('sockethub-schemas').platform;

module.exports = function (moduleList) {
  debug('finding and registering platforms from package list');
  const platforms = new Map(),
        prefix    = 'sockethub-platform-';

  // load platforms from package.json
  const rx = new RegExp('^' + prefix, 'i');

  for (let moduleName of moduleList) {
    if (rx.test(moduleName)) {
      // found a sockethub platform
      const platformName = moduleName.replace(rx, '');
      let willLoad = false;

      debug('registering ' + platformName + ' platform');

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

      if (willLoad) {
        // try to load platform
        const P = require(moduleName);
        const p = new P();
        const pjson = require('./../../node_modules/' + moduleName + '/package.json');
        let types = [];

        // validate schema property
        if (! tv4.validate(p.schema, platformSchema)) {
          throw new Error(platformName + ' platform schema failed to validate: ' +
            tv4.error.message);
        }

        if (typeof p.config !== 'object') {
          throw new Error(platformName +
            ' platform must have a config property that is an object.');
        }

        if (p.schema.credentials) {
          // register the platforms credentials schema
          types.push('credentials');
          tv4.addSchema('http://sockethub.org/schemas/v0/context/' + platformName
            + '/credentials', p.schema.credentials);
        }

        tv4.addSchema('http://sockethub.org/schemas/v0/context/' + platformName
                      + '/messages', p.schema.messages);

        if ((p.schema.messages.properties) && (p.schema.messages.properties['@type']) &&
            (p.schema.messages.properties['@type'].enum) &&
            (p.schema.messages.properties['@type'].enum.length > 0)) {
          types = [...types, ...p.schema.messages.properties['@type'].enum];
        }

        platforms.set(platformName, {
          id: platformName,
          moduleName: moduleName,
          version: pjson.version,
          '@types': types.join(', ')
        });
      }
    }
  }

  return platforms;
};
