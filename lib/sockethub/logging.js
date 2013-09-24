

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