if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function () {
  var suites = [];

  suites.push({
    name: "HTTP / REST tests",
    runInBrowser: false,
    desc: "collection of tests to test HTTP calls (using fetch)",
    setup: function (env, test) {
      this.assertAnd(this._message, '');
      env.expected = { // struct of expected results for each http call
        test: {
          foo: "bar"
        }
      };
      env.server = new this.HttpServer({
        port: 9991,
        uris: env.expected
      });

      env.baseUrl = 'http://127.0.0.1:9991';

      env.server.run(function () {
        test.write('http dummy server running');
        test.fetch.json(env.baseUrl + '/').then(function (data) {
          test.assert(data, { name: "jaribu" });          
        }, function (r) {
          test.result(false, 'failed http request on / : ', r);
        });
      });
    },
    takedown: function (env, test) {
      env.server.stop();
      this.result(true);
    },
    tests: [
      {
        desc: "same call as in setup, from test",
        run: function (env, test) {
          test.fetch.json(env.baseUrl + '/').then(function (data) {
            console.log(data);
            test.assert(data, { name: "jaribu" });
          }, function (r) {
            test.result(false, 'failed http request on / ' + r.statusText);
          });
        }
      },
      {
        desc: "GET /testBAD",
        run: function (env, test) {
          test.fetch.json(env.baseUrl + '/testBAD').then(function (data) {
            test.result(false, 'shouldn\'t succeed in fetching a bad URL ' + data);
          }, function (r) {
            test.assertAnd(404, r.status);
            test.result(true, 'failed get /testBAD');
          });
        }
      },
      {
        desc: "GET /test",
        run: function (env, test) {
          test.fetch.json(env.baseUrl + '/test').then(function (data) {
            test.assert(data, { foo:'bar' });
          }, function (r) {
            test.result(false, 'failed get /test');
          });
        }
      },
      {
        desc: "POST /test",
        run: function (env, test) {
          test.fetch.json(env.baseUrl + '/test', { foo: "baz" }).then(function (data) {
            console.log('data: ', data);
            test.assert(data, 'POST /test');
          }, function (r) {
            test.result(false, 'failed post /test');
          });
        }
      },
      {
        desc: "GET /test with new data",
        run: function (env, test) {
          test.fetch.json(env.baseUrl + '/test').then(function (data) {
            test.assert(data, { foo:'baz' });
          }, function (r) {
            test.result(false, 'failed get /test');
          });
        }
      },
      {
        desc: "DEL /test",
        run: function (env, test) {
          test.fetch.json(env.baseUrl + '/test', 'delete').then(function (data) {
            test.assert(data, 'DEL /test');
          }, function (r) {
            test.result(false, 'failed DEL /test');
          });
        }
      }
    ]
  });

  return suites;
});