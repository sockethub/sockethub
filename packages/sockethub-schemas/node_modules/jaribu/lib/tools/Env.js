/**
 * Function: Env
 *
 * An object which handles the environment for all tests and scaffolding
 *
 * Returns:
 *
 *   returns a function which can be used to make Env objects
 */
 if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function (undefined) {
  var envSetFunc = function (env) {
    if (env !== undefined) { this._env = env; }
  };
  var envGetFunc = function () {
    return this._env;
  };
  function Env() {}
  Env.prototype = {
    _env: {}, // environment to run tests in
    set: envSetFunc,
    get: envGetFunc
  };
  return Env;
});