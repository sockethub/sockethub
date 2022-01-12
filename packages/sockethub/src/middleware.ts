import { debug } from 'debug';

/**
 * Returns a function which accepts a list of middleware functions to call, in order.
 * The errorHandler will be called whenever an error occurs.
 * @return {function} chains a series of functions to be called in sequence
 */


export default function middleware(name: string): MiddlewareChain {
  return new MiddlewareChain(name);
}

class MiddlewareChain {
  public name: string;
  private chain: Array<Function> = [];
  private errHandler: Function = (err: Error) => { throw err; };
  private logger: Function;

  constructor(name: string) {
    this.name = name;
    this.logger = debug(`sockethub:middleware:${name}`);
  }

  use(func: Function): this {
    if (typeof func !== 'function') {
      throw new Error('middleware use() can only take a function as an argument');
    }
    if (func.length === 3) {
      this.errHandler = func;
    } else if (func.length === 2) {
      this.chain.push(func);
    } else {
      throw new Error(
        'middleware function provided with incorrect number of params: ' + func.length);
    }
    return this;
  }

  done() {
    return (data: any, callback: Function) => {
      let position = 0;
      if (typeof callback !== 'function') {
        callback = () => {};
      }
      const next = (_data: any) => {
        if (_data instanceof Error) {
          this.logger(_data);
          this.errHandler(_data, data, callback);
        } else if (typeof this.chain[position] === 'function') {
          this.chain[position++](_data, next);
        } else {
          callback(_data);
        }
      };
      next(data);
    };
  }
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
 *  const entry = createMiddleware(errorHandler)(
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
 *  entry(initialData, (err, data) => {
 *    // this function is called when complete or an error occurs anywhere on the chain
 *    // in which case execution is aborted.
 *  });
 *
 */
