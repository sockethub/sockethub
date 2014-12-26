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
