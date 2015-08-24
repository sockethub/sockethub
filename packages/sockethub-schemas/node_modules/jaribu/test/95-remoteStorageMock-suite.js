if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function (requirejs, undefined) {
  var suites = [];

  suites.push({
    name: "remoteStorage Mock tests",
    desc: "tests for the remoteStorage mock functionality",
    setup: function (env) {
      env.remoteStorage = new this.Stub.mock.remoteStorage({
        '12345': {
          'name': 'foo',
          'quote': 'bar'
        },
        '67890': {
          'name': 'yo',
          'quote': 'mama'
        },
        'abcde': {
          'name': 'pizza',
          'quote': 'toppings'
        },
        'fghij': {
          'name': 'code',
          'quote': 'word'
        },
        'work/82912/deadline': {
          'name': 'frank',
          'quote': 'busy man'
        },
        'work/lalala': {
          'name': 'billy',
          'quote': 'yah'
        }
      });

      this.assertTypeAnd(env.remoteStorage, 'object');
      this.assertTypeAnd(env.remoteStorage.baseClient, 'function');
      this.assertType(env.remoteStorage.defineModule, 'function');
    },
    tests: [
      {
        desc: "first, try to get a good listing from the mock directly",
        run: function (env) {
          var l = env.remoteStorage.baseClient.getListing('');
          var should_be = ['12345','67890','abcde','fghij'];
          this.assert(l, should_be);
        }
      },
      {
        desc: "try to get a bad listing from the mock directly",
        willFail: true,
        run: function (env) {
          var ss = env.remoteStorage.baseClient.getListing('spreadsheets/');
          this.assert(ss, 'object');
        }
      },
      {
        desc: "try loading a test module",
        run: function (env) {
          global.remoteStorage = env.remoteStorage;
          env.moduleImport = requirejs('./../test/resources/test_rs_module');
          this.assertTypeAnd(env.moduleImport[1], 'function');
          env.module = env.moduleImport[1](remoteStorage.baseClient, remoteStorage.baseClient).exports;
          this.assertType(env.module, 'object');
        }
      },
      {
        desc: "try to grab a listing",
        run: function (env) {
          var obj = env.module.getIds();
          var should_be = ['12345', '67890', 'abcde', 'fghij'];
          this.assert(obj, should_be);
        }
      },
      {
        desc: "try to grab some data from the module",
        run: function (env) {
          var obj = env.module.get('12345');
          var should_be = {
            'name': 'foo',
            'quote': 'bar'
          };
          this.assert(obj, should_be);
        }
      },
      {
        desc: "try save some data - NOT IMPLEMENTED",
        run: function (env) {
          var data = {
            'name': 'ninja',
            'quote': 'gaiden'
          };
          env.module.add(data, 'n777-n777');
          var obj = env.module.get('n777-n777');
          var should_be = {
            'name': 'ninja',
            'quote': 'gaiden'
          };
          this.assert(obj, should_be);
        }
      },
      {
        desc: "get object and specify a callback using the baseClient",
        run: function (env) {
          var _this = this;
          function testCallback(obj) {
            var should_be = {
              'name': 'foo',
              'quote': 'bar'
            };
            _this.assert(obj, should_be);
          }
          env.remoteStorage.baseClient.getObject('12345', testCallback);
        }
      },
      {
        desc: "get listing and specify a callback using the baseClient",
        run: function (env) {
          var _this = this;
          function testCallback(list) {
            var should_be = ['lalala'];
             console.log(list);
            _this.assert(list, should_be);
          }
          env.remoteStorage.baseClient.getListing('work/', testCallback);
        }
      },
      {
        desc: "get object and specify a callback using the module",
        run: function (env) {
          var _this = this;
          function testCallback(obj) {
            var should_be = {
              'name': 'foo',
              'quote': 'bar'
            };
            _this.assert(obj, should_be);
          }
          env.module.get('12345', testCallback);
        }
      },
      {
        desc: "get listing and specify a callback using module",
        run: function (env) {
          var _this = this;
          function testCallback(obj) {
            var should_be = {
              'name': 'foo',
              'quote': 'bar'
            };
            _this.assert(obj, should_be);
          }
          env.remoteStorage.baseClient.getObject('12345', testCallback);
        }
      },
      {
        desc: "try to break schema to test validation",
        willFail: true,
        run: function (env) {
          var data = {
            'name': 12345,
            'quote': 'evil!'
          };
          env.module.add(data, 'badman');
          var obj = env.module.get('badman');
          var should_be = {
            'name': 12345,
            'quote': 'evil!'
          };
          this.assert(obj, should_be);
        }
      },
      {
        desc: "test on 'error' callback",
        run: function (env) {
          var data = {
            'name': 12345,
            'quote': 'evil!'
          };
          var _this = this;
          env.module.on('error', function (err) {
            // we got the callback from a failure!
            _this.write(err);
            _this.result(true);
          });
          env.module.add(data, 'badman');
        }
      },
      {
        desc: "test on 'change' callback",
        run: function (env) {
          var data = {
            'name': '12345',
            'quote': 'evil!'
          };
          var _this = this;
          env.module.on('change', function (obj) {
            // we got the callback from a failure!
            var should_be = {
              'name': '12345',
              'quote': 'evil!'
            };
            _this.assert(obj, should_be);
          });
          env.module.add(data, 'badman');
        }
      }
    ]
  });

  return suites;
});
