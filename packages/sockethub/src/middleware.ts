/**
 * a very simple middleware handler
 *
 * When initialized, provide a function which will be called if there were any failures during
 * the execution of functions along the chain.
 *
 * Use middleware.chain, passing in a list of functions to call in order. It then returns
 * a function which accepts the message from the input. That function then will
 * call each of the originally passed in functions, in order, with a `next` callback as
 * the first parameter, and any number of originating parameters.
 *
 * As one middleware function is done, they call `next` with the first argument `true`
 * (succeeded, continue) any parameters to pass along.
 *
 * If any of the middleware function calls the `next` handler with `false` as the first param, the
 * execution of the function chain is halted, and the failure callback is called. Again, any
 * number of params passed after the `false` will be passed to the failure callback.
 *
 */
function Middleware(errorHandler: Function) {
  this.errorHandler = errorHandler;
}

Middleware.prototype.chain = function (...funcs) {
  let self = this;
  return (...params) => {
    let count = 0;
    if (typeof funcs[count] !== 'function') {
      throw new Error('middleware function can only take other functions as arguments.');
    }

    function _callFunc(pos: number) {
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

export default Middleware;