require("consoleplusplus/console++");
var session = {
  log: function (msg) {
    console.log('SESSION LOG '+msg);
  },
  getSessionID: function () {
    return ['1234567890'];
  }
};

function buildTest(platform, verb, data, err) {
  return {
    desc: platform+" - "+verb+" scaffolding check",
    run: function(env, test) {
      if (data === undefined) {
        test.result(false, 'unable to load platform module "'+platform+'"');
      } else {
        test.assertTypeAnd(data[verb], 'function', 'function '+platform+'.'+verb+'() does not exist ['+err+']');
        var promise;
        if (verb === 'init') {
          promise = data[verb](session);
        } else if (verb === 'cleanup') {
          promise = data[verb]();
        } else {
          test.assertType(data[verb], 'function');
        }
        test.assertTypeAnd(promise, 'object', 'function '+platform+'.'+verb+'() does not return a promise (not an object)');
        test.assertType(promise.then, 'function', 'function '+platform+'.'+verb+'() does not return a promise (no .then() function)');
      }
    }
  };
}

var platform_test_suite = {
  name: "platform tests",
  desc: "platform tests, verifying the verbs they define in protocol.js are exported in their platform module",
  setup: function (env, test) {
    test.result(true); },
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
    var platform = platforms[i].name;
    if (platform === 'dispatcher') { continue; }

    // manually check for init and cleanup
    var pd;
    var loadFailed = false;
    try {
      pd = require('../lib/protocols/sockethub/platforms/' + platform);
    } catch (e) {
      loadFailed = true;
      platform_test_suite.tests.push(buildTest(platform, 'init', undefined, e));
      platform_test_suite.tests.push(buildTest(platform, 'cleanup', undefined, e));
    }

    pdi = pd();
    platform_test_suite.tests.push(buildTest(platform, 'init', pdi));
    platform_test_suite.tests.push(buildTest(platform, 'cleanup', pdi));


    for (var j in platforms[i].verbs) {
      var verb = platforms[i].verbs[j].name;
      if (loadFailed) {
        platform_test_suite.tests.push(buildTest(platform, verb, undefined));
      } else {
        platform_test_suite.tests.push(buildTest(platform, verb, pdi));
      }
    }

  }
  //console.log(platform_test_suite);
  suites.push(platform_test_suite);

  return suites;
});

