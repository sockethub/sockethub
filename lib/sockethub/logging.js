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
  var controller = p.controller || undefined;
  var id = p.id || undefined;
  var console = p.console || console;
  var new_console = p.console;
  var debug = p.debug || false;
  var logfile = p.logfile || false; // place to log to, if false - no logging
  var output = p.output || false; // if true, no matter if logging happens,
                                  // still output to console

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
  }

  function log() {
    var args = Array.prototype.slice.call(arguments);
    var type = args.shift();
    //console.log("WINSTON ["+type+"]:", args[0]);
    winston.log(type, args[0], args[1], function (err, level, msg) {
      // console.log('ERR',err);
      // console.log('LEV',level);
      // console.log('MSG',msg);
    });
  }


  //
  // general function each console.* function calls to display the message
  function display() {
    var args = Array.prototype.slice.call(arguments);
    var type = args.shift();
    //console.log("DIPLAY["+controller+":"+type+":"+pre+"]: ", args);
    if (pre) {
      args.unshift(pre);
    }
    _console[type].apply(this, args);
  }



  // provide new console.* wrapper functions
  new_console.info = function (msg, dump) {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('info');

    if (output) {
      display.apply(this, args);
    }

    if (logfile) {
      log.apply(this, args);
    }
  };

  new_console.error = function (msg, dump) {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('error');

    // always display errors to console
    display.apply(this, args);

    if (logfile) {
      log.apply(this, args);
    }
  };

  new_console.debug = function (msg, dump) {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('debug');

    if ((debug) && (output)) {
      display.apply(this, args);
    }

    if (logfile) {
      log.apply(this, args);
    }
  };

  new_console.warn = function (msg, dump) {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('warn');

    if (output) {
      display.apply(this, args);
    }

    if (logfile) {
      log.apply(this, args);
    }
  };

  /*
  new_console.log = function (msg, dump) {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('log');
    if (output) {
      display.apply(this, args);
    }

    if (logfile) {
      log(args);
    }
  };
  */

  new_console.always = function (msg, dump) {
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