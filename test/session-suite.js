if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function(require) {
  var suites = [];

  suites.push({
    name: "Session singleton tests",
    desc: "collection of tests for the Session singleton object",
    setup: function(env, test) {
      env.Session = require('../lib/protocols/sockethub/session');
      test.result(true);
    },
    tests: [
      {
        desc: "Session.get returns a new session object",
        run: function(env, test) {
          var session = env.Session.get('sid1');
          test.assertType(session, 'object');
        }
      },
      {
        desc: "Session.get with the same session ID returns the same object",
        run: function(env, test) {
          var session = env.Session.get('sid1');
          var sameSession = env.Session.get('sid1');
          test.assert(session, sameSession);
        }
      },
      {
        desc: "Session.get with another session ID returns a different object",
        run: function(env, test) {
          var session1 = env.Session.get('sid1');
          var session2 = env.Session.get('sid2');
          test.assertFail(session1, session2);
        }
      },
      {
        desc: "Session.destroy removes a session",
        run: function(env, test) {
          var session = env.Session.get('sid1');
          env.Session.destroy('sid1');
          var newSession = env.Session.get('sid1');
          test.assertFail(session, newSession);
        }
      },
      {
        desc: "Session.destroy doesn't affect sessions with a different ID",
        run: function(env, test) {
          var s1 = env.Session.get('sid1');
          var s2 = env.Session.get('sid2');
          env.Session.destroy('sid1');
          var sameSession2 = env.Session.get('sid2');
          test.assert(s2, sameSession2);
        }
      }
    ]
  });

  suites.push({
    name: "Session instance tests",
    desc: "collection of tests for the Session instance",
    setup: function(env, test) {
      env.Session = require('../lib/protocols/sockethub/session');
      env.sid = 'test-sid';
      test.result(true);
    },
    beforeEach: function(env, test) {
      env.session = env.Session.get(env.sid);
      test.assertType(env.session, 'object');
    },
    afterEach: function(env, test) {
      env.Session.destroy(env.sid);
      test.result(true);
    },
    tests: [
      {
        desc: "Session#addPlatform remembers the platform",
        run: function(env, test) {
          test.assertAnd(env.session.getPlatforms(), []);
          env.session.addPlatform('foo');
          test.assert(env.session.getPlatforms(), ['foo']);
        }
      },
      {
        desc: "Session#addPlatform doesn't add a platform twice",
        run: function(env, test) {
          env.session.addPlatform('foo');
          env.session.addPlatform('foo');
          test.assert(env.session.getPlatforms(), ['foo']);
        }
      },
      {
        desc: "Session#register sets the session to registered",
        run: function(env, test) {
          env.session.register();
          test.result(env.session.isRegistered());
        }
      },
      {
        desc: "Session#unregister sets the session to unregistered",
        run: function(env, test) {
          env.session.register();
          test.assertAnd(env.session.isRegistered(), true);
          env.session.unregister();
          test.assert(env.session.isRegistered(), false);
        }
      },
      {
        desc: "Session#configure sets the settings",
        run: function(env, test) {
          env.session.configure({ foo: 'bar' });
          test.assert(env.session.getSettings(), { foo: 'bar' });
        }
      },
      {
        desc: "Session#reset clears platforms and settings",
        run: function(env, test) {
          env.session.configure({ foo: 'bar' });
          env.session.addPlatform('phu-quoc');
          env.session.reset();
          test.assertAnd(env.session.getSettings(), {});
          test.assert(env.session.getPlatforms(), []);
        }
      },
      {
        desc: "Session#get returns a promise",
        run: function(env, test) {
          var promise = env.session.get('foo', 'bar');
          test.assertTypeAnd(promise, 'object');
          test.assertType(promise.then, 'function');
        }
      },
      {
        desc: "Session#get fails when it has no remoteStorage config",
        run: function(env, test) {
          var promise = env.session.get('foo', 'bar');
          promise.then(function() {
            test.result(false, "Expected Session#get to fail, but it succeeded");
          }, function() {
            test.result(true);
          });
        }
      }
    ]
  });

  suites.push({
    name: "Session settings from remote",
    desc: "Session interaction with remoteStorage",
    setup: function(env, test) {

      env.Session = require('../lib/protocols/sockethub/session');
      env.sid = 'test-sid';

      var http = require('http');
      env.testServer = http.createServer(function(req, res) {
        env.captured.push(req);
        var r = env.simulateResponse;
        res.writeHead(r[0], r[1]);
        res.write(r[2]);
        res.end();
      });
      env.testServer.listen(12345, function() {
        test.result(true);
      });
    },
    takedown: function(env, test) {
      env.testServer.close(function() {
        test.result(true);
      });
    },
    beforeEach: function(env, test) {
      env.session = env.Session.get(env.sid);
      env.session.configure({
        storageInfo: {
          href: 'http://localhost:12345/storage',
        },
        bearerToken: 'test-token'
      });
      env.captured = [];
      env.simulateResponse = [200, { 'Content-Type': 'text/plain'}, 'Hello World'];
      test.result(true);
    },
    afterEach: function(env, test) {
      env.Session.destroy(env.sid);
      test.result(true);
    },
    tests: [
      {
        desc: "Session#get sends a request",
        run: function(env, test) {
          return env.session.get('foo', 'bar').
            then(function() {
              test.assert(env.captured.length, 1);
            });
        }
      },
      {
        desc: "Session#get builds the path based on storage-root, module and path",
        run: function(env, test) {
          return env.session.get('foo', 'bar').
            then(function() {
              var req = env.captured[0];
              test.assert(req.url, '/storage/foo/bar');
            });
        }
      },
      {
        desc: "Session#get sets the Authorization header correctly",
        run: function(env, test) {
          return env.session.get('phu', 'quoc').
            then(function() {
              var req = env.captured[0];
              test.assert(req.headers['authorization'], 'Bearer test-token');
            });
        }
      },
      {
        desc: "Session#get yields the response body and MIME type",
        run: function(env, test) {
          return env.session.get('foo', 'bar').
            then(function(result) {
              test.assertAnd(result.mimeType, 'text/plain');
              test.assert(result.data, 'Hello World');
            });
        }
      },
      {
        desc: "Session#get unpacks JSON data",
        run: function(env, test) {
          env.simulateResponse = [200, { 'Content-Type': 'application/json' },
                                  '{"phu":"quoc"}'];
          return env.session.get('foo', 'baz').
            then(function(result) {
              test.assert(result, { phu: 'quoc' });
            });
        }
      }
    ]
  });

  return suites;
});

