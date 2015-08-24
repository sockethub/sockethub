/**
 * Function: Stub
 *
 * The Stub object is used to create stubs or mocks during tests. In addition to
 * running the function that's returned, the returned function contains the
 * properties 'called', 'numCalled' and 'origFunc'
 *
 *   var myStub = new Stub(function(param) {
 *     // do stuff
 *     return param;
 *   });
 *
 *   var foo = myStub('bar');
 *
 *   myStub.called;
 *   // ... true
 *   myStub.numCalled;
 *   // ... 1
 *   myStub.originalFunc;
 *   // ... [Function]
 *
 * Parameters:
 *
 *   function - the actual function for the stub to call
 *
 * Returns:
 *
 *   returns output from the function passed as parameter
 */
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function (undefined) {
  var Stub = function (returnFunc) {
    this.returnFunc = returnFunc;
    var _this_stub = this;
    var func = function () {
      var args = Array.prototype.slice.call(arguments);
      var self = arguments.callee;
      self.called = true;
      self.numCalled = self.numCalled + 1;
      // call the passed function with the arguments grabbed from func
      return _this_stub.returnFunc.apply(null, args);
    };
    func.called = false;
    func.numCalled = 0;
    func.origFunc = returnFunc;
    return func;
  };
  return Stub;
});
