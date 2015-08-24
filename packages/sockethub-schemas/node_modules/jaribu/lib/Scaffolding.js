if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([
  'jaribu/helpers', 'jaribu/tools/Write', 'jaribu/tools/result',
  'jaribu/tools/assert', 'jaribu/tools/assertType', 'jaribu/tools/Env',
  'jaribu/fakes/Stub', 'jaribu/fakes/remoteStorageMock',
  'jaribu/tools/HttpServer', 'jaribu/tools/Throws',
  'jaribu/tools/WebSocketClient', 'jaribu/tools/WebSocketServer' ],
function (helpers, Write, result, assert, assertType, Env,
          Stub, remoteStorageMock, HttpServer, Throws,
          WebSocketClient, WebSocketServer, undefined) {

  /*
   * class definitions for suites, tests, and scaffolding
   */
  Stub.mock = {};
  Stub.mock.remoteStorage = remoteStorageMock;

  /*
   * The Scaffolding objects contain all of the functions and
   * properties available to any test (not just the 'run' test but
   * also the setup, takedown, afterEach and beforeEach tests).
   */
  var write = new Write();
  function Scaffolding() {
    // bind all methods, so they can be used as callbacks
    for (var key in this) {
      if (typeof(this[key]) === 'function' && ! key.match(/^[A-Z]/)) {
        this[key] = this[key].bind(this);
      }
    }

    this.throws = function () {
      var throwsObj;
      if (!throwsObj) {
        throwsObj = new Throws();
      }
      var args = Array.prototype.slice.call(arguments);
      throwsObj.run.apply(this, args);
    };
  }

  Scaffolding.prototype = {
    constructor: Scaffolding,
    type: "Scaffolding",
    helpers: helpers.pub,
    write: write.func,
    _written: false,
    status: undefined,
    assert: assert.assertHandler,
    assertFail: assert.assertFailHandler,
    assertAnd: assert.assertAndHandler,
    assertFailAnd: assert.assertFailAndHandler,
    assertType: assertType.assertTypeHandler,
    assertTypeFail: assertType.assertTypeFailHandler,
    assertTypeAnd: assertType.assertTypeAndHandler,
    assertTypeFailAnd: assertType.assertTypeFailAndHandler,
    _assert: assert.assert,
    _assertType: assertType.assertType,
    fetch: {
      json: (function () {
        var lPromise = (typeof Promise !== 'undefined') ? Promise : helpers.pub.fetch.Promise;

        function status(response) {
          if (response.status >= 200 && response.status < 300) {
            return lPromise.resolve(response);
          } else {
            return lPromise.reject(response);
          }
        }

        function json(response) {
          return response.json();
        }

        return function (url, postData) {
          if ((typeof postData === 'string') && (postData === 'delete')) {
            return helpers.pub.fetch(url, {
                      method: 'delete',
                      headers: {
                        'Accept': 'application/json'
                      },
                    })
                    .then(status)
                    .then(json);
          } else if (typeof postData === 'object') {
            return helpers.pub.fetch(url, {
                      method: 'post',
                      headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify(postData)
                    })
                    .then(status)
                    .then(json);
            
          } else {
            return helpers.pub.fetch(url)
                    .then(status)
                    .then(json);
          }
        };
      })()
    },
    Stub: Stub,
    HttpServer: HttpServer,
    WebSocketClient: WebSocketClient,
    WebSocketServer: WebSocketServer,
    timeout: 10000,
    env: undefined,
    run: helpers.runFunc,
    _running: false,
    _generatingStackTrace: false, // flag to indicate wether to ignore a thrown exception
    _result: undefined,
    _message: '',  // messages coming from the test tools
    _stackTrace: undefined,  // optional stack trace added by run()
    failmsg: '',  // the failure message, used later for summarys
    result: result,
    done: helpers.runFunc,
    fail: helpers.runFail
  };

  return Scaffolding;
});