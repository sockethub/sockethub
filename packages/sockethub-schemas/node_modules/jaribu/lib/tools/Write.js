/**
 * Function: Write
 *
 * The write tool provides a way for tests to write test output, description of
 * what's going on, and have it display together with the tests. This does not
 * dump objects so is not a replacement for console.log
 *
 * Parameters:
 *
 *   text - the text to display in the test output.
 *
 * Returns:
 *
 *   the function to be used as 'write', it takes one argument, which
 *   is the text to display.
 */
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['jaribu/colors', 'jaribu/display'], function (colors, display, undefined) {
  var c = colors;
  var Write = function () {};
  Write.prototype = {
    _written: false
  };
  Write.prototype.func = function () {
    var args = Array.prototype.slice.call(arguments);
    var text = args.pop();
    var obj = args.pop();
    if (!this._written) {
      // first output needs a newline
      //display.linebreak();
      this._written = true;
    }
    // console.log('    ' + c.yellow + '> ' + text + c.reset);
    display.write(text);
    if (obj) {
      console.log(obj);
    }
  };
  return Write;
});