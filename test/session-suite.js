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
      }
    ]
  });

  return suites;
});