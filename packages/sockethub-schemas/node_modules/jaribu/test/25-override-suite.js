if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function () {
  var suites = [];

  suites.push({
    name: "jaribu override",
    desc: "testing overriden methods and timeouts",
    setup: function () { this.result(true); },
    takedown: function () { this.result(true); },
    beforeEach: function () { this.result(true); },
    afterEach: function () { this.result(true); },
    timeout: 3000,
    tests: [
      {
        desc: "testing async timeout failure (default timeout)",
        willFail: true, // this test SHOULD fail
        run: function () {
          var _this = this;
          setTimeout(function () {
            _this.result(true);
          }, 4000);
        }
      },
      {
        desc: "overloaded methods work",
        setup: function () { this.result(true); },
        takedown: function () { this.result(true); },
        run: function () {
          this.assert(1, 1);
        }
      },
      {
        desc: 'test for environment object',
        setup: function (env) {
          env.fooBar = 'baz';
          this.result(true);
        },
        run: function (env) {
          this.assert(env.fooBar,'baz');
        }
      },
      {
        desc: "testing extended async callback",
        run: function () {
          var _this = this;
          setTimeout(function () {
            _this.result(true);
          }, 2000);
        }
      },
      {
        desc: "testing async callback with extended wait period",
        timeout: 4000,
        run: function () {
          var _this = this;
          setTimeout(function () {
            _this.result(true);
          }, 3000);
        }
      },
      {
        desc: "testing async timeout failure (extended timeout)",
        willFail: true, // this test SHOULD fail
        timeout: 4000,
        run: function () {
          var _this = this;
          setTimeout(function () {
            _this.result(true);
          }, 5000);
        }
      }
    ]
  });

  return suites;
});
