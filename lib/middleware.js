/**
 * a very simple middleware handler for socket.io.
 *
 * You run it passing in a list of functions to call in order. It then returns
 * a function which accepts the message from socket.io. That function then will
 * call each of the originally passed in functions, in order, with the msg as the
 * first param and a callback as the second.
 *
 * If any of the functions call the callback with `false` as the param, the
 * execution of the function chain is halted.
 *
 */
module.exports = function () {
  var funcs = Array.prototype.slice.call(arguments);

  return function (msg) {
    var count = 0;
    if (typeof funcs[count] !== 'function') {
      throw new Error('middleware function can only take other functions as arguments. ', funcs);
    }

    function _callFunc(pos) {
      if (pos + 1 === funcs.length) {
        // last call, don't wait for next callback
        funcs[pos].apply(this, [msg]);
        return;
      }

      funcs[pos].apply(this, [msg, function (next) {
        if ((typeof next === 'boolean') && (! next)) {
          // failed, abort.
          return;
        }

        count = count + 1;
        setTimeout(_callFunc(count), 0);
      }]);
    }
    _callFunc(count);
  };
};
