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

  return (...originalParams) => {
    let position = 0;
    let complete = originalParams.pop();
    if (typeof complete !== 'function') {
      // throw new Error('initial incoming parameters contain no final callback');
      originalParams.push(complete);
      complete = (data) => { console.log('middleware completed: ', data); };
    }

    if (typeof complete !== 'function') {
      throw new Error('middleware received incoming parameters with no callback');
    }

    function callback(...params) {
      if (params.length === 0) { throw new Error('callback call with no data'); }
      if (params[0] instanceof Error) {
        return complete(params[0]);
      } else {
        setTimeout(() => {
          callFunc(...params);
        }, 0);
      }
    }

    function callFunc(...params) {
      if (typeof chain[position] === 'function') {
        params.push(callback);
        chain[position++](...params);
      } else {
        complete();
      }
    }

    callFunc(...originalParams);
  };
}