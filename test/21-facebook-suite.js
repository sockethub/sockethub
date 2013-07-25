require("consoleplusplus/console++");
if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "facebook platform tests",
    desc: "collection of tests for the facebook platform",
    setup: function (env, test) {
      env.https = {
        request: this.Stub(function(obj, cb) {
          console.log('HTTPS STUB CALLED');

          cb({
            status: true,
            setEncoding: function (encoding) {return true;},
            on: function (name, cb2) {
              if (name === 'end') {
                cb2();
              }
            }
          });
          return {
            end: function() {}
          };
        })
      };
      GLOBAL.https = env.https;

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
      env.Session = require('./../lib/sockethub/session')({platform:'facebook', sockethubId:'1234567890', encKey:'abcde'});
      env.Session.get('testsess1').
        then(function (session) {
          env.session = session;

          return session.getPlatformSession('facebook');
        }).
        then(function (psession) {
          env.psession = psession;
          env.psession.send = function (job) {
            test.write('psession send called:',job);
          };
          var FBMod = require('./../lib/platforms/facebook');
          //console.log('facebook:', FBMod);

          env.Facebook = FBMod();
          env.Facebook.init(psession).then(function() {
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
            target: 'facebook',
            object: {
              credentials: {
                fbuser: {
                  actor: {
                    address: "fbuser"
                  },
                  access_token: 'abcde'
                }
              }
            }
          };

          env.psession.setConfig('credentials', job.object.credentials).then(function () {
            env.psession.getConfig('credentials').then(function (creds) {
              console.log('CREDS:', creds);
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
        desc: "facebook.post() eventually calls https request",
        run: function (env, test) {
          var job = {
            rid: '002',
            verb: 'post',
            platform: 'facebook',
            actor: { address: 'fbuser' },
            object: { text: 'blah blah' },
            target: [{ address: 'fbuser2' }]
          };
          env.Facebook.post(job).then(function (obj) {
            env.respHandler()(null, true, obj);
            test.assert(env.https.request.called, true);
            //var transport = env.nodemailer.createTransport('SMTP', {});
            //test.assert(transport.sendMail.called, true);
          }, function (err, obj) {
            env.respHandler()(err, false, obj);
          });
        }
      }
    ]
  });

  return suites;
});
