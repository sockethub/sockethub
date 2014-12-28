if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require', './../lib/validate'], function (require, Validate) {

  var suites = [];

  var groups = {
    'activity-object': {
      pass: {
        person: {
          id: 'blah',
          objectType: 'person',
          displayName: 'dood'
        },
        personWithExtras: {
          id: 'blah',
          objectType: 'person',
          displayName: 'bob',
          hello: 'there',
          i: [ 'am','extras' ]
        }
      },
      fail: {
        string: 'this is a string',
        array: ['this', 'is', { an: 'array'} ],
        as: {
          id: 'blah',
          verb: 'send',
          platform: 'hello',
          actor: {
            displayName: 'dood'
          },
          target: {
            objectType: 'person',
            displayName: 'bob'
          },
          object: {
            objectType: 'credentials'
          }
        },
        noId: {
          displayName: 'dood'
        },
        noId2: {
          objectType: 'person',
          displayName: 'bob'
        },
        noDisplayName: {
          id: 'larg',
        }
      }
    }
  };

  function buildTest(expect, type, name, obj) {
    var string = 'fail';
    if (expect) {
      string = 'pass';
    }

    var test = {
      desc: '# ' + string + ' ' + name,
      run: function (env, test) {
        env.validate(type)(obj, function (result) {
          if (typeof result !== 'boolean') {
            result = true;
          }
          test.assert(result, expect);
        });
      }
    };
    return test;
  }

  function buildSuite(type) {
    return {
      desc: 'validate middleware - ' + type,
      timeout: 1000,
      setup: function (env, test) {

        test.assertTypeAnd(Validate, 'function');
        env.validate = Validate({
          onfail: function (_err, _type, _msg) {
            test.write(_type + ' : ' + _err);
          }
        });
        test.assertType(env.validate, 'function');
      }
    };
  }

  var keys = Object.keys(groups);
  for (var i = 0, len = keys.length; i < len; i++) {

    var suite = buildSuite(keys[i]);

    var tests = [];

    var pkeys = Object.keys(groups[keys[i]].pass);
    for (var p = 0, plen = pkeys.length; p < plen; p++) {
      tests.push(buildTest(true, keys[i], pkeys[p], groups[keys[i]].pass[pkeys[p]]));
    }

    var fkeys = Object.keys(groups[keys[i]].fail);
    for (var f = 0, flen = fkeys.length; f < flen; f++) {
      tests.push(buildTest(false, keys[i], fkeys[f], groups[keys[i]].fail[fkeys[f]]));
    }

    suite.tests = tests;
    suites.push(suite);
  }

  return suites;
});
