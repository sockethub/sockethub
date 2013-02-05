if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function(require) {
  var suites = [];

  suites.push({
    name: "smtp platform tests",
    desc: "collection of tests for the smtp platform",
    setup: function(env, test) {
      env.Mailer = {
        send: this.Stub(function(obj, cb) {
          cb(null, true);
        })
      };
      env.Session = {
        send: function(msg) {
          //console.log(msg);
        }
      };
      env.Smtp = require('../lib/protocols/sockethub/platforms/smtp-implementation');
      test.result(true);
    },
    tests: [
      {
        desc: "Smtp.message() calls mailer.send()",
        run: function(env, test) {
          env.Smtp.message({
            actor: { address: 'whitney@houston.com' },
            object: { subject: 'Love you', text: 'I will always.' },
            target: { to: [{ address: 'stevie@wonder.com' }] },
            credentials: { host: 'example.com', user: 'whit', password: 'ney' }
          }, env.Session);
          test.assert(env.Mailer.called, undefined);//FIXME: why is this undefined?
        }
      }
    ]
  });

  return suites;
});
