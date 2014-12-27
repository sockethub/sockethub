/**
 * bootstrap/platforms.js
 *
 * A Singleton responsible for finding and loading all valid sockethub
 * platforms, and whitelisting or blacklisting (or neither) based on the
 * config.
 *
 */

var ArrayKeys      = require('array-keys'),
    tv4            = require('tv4'),
    debug          = require('debug')('sockethub:bootstrap:platforms'),
    packageJSON    = require('./../../package.json'),
    whitelist      = require('nconf').get('platforms:whitelist'),
    blacklist      = require('nconf').get('platforms:blacklist'),
    platformSchema = require('./../schemas/platform');


module.exports = {
  init: function () {
    debug('finding and registering platforms');

    var platforms = new ArrayKeys(),
        prefix    = 'sockethub-platform-';

    // load platforms from package.json
    var rx = new RegExp('^' + prefix, 'i');
    var keys = Object.keys(packageJSON.dependencies);

    for (var i = 0, len = keys.length; i < len; i += 1) {
      if (rx.test(keys[i])) {
        // found a sockethub platform
        var platformName = keys[i].replace(rx, '');
        var willLoad = false;

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
          debug('validating ' + platformName + ' platform');
          var p;
          // try to load platform
          try {
            p = require(keys[i]);
            p = new p();
          } catch (e) {
            throw new Error(e);
          }

          // validate schema property
          if (! tv4.validate(p.schema, platformSchema)) {
            throw new Error('platform ' + platformName + ' schema: ' + tv4.error.message);
          }

          // register the platforms credentials schema
          var credentials = p.schema.credentials;
          var credentialsSchema = credentials;

          var messages = p.schema.messages;
          var messagesSchema = messages;
          tv4.addSchema('http://sockethub.org/schemas/v0/platforms/' + platformName + '/credentials', credentialsSchema);
          tv4.addSchema('http://sockethub.org/schemas/v0/platforms/' + platformName + '/messages', messagesSchema);

          debug('registering ' + platformName + ' platform');
          platforms.addRecord({
            id: platformName,
            moduleName: keys[i]
          });
        }
      }
    }

    return platforms;
  }
};
