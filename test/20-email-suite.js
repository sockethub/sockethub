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
      env.nodemailer = {};
      var sendMailStub = new test.Stub(function sendMail(msg, cb) {
          console.log('NODEMAILER sendMail STUB CALLED');
          cb(null, true);
        });
      env.nodemailer.createTransport = new test.Stub(function createTransportStub(name, obj) {
          if (name === 'SMTP') {
            console.log('NODEMAILER createTransport STUB CALLED');
            var ret =  {};
            ret.sendMail = sendMailStub;
            return ret;
          }
        });
      GLOBAL.nodemailer = env.nodemailer;

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

      GLOBAL.redis = require('redis');
      env.Session = require('./../lib/sockethub/session')({platform:'email', sockethubId:'1234567890', encKey:'abcde'});
      env.Session.get('testsess1').
        then(function (session) {
          env.session = session;

          return session.getPlatformSession('email');
        }).
        then(function (psession) {
          env.psession = psession;
          env.psession.send = function (job) {
            test.write('psession send called:',job);
          };
          var EmailMod = require('./../lib/platforms/email');
          //console.log('email:', env.Email);
          env.Email = EmailMod();
          env.Email.init(psession).then(function() {
            test.result(true);
          }, function(err) {
            test.result(false, err);
          });
        });
    },
    takedown: function (env, test) {
      env.Session.destroy(env.session.getSessionID()).then(function () {
        test.result(true);
      }, function (err) {
        test.result(false, err);
      });
    },
    beforeEach: function (env, test) {
      test.result(true);
    },
    tests: [
      {
        desc: "set credential details",
        run: function (env, test) {
          var job = {
            actor: { address: 'whitney@houston.com' },
            object: {
              objectType: 'credentials',
              smtp: {
                host: 'mailservice.example.com',
                username: 'whit',
                password: 'ney'
              }
            }
          };

          env.psession.setConfig('credentials', job.actor.address, job).then(function () {
            env.psession.getConfig('credentials', job.actor.address).then(function (creds) {
              test.assert(creds, job);
            }, function (err) {
              test.result(false, err);
            });
          }, function (err) {
            test.result(false, err);
          });
        }
      },
      {
        desc: "email.send() eventually calls nodemailer.sendMail()",
        run: function (env, test) {
          var job = {
            rid: '002',
            verb: 'send',
            platform: 'email',
            actor: { name: 'Whitney Houston', address: 'whitney@houston.com' },
            object: { subject: 'Love you', text: 'I will always.' },
            target: [{ field: "to", name: 'Stevie Wonder', address: 'stevie@wonder.com' }]
          };
          env.Email.send(job).then(function (err, status, obj) {
            env.respHandler()(err, status, obj);
            test.assert(env.nodemailer.createTransport.called, true);
            var transport = env.nodemailer.createTransport('SMTP', {});
            test.assert(transport.sendMail.called, true);
          });
        }
      },
      {
        desc: "email.send() with attachments",
        run: function (env, test) {
          var job = {
            rid: '002',
            verb: 'send',
            platform: 'email',
            actor: { name: 'Whitney Houston', address: 'whitney@houston.com' },
            target: [{ field: "to", name: 'Stevie Wonder', address: 'stevie@wonder.com' }],
            object: {
              subject: 'Love you',
              text: 'I will always.',
              attachments: [
                {
                  fileName: 'notes.txt',
                  contents: 'Some notes about this e-mail',
                  contentType: 'text/plain' // optional, would be detected from the filename
                }
              ]
            }
          };
          env.Email.send(job).then(function (err, status, obj) {
            env.respHandler()(err, status, obj);
            test.assertAnd(env.nodemailer.createTransport.called, true);
            var transport = env.nodemailer.createTransport('SMTP', {});
            test.assert(transport.sendMail.called, true, 'sendMail should have been called');
          });
        }
      }
    ]
  });

  return suites;
});
