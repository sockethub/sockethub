/**
 * Function: Throws
 *
 * used to tell a test that the function run expects a thrown exception
 *
 * Parameters:
 *
 *   function - function to run which should throw the exception.
 *   expected - the expected error [optional]
 *   message  - message if failure (exception does not throw) [optional]
 *
 */
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function (undefined) {
  function Throws() {
  }

  Throws.prototype.run = function (func, expected, message) {
    if (typeof func !== 'function') {
      throw new Error('throws takes at least one parameter, a function to run.');
    }

    if (typeof expected === 'string') {
      message = expected;
      expected = undefined;
    }

    var self = this;
    function evaluateException (e) {
      if (expected) {
        if (e instanceof expected) {
          self.write(message);
          self.result(true);
        } else {
          self.assertAnd(e.name, expected.name, 'throws: expected error type does not match exception');
          self.write(message);
          self.result(true);
        }
        return;
      } else {
        self.write(message);
        self.result(true);
        return;
      }
    }

    this.willThrow = true;

    if (typeof process === 'undefined') {
      window.addEventListener('error', function testHandler(evt) {
        ///console.log('throws caught exception');
        if (typeof self._result === 'undefined') {
          // only handle exceptions for tests which are being evaluated right now
          // (eg. have an undefined result
          evaluateException(evt.error);
        }
      });
    } else {
      process.on('uncaughtException', function testHandler(e) {
        ///console.log('throws caught exception');
        if (typeof self._result === 'undefined') {
          // only handle exceptions for tests which are being evaluated right now
          // (eg. have an undefined result
          evaluateException(e);
        }
      });
    }

    try {
      func();
    } catch (e) {
      evaluateException(e);
    }

  };

  return Throws;
});