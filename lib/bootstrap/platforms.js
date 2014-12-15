/**
 * bootstrap/platforms.js
 *
 * A Singleton responsible for finding and loading all valid sockethub
 * platforms, and whitelisting or blacklisting (or neither) based on the
 * config.
 *
 */

var ArrayKeys   = require('array-keys'),
    debug       = require('debug')('sockethub:bootstrap:platforms'),
    packageJSON = require('./../../package.json'),
    whitelist   = require('nconf').get('platforms:whitelist'),
    blacklist   = require('nconf').get('platforms:blacklist');


module.exports = {
  init: function () {
    debug('finding and registering platforms');

    var platforms = new ArrayKeys(),
        prefix    = 'sockethub-platform-';

    // load platforms from package.json
    (function () {
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
            debug('loading ' + platformName + ' platform');
            platforms.addRecord({
              id: platformName,
              moduleName: keys[i]
            });
          }
        }
      }
    })();

    function Platforms () {}

    Platforms.prototype.list = function () {
      return platforms.getIdentifiers();
    };

    Platforms.prototype.exists = function (platform) {
      return platforms.exists(platform);
    };

    return new Platforms();
  }
};
