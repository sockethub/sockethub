if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require', './../lib/validate'], function (require, Validate) {

  var errMsg = '';
  var suites = [];

  var groups = {
    'credentials': {
      pass: {
        one: {
          '@id': 'blah',
          '@type': 'send',
          context: 'dummy',
          actor: {
            '@id': 'irc://dood@irc.freenode.net',
            '@type': 'person',
            displayName: 'dood',
          },
          target: {
            '@id': 'irc://irc.freenode.net/sockethub',
            '@type': 'person',
            displayName: 'sockethub'
          },
          object: {
            '@type': 'credentials'
          }
        },
        newFormat: {
          context: "irc",
          actor: {
            '@id': "irc://sh-9K3Vk@irc.freenode.net",
            '@type': "person",
            displayName: "sh-9K3Vk",
            image: {
              height: 250,
              mediaType: "image/jpeg",
              url: "http://example.org/image.jpg",
              width: 250
            },
            url: "http://sockethub.org"
          },
          object: {
            '@type': "credentials",
            nick: "sh-9K3Vk",
            port: 6667,
            secure: false,
            server: "irc.freenode.net"
          }
        }
      }
    },
    'activity-object': {
      pass: {
        person: {
          '@id': 'blah',
          '@type': 'person',
          displayName: 'dood'
        },
        personWithExtras: {
          '@id': 'blah',
          '@type': 'person',
          displayName: 'bob',
          hello: 'there',
          i: [ 'am','extras' ]
        },
        aCredential: {
          '@type': "credentials",
          nick: "sh-9K3Vk",
          port: 6667,
          secure: false,
          server: "irc.freenode.net"
        },
        aNewPerson: {
          '@id': "irc://sh-9K3Vk@irc.freenode.net",
          '@type': "person",
          displayName: "sh-9K3Vk",
          image: {
            height: 250,
            mediaType: "image/jpeg",
            url: "http://example.org/image.jpg",
            width: 250
          },
          url: "http://sockethub.org"
        }
      },
      fail: {
        string: 'this is a string',
        array: ['this', 'is', { an: 'array'} ],
        as: {
          '@id': 'blah',
          '@type': 'send',
          context: 'hello',
          actor: {
            displayName: 'dood'
          },
          target: {
            '@type': 'person',
            displayName: 'bob'
          },
          object: {
            '@type': 'credentials'
          }
        },
        noId: {
          displayName: 'dood'
        },
        noId2: {
          '@type': 'person',
          displayName: 'bob'
        },
        noDisplayName: {
          '@id': 'larg',
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
        //console.log('validating ' + type + ' object. expecting: ' + expect + ' with obj: ', obj);
        env.validate(type)(obj, function (result, err) {
          if (typeof result !== 'boolean') {
            result = true;
          }
          //console.log('assert ' + result + ' === ' + expect + ' ... ' + err);
          test.assert(result, expect, err);
        });
      }
    };
    return test;
  }

  function buildSuite(type) {
    return {
      desc: 'validate middleware - ' + type,
      timeout: 1000,
      abortOnFail: true,
      setup: function (env, test) {
        test.assertTypeAnd(Validate, 'function');
        env.validate = Validate({
          onfail: function (_err, _type, _msg) {
            // erroMsg = _type + ' : ' + _err;
            // test.write(_type + ' : ' + _err, _msg);
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

    if (typeof groups[keys[i]].pass === 'object') {
      var pkeys = Object.keys(groups[keys[i]].pass);
      for (var p = 0, plen = pkeys.length; p < plen; p++) {
        tests.push(buildTest(true, keys[i], pkeys[p], groups[keys[i]].pass[pkeys[p]]));
      }
    }

    if (typeof groups[keys[i]].fail === 'object') {
      var fkeys = Object.keys(groups[keys[i]].fail);
      for (var f = 0, flen = fkeys.length; f < flen; f++) {
        tests.push(buildTest(false, keys[i], fkeys[f], groups[keys[i]].fail[fkeys[f]]));
      }
    }

    suite.tests = tests;
    suites.push(suite);
  }
  return suites;
});
