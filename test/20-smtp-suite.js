if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function(require) {
  var suites = [];

  suites.push({
    name: "smtp platform tests",
    desc: "collection of tests for the smtp platform",
    setup: function(env, test) {
      env.Mailer = this.Stub({
        send: function(obj, cb) {
          console.log(obj);
          cb(null, true);
        }
      });
      env.Smtp = require('../lib/protocols/sockethub/platform/smtp-implementation').smtp(env.Mailer);
      test.result(true);
    },
    tests: [
      {
        desc: "Smtp.message() calls mailer.send()",
        run: function(env, test) {
          env.Smtp.message({
            actor: { address: 'whitney@houston.com' },
            object: { subject: 'Love you', text: 'I will always.' },
            target: { address: 'stevie@wonder.com' }
          });
          test.assert(env.Mailer.called, true);
        }
        }
      }
    ]
  });

  return suites;
});

