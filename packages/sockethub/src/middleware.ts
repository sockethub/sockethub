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
export default function middleware(...chain) {
  for (let func of chain) {
    if (typeof func !== 'function') {
      throw new Error('middleware chain can only take other functions as arguments.');
    }
  }
  return getMiddlewareInstance(chain);
}

function getMiddlewareInstance(chain) {
  return (...initialParams) => {
    // placeholder callback in case one is not provided
    let complete = (err?: Error) => {
      if (err) {
        throw err;
      }
    };
    let position = 0;

    if (typeof initialParams[initialParams.length - 1] === 'function') {
      complete = initialParams.pop();
    }

    function callFunc(...params) {
      if (params[0] instanceof Error) {
        complete(params[0]);
      } else if (typeof chain[position] === 'function') {
        params.push(callFunc);
        chain[position++](...params);
      } else {
        complete();
      }
    }

    callFunc(...initialParams);
  };
}