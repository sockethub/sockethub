/**
 * Returns a function which accepts a list of middleware functions to call, in order.
 * The errorHandler will be called whenever an error occurs.
 * @param {function} errorHandler
 * @return {function} chains a series of functions to be called in sequence
 */
export default function createMiddleware(errorHandler: Function) {
  return function chain(...chain: Array<Function>) {
    for (let func of chain) {
      if (typeof func !== 'function') {
        throw new Error('middleware chain can only take other functions as arguments.');
      }
    }
    return getMiddlewareInstance(chain, errorHandler);
  };
}


function getMiddlewareInstance(chain: Array<Function>, errorHandler: Function) {
  return (...initialParams) => {
    // placeholder callback in case one is not provided
    let callback = (err: Error|null) => { if (err) {} };
    let position = 0;

    if (typeof initialParams[initialParams.length - 1] === 'function') {
      // callback has been provided
      callback = initialParams.pop();
    }

    function callFunc(...params) {
      if (params[0] instanceof Error) {
        errorHandler(...params);
        callback(params[0]);
      } else if (typeof chain[position] === 'function') {
        params.push(callFunc);
        chain[position++](...params);
      } else {
        callback(null);
      }
    }

    callFunc(...initialParams);
  };
}

/**
 * When calling the middleware instance function, pass in a list of functions to call in order.
 * Each function can expect any number of params, but the final param should expect a callback.
 *
 * After all functions are completed, it will call the callback function. If any middleware calls
 * the callback with the first parameter an instance of Error, then the call stack will be aborted,
 * and the final callback (callback of first input) will be called with the Error as the first i
 * parameter.
 * Additionally, if provided during the `createMiddleware` call, the errorHandler will be called,
 * with the error object as the first parameter along with the remaining parameters.
 *
 * @param {function} middleware Any number of functions, each expecting a callback as the final
 * parameter.
 * @return {function} entry The entry function, which will start calling functions defined in the
 * chain.
 *
 * @example
 *
 *  const entry = middleware.chain(
 *    (data, cb) => {
 *      //... do something with data
 *      cb(data);
 *    },
 *    (data, cb) => {
 *      //... do more with data
 *      cb(data);
 *    },
 *    (data, cb) => {
 *      //... do last stuff with data
 *      cb();
 *    }
 *  );
 *
 *  entry(initialData, (err) => {
 *    // this function is called when complete or an error occurs anywhere on the chain
 *    // in which case execution is aborted.
 *  });
 *
 */
