/**
 * a very simple middleware handler for socket.io.
 *
 * You run it passing in a list of functions to call in order. It then returns
 * a function which accepts the message from the input. That function then will
 * call each of the originally passed in functions, in order, with a payload
 * as the first param and an optional callback as the second, with the next handler last.
 *
 * If any of the functions call the next handler with `false` as the param, the
 * execution of the function chain is halted, and the failure callback is called.
 *
 */
function Middleware(errorHandler) {
  this.errorHandler = errorHandler;
}

Middleware.prototype.chain = function (...funcs) {
  let self = this;
  return (...params) => {
    let count = 0;
    if (typeof funcs[count] !== 'function') {
      throw new Error('middleware function can only take other functions as arguments. ', funcs);
    }

    function _callFunc(pos) {
      if (pos + 1 === funcs.length) {
        // last call, don't wait for next callback
        funcs[pos].apply(this, params);
        return;
      }

      function _nextFunc(status, ..._params) {
        if ((typeof status === 'boolean') && (! status)) {
          // failed, abort.
          self.errorHandler(..._params);
        } else if ((status) && (_params.length > -1)) {
          // re-assign/update the payload object
          params = _params;
        }
        count = count + 1;
        setTimeout(_callFunc.bind(this, count), 0);
      }

      funcs[pos].apply(this, [_nextFunc].concat(params));
    }
    _callFunc(count);
  };
};

module.exports = Middleware;