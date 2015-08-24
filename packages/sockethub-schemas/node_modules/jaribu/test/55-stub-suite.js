if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function () {
  var suites = [];

  suites.push({
    desc: "should be able to set up dummy functions (stubs)",
    tests: [
      {
        desc: "make a stub function that returns its params",
        run: function (env) {
          var stub = new this.Stub(function (p) {
            return p;
          });
          this.write('stub.called: '+stub.called);
          var ret = stub('yarg');
          this.write('ret:'+ret);
          this.write('stub.called: '+stub.called);
          this.assert(ret, 'yarg');
        }
      }
    ]
  });


  suites.push({
    desc: "dummy functions (stubs) should give some basic info about usage",
    setup: function (env) {
      env.myStub = new this.Stub(function (p) {
        return p;
      });
      this.result(true);
    },
    tests: [
      {
        desc: "called is false",
        run: function (env) {
          this.assert(env.myStub.called, false);
        }
      },
      {
        desc: "env func works",
        run: function (env) {
          ret = env.myStub('yarg');
          this.assert(ret, 'yarg');
        }
      },
      {
        desc: "called is true",
        run: function (env) {
          this.assert(env.myStub.called, true);
        }
      },
      {
        desc: "numCalled is 1",
        run: function (env) {
          this.assert(env.myStub.numCalled, 1);
        }
      }
    ]
  });

  return suites;
});