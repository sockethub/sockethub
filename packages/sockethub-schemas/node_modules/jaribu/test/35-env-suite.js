if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function () {
  var suites = [];
  suites.push({
    name: "available environment",
    desc: "make sure the environment is accessible from within all phases of test",
    setup: function (env) {
      env.foo = 'bar';
      env.counter = 0;
      this.result(true);
    },
    takedown: function (env) {
      this.assert(env.foo, 'bar');
    },
    beforeEach: function (env) {
      env.counter = env.counter + 1;
      this.assert(env.foo, 'bar');
    },
    afterEach: function (env) {
      this.write('counter: '+env.counter);
      this.assert(env.foo, 'bar');
    },
    timeout: 3000,
    tests: [
      {
        desc: "making sure setup env is here",
        run: function (env) {
          this.assert(env.foo, 'bar');
        }
      },
      {
        desc: "making sure counter is updating",
        run: function (env) {
          this.assert(env.counter, 2);
        }
      },
      {
        desc: "check _message",
        run: function (env) {
          this.assert(this._message, '');
        }
      },
      {
        desc: "sandbox test env but keep setup env",
        run: function (env) {
          env.testVar = 'yarg';
          this.assert(env.foo, 'bar');
        }
      },
      {
        desc: "making sure var from setup3 is not here, and counter is at 5",
        run: function (env) {
          this.assert(env.counter, 5);
        }
      },
      {
        desc: "we shouldnt have variables from jaribu library",
        run: function (env) {
          if (typeof greybg !== 'undefined') {
            this.result(false);
          } else {
            this.result(true);
          }
        }
      }
    ]
  });

  return suites;
});