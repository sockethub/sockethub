require("consoleplusplus/console++");
if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "twitter platform tests",
    desc: "collection of tests for the twitter platform",
    setup: function (env, test) {

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
      env.Session = require('./../lib/sockethub/session')({
              platform:'twitter',
              sockethubId:'1234567890',
              encKey:'abcde'
      });
      env.Session.get('testsess1').
        then(function (session) {
          env.session = session;

          return session.getPlatformSession('twitter');
        }).
        then(function (psession) {
          env.psession = psession;
          env.psession.send = function (job) {
            test.write('psession send called:',job);
          };
          var TwitterMod = require('./../lib/platforms/twitter');

          env.Twitter = TwitterMod();
          env.Twitter.init(psession).then(function() {
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
        desc: "set insufficient credential details",
        run: function (env, test) {
          var job = {
            target: 'twitter',
            object: {
              credentials: {
                foobar: {
                  actor: {
                    address: "foobar"
                  },
                  access_token: 'abcde',
                  consumer_secret: "hello"
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
        desc: "we should get an error message",
        run: function (env, test) {
          var job = {
            rid: '002',
            verb: 'post',
            platform: 'twitter',
            actor: { address: 'foobar' },
            object: { text: 'blah blah' },
            target: []
          };
          env.Twitter.post(job).then(function (err, status, obj) {
            test.result(false);
            //env.respHandler()(err, status, obj);
            //test.assertAnd(status, false);
            //test.assert(env.https.request.called, true);
            //var transport = env.nodemailer.createTransport('SMTP', {});
            //test.assert(transport.sendMail.called, true);
          }, function (err) {
            test.assert(err, 'twitter credentials incomplete');
          });
        }
      },
      {
        desc: "set correct credential details",
        run: function (env, test) {
          var job = {
            target: 'twitter',
            object: {
              credentials: {
                foobar: {
                  actor: {
                    address: "foobar"
                  },
                  access_token: 'abcde',
                  access_token_secret: 'abcde',
                  consumer_key: 'abcde',
                  consumer_secret: "hello"
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
        desc: "we should get an error message from Twit",
        run: function (env, test) {
          var job = {
            rid: '002',
            verb: 'post',
            platform: 'twitter',
            actor: { address: 'foobar' },
            object: { text: 'blah blah' },
            target: []
          };
          env.Twitter.post(job).then(function (err, status, obj) {
            test.result(false);
            //env.respHandler()(err, status, obj);
            //test.assertAnd(status, false);
            //test.assert(env.https.request.called, true);
            //var transport = env.nodemailer.createTransport('SMTP', {});
            //test.assert(transport.sendMail.called, true);
          }, function (err) {
            console.log("ERR: "+err.toString());
            test.assert(err, '{"errors":[{"message":"Invalid or expired token","code":89}]}');
          });
        }
      }
    ]
  });

  return suites;
});
