require("consoleplusplus/console++");
function buildTest(platform, verb, data, err) {
  return {
    desc: platform+" - "+verb+" scaffolding check",
    run: function(env, test) {
      if (data === undefined) {
        test.result(false, 'unable to load platform module "'+platform+'"');
      }
      test.assertType(data[verb], 'function');
    }
  };
}

var platform_test_suite = {
  name: "platform tests",
  desc: "platform tests, verifying the verbs they define in protocol.js are exported in their platform module",
  setup: function (env, test) { test.result(true); },
  tests: []
};


if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  var protocols;
  try {
    protocols = require('../lib/protocols/sockethub/protocol');
  } catch (e) {
    test.result(false, e);
  }
  var platforms = protocols.platforms;

  for (var i in platforms) {
    if (platforms[i].name === 'dispatcher') { continue; }
    for (var j in platforms[i].verbs) {
      var platform = platforms[i].name;
      var verb = platforms[i].verbs[j].name;
      var data;
      try {
        data = require('../lib/protocols/sockethub/platforms/' + platform);
      } catch (e) {
        platform_test_suite.tests.push(buildTest(platform, verb, undefined, e));
      }

      platform_test_suite.tests.push(buildTest(platform, verb, data));

    }
  }
  //console.log(platform_test_suite);
  suites.push(platform_test_suite);

  return suites;
});

