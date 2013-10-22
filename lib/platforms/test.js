// test platform to test out error handling
var session;
function testFunc() {
  var p = session.promising();
  p.fulfill();
  return p;
}
module.exports = function () {
  return {
    schema: {},
    init: function (sess) {
      session = sess;
      var promise = session.promising();
      promise.fulfill();
      return promise;
    },
    fetch: function () {
      var promise = session.promising();
      return testFunc().then(function () {
        console.log("asdasadasd");
        throw new Error('TEST PLATFORM THROWING ERROR');
        promise.fulfill();
      });
      return promise;
    },
    post: function () {
      var promise = session.promising();
      promise.fulfill();
      return promise;
    },
    cleanup: function () {
      var promise = session.promising();
      promise.fulfill();
      return promise;
    }
  };
};