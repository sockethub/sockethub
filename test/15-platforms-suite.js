/**
 * This file is part of sockethub.
 *
 * © 2012-2013 Nick Jennings
 *             nick@silverbucket.net
 *             https://github.com/silverbucket
 *
 * sockethub is licensed under the AGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of sockethub can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

/**
 * This test suite builds dynamic tests for the platforms. It tests things like
 * whether the all of the verbs declared (along with the init and cleanup
 * commands) have a function exported from the platform module, and if that
 * function returns a promise. This test is generated in the `buildTest`
 * function.
 *
 * It also can automatically validate good & bad data against the platforms
 * schema export. This test is generated in the `buildSchematest` function.
 */

require("consoleplusplus/console++");
var promising = require('promising');
var JSVlib = require('JSV').JSV; // json schema validator

var schema_tests = [
  'platforms_schema_data/twitter_credentials.js'
];

var session = {
  log: function (msg) {
    console.log('SESSION LOG '+msg);
  },
  getSessionID: function () {
    return ['1234567890'];
  },
  promising: promising
};


function buildTest(name, p, verb, err) {
  return {
    desc: name+" - "+verb+" scaffolding check",
    run: function(env, test) {
      if (p === undefined) {
        test.result(false, 'unable to load platform module "'+name+'" : '+err);
      } else {
        test.assertTypeAnd(p[verb], 'function', 'function '+name+'.'+verb+'() does not exist ['+err+']');
        var promise;
        if (verb === 'init') {
          promise = p[verb](session);
        } else if (verb === 'cleanup') {
          promise = p[verb]();
        } else {
          test.assertType(p[verb], 'function');
        }
        test.assertTypeAnd(promise, 'object', 'function '+name+'.'+verb+'() does not return a promise (not an object)');
        test.assertTypeAnd(promise.then, 'function', 'function '+name+'.'+verb+'() does not return a promise (no .then() function)');
        promise.then(function () {
          test.result(true, 'promise fulfilled');
        }, function () {
          test.result(false, 'promise rejected');
        });
      }
    }
  };
}


function buildSchemaTest(name, p, filename, prop, num, data, err) {
  return {
    desc: name+" - "+filename+" schema check #"+num,
    run: function(env, test) {
      if (data === undefined) {
        test.result(false, 'unable to load platform module "'+name+'" : '+err);
      } else {
        test.assertTypeAnd(data, 'object', 'test data #'+num+' not an object '+name+' ['+err+']');
        test.assertTypeAnd(p.schema[prop], 'object', 'platform does not have defined schema property '+prop+' ['+err+']');

        var jsv = JSVlib.createEnvironment();
        var report = jsv.validate(data, p.schema[prop]);
        if (report.errors.length !== 0) {  // protocol.js json errors
          test.result(false, 'invalid object format '+JSON.stringify(report.errors));
        } else {
          test.result(true);
        }
      }
    }
  };
}

var platform_test_suite = {
  name: "platform tests",
  desc: "platform tests, verifying the verbs they define in protocol.js are exported in their platform module",
  setup: function (env, test) {
    test.result(true);
  },
  tests: []
};


if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  var platforms = require('./../lib/sockethub/protocol').platforms;

  for (var i in platforms) {
    var platform = platforms[i].name;
    var location = (platforms[i].location) ? ''+platforms[i].location :
                                             './../lib/platforms/'+platform;

    location = location.replace(/\.js$/, "");
    if (platform === 'dispatcher') { continue; }

    // manually check for init and cleanup
    var pd;
    var loadFailed = false;
    try {
      pd = require(location);
    } catch (e) {
      loadFailed = true;
      platform_test_suite.tests.push(buildTest(platform, undefined, 'init', e));
      platform_test_suite.tests.push(buildTest(platform, undefined, 'cleanup', e));
    }

    if (!loadFailed) {
      pdi = pd();
      platform_test_suite.tests.push(buildTest(platform, pdi, 'init'));
      platform_test_suite.tests.push(buildTest(platform, pdi, 'cleanup'));
    }

    for (var j in platforms[i].verbs) {
      var verb = platforms[i].verbs[j].name;
      if (loadFailed) {
        platform_test_suite.tests.push(buildTest(platform, undefined, verb, 'failed to load platform module'));
      } else {
        platform_test_suite.tests.push(buildTest(platform, pdi, verb));
      }
    }

    for (var k = 0, len = schema_tests.length; k < len; k++) {
      loadFailed = false;
      var t;
      try {
        t = require(schema_tests[k]);
      } catch (e) {
        loadFailed = true;
        platform_test_suite.tests.push(buildSchemaTest(platform, undefined,
                                                      schema_tests[k],
                                                      undefined, undefined,
                                                      undefined, e));
      }

      // .. TODO .. tests need to be assigned to a specific platform, currently
      // they are applied as we loop through the platforms. each time.
      //
      //
      if (!loadFailed) {
        if (!t) {
          loadFailed = true;
          platform_test_suite.tests.push(buildSchemaTest(platform, undefined,
                                                        schema_tests[k],
                                                        undefined, undefined,
                                                        undefined, 'test data module returned empty object'));
        } else {
          // iterate through data tests
          console.log(schema_tests[k]+' t: ',t);
          for (var l = 0, len2 = t.tests.length; l < len2; l++) {
            platform_test_suite.tests.push(buildSchemaTest(platform, pi,
                                                         schema_tests[k],
                                                         t.base_prop, l,
                                                         t.tests[l]));
          }
        }
      }
    }

  }
  //console.log(platform_test_suite);
  suites.push(platform_test_suite);

  return suites;
});

