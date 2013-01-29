if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function(require) {
  var suites = [];

  suites.push({
    name: "post verb tests",
    desc: "Test the post verb which is currently supported by the twitter and facebook platforms",
    setup: function(env, test) {
      env.Session = require('../lib/protocols/sockethub/session');
      test.result(true);
    },
    tests: [
      {
        desc: "2+2 != 5",
        run: function(env, test) {
          test.assertFail(2+2, 5);
        }
      }
    ]
  });

  return suites;
});

