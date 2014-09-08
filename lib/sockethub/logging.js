/**
 * This file is part of sockethub.
 *
 * copyright 2012-2013 Nick Jennings (https://github.com/silverbucket)
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
  var controller = p.controller || undefined;
  var id = p.id || undefined;
  var console = p.console || console;
  var new_console = p.console;
  var debug = p.debug || false;
  var logfile = p.logfile || false; // place to log to, if false - no logging
  var verbose = p.verbose || false; // if true, no matter if logging happens,
                                    // still output verbosely to console

  var _console = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    log: console.log
  };

  //
  // listener controller logs get their worker id prepended
  var pre;
  if (controller === 'listener') {
    pre = '[#'+id+']';
  }

  //
  // winston is the logging module we use to write to a logfile
  var winston;
  if (logfile) {
    // initialize winston
    winston = require('winston');
    winston.add(winston.transports.File, {
        filename: logfile,
        colorize: false,
        timestamp: true,
        maxsize: 25600,
        json: false
    });
    winston.remove(winston.transports.Console);
    winston.log('info', "\n--- initialized logging --", []);
  }

  function log() {
    var args = Array.prototype.slice.call(arguments);
    var text = args.shift();
    var dump = args.shift() || [];
    winston.log('info', text, dump);
  }

  //
  // general function each console.* function calls to display the message
  function display() {
    var args = Array.prototype.slice.call(arguments);
    var type = args.shift();
    if (pre) {
      args.unshift(pre);
    }
    _console[type].apply(this, args);
  }

  //
  // provide new console.* wrapper functions
  new_console.info = function () {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('info');

    if (verbose) {
      display.apply(this, args);
    }

    if (logfile) {
      log.apply(this, args);
    }
  };

  new_console.error = function () {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('error');

    // always display errors to console
    display.apply(this, args);

    if (logfile) {
      log.apply(this, args);
    }
  };

  new_console.debug = function () {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('debug');

    if ((debug) && (verbose)) {
      display.apply(this, args);
    }

    if ((debug) && (logfile)) {
      log.apply(this, args);
    }
  };

  new_console.warn = function () {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('warn');

    if (verbose) {
      display.apply(this, args);
    }

    if (logfile) {
      log.apply(this, args);
    }
  };


  if (controller === 'listener') {
    new_console.log = function () {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('log');

      if (verbose) {
        display.apply(this, args);
      }

      if (logfile) {
        log(args);
      }
    };
  }

  new_console.always = function () {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('info');

    // always display 'always' logs to console
    display.apply(this, args);

    if (logfile) {
      log.apply(this, args);
    }
  };

  return new_console;
};