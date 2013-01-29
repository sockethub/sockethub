if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function(require) {
  var suites = [];

  suites.push({
    name: "post verb tests",
    desc: "Test the post verb which is currently supported by the twitter and facebook platforms",
    setup: function(env, test) {
      env.Twitter = require('../lib/protocols/sockethub/platforms/twitter');
      env.Facebook = require('../lib/protocols/sockethub/platforms/facebook');
      test.result(true);
    },
    tests: [
      {
        desc: "Twitter has a post verb",
        run: function(env, test) {
          test.assertType(env.Twitter.post, 'function');
        }
      },
      {
        desc: "Facebook has a post verb",
        run: function(env, test) {
          test.assertType(env.Facebook.post, 'function');
        }
      },
    ]
  });

  return suites;
});

