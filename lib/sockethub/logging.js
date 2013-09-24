/**
 * This file is part of sockethub.
 *
 * © 2012-2013 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the AGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of sockethub can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */


/**
 * simple helper function to create uniform behavior with the console.* logging
 */
module.exports = function (p) {
  var type = p.type || undefined;
  var id = p.id || undefined;
  var console = p.console || console;
  var new_console = p.console;
  var debug = p.debug || false;

  var _console = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    log: console.log
  };

  if (type === 'listener') {
    new_console.info = function (msg, dump) {
      _console.info.apply(this, ['[#'+id+']'].concat(Array.prototype.slice.call(arguments)));
    };
    new_console.error = function (msg, dump) {
      _console.error.apply(this, ['[#'+id+']'].concat(Array.prototype.slice.call(arguments)));
    };
    new_console.debug = function (msg, dump) {
      if (debug) {
        _console.debug.apply(this, ['[#'+id+']'].concat(Array.prototype.slice.call(arguments)));
      }
    };
    new_console.warn = function (msg, dump) {
      _console.warn.apply(this, ['[#'+id+']'].concat(Array.prototype.slice.call(arguments)));
    };
    new_console.log = function (msg, dump) {
      _console.log.apply(this, ['[#'+id+']'].concat(Array.prototype.slice.call(arguments)));
    };
  } else {
    new_console.debug = function (msg, dump) {
      if (debug) {
        _console.debug.apply(this, [''].concat(Array.prototype.slice.call(arguments)));
      }
    };
  }
  return new_console;
};