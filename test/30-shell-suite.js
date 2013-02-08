if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "shell platform tests",
    desc: "collection of tests for the shell platform",
    setup: function (env, test) {
      env.childProcess = {
        exec: this.Stub(function(obj, cb) {
          console.log('EXEC STUB CALLED');
          cb(null, true);
        })
      };
      GLOBAL.childProcess = env.childProcess;
      env.respHandler = function (testObj) {
        return function(err, status, obj) {
          if (testObj !== undefined) {
            testObj.write(' responseHandler: ['+err+'] ['+status+'] ['+obj+']');
            testObj.result(status);
          } else {
            test.write(' responseHandler: ['+err+'] ['+status+'] ['+obj+']');
          }
        };
      };

      var Session = require('../lib/protocols/sockethub/session');
      Session.get('testsess1').
        then(function (session) {
          env.session = session;

          return session.getPlatformSession('shell');
        }).
        then(function (psession) {
          env.psession = psession;
          env.psession.send = function (job) {
            test.write('psession send called:',job);
          };
          env.Shell = require('../lib/protocols/sockethub/platforms/shell');
          //console.log('shell:', env.Shell);
          test.result(true);
        });
    },
    tests: [
      {
        desc: "execute ls calls childProcess.childProcess",
        run: function (env, test) {
          var job = {
            rid: '001',
            verb: 'execute',
            platform: 'shell',
            object: 'ls'
          };

          env.Shell.execute(job, env.psession).then(function (err, status, obj) {
            env.respHandler()(err, status, obj);
            test.assert(env.Child_process.childProcess.called, true);
          });
        }
      }
    ]
  });

  return suites;
});
