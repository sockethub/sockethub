if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['jaribu/testlib'], function (testlib, undefined) {
  var suites = [];
  suites.push({
    name: "testlib",
    desc: "testing external lib",
    setup: function (env) {
      this.write('testlib: '+typeof testlib);
      this.assertType(testlib, 'object');
    },
    tests: [
      {
        desc: "verify external lib works",
        run: function (env) {
          rstring = testlib.stringBeast('yo', 'mama', 'so', 'stupid');
          this.assert(rstring, 'yomamasostupid');
        }
      },
      {
        desc: "verify external lib works (break)",
        willFail: true,
        run: function (env) {
          rstring = testlib.stringBeast('yo', 'mama', 'so', 'smelly');
          this.assert(rstring, 'yomamasostupid');
        }
      }
    ]
  });
  return suites;
});