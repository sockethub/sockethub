if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  var theTest = {
    name: "lots-o-tests (#17)",
    desc: "try to max out the test buffer",
    abortOnFail: true,
    setup: function (env, test) {
      test.result(true);
    }
  };

  function _t(env, test) {
    test.result(true);
  }
  var lotsOfTests = [];
  for (var j = 0; j < 2000; j = j + 1) {
    lotsOfTests[j] = {
      desc: 'lots-o-tests, test #'+j,
      run: _t
    };
  }
  theTest.tests = lotsOfTests;
  suites.push(theTest);

  return suites;
});