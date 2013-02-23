require("consoleplusplus/console++");
if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "email platform tests",
    desc: "collection of tests for the email platform",
    setup: function (env, test) {
      env.mailer = {
        send: this.Stub(function(obj, cb) {
          console.log('MAILER STUB CALLED');
          cb(null, true);
        })
      };
      GLOBAL.mailer = env.mailer;
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

          return session.getPlatformSession('email');
        }).
        then(function (psession) {
          env.psession = psession;
          env.psession.send = function (job) {
            test.write('psession send called:',job);
          };
          env.Email = require('../lib/protocols/sockethub/platforms/email');
          //console.log('email:', env.Email);
          test.result(true);
        });
    },
    tests: [
      {
        desc: "Subscribe to platform with credential details",
        run: function (env, test) {
          var job = {
            rid: '001',
            verb: 'subscribe',
            platform: 'email',
            object: {
              credentials: {
                'whitney@houston.com': {
                  smtp: {
                    host: 'mailservice.example.com',
                    username: 'whit',
                    password: 'ney'
                  }
                }
              }
            }
          };

          env.psession.setConfig('credentials', job.object.credentials).then(function () {
            env.psession.getConfig('credentials').then(function (creds) {
              test.assert(creds, job.object.credentials);
            }, function (err) {
              test.result(false, err);
            });
          }, function (err) {
            test.result(false, err);
          });
        }
      },
      {
        desc: "Email.send() calls mailer.send()",
        run: function (env, test) {
          var job = {
            rid: '002',
            verb: 'send',
            platform: 'email',
            actor: { name: 'Whitney Houston', address: 'whitney@houston.com' },
            object: { subject: 'Love you', text: 'I will always.' },
            target: { to: [{ name: 'Stevie Wonder', address: 'stevie@wonder.com' }] }
          };
          env.Email.send(job, env.psession).then(function (err, status, obj) {
            env.respHandler()(err, status, obj);
            test.assert(env.mailer.send.called, true);
          });
        }
      }
    ]
  });

  return suites;
});
