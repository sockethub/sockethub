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
declare function Middleware(errorHandler: any): void;
export default Middleware;
