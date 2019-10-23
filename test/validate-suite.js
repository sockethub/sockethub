if (typeof define !== 'function') {
  let define = require('amdefine')(module);
}
define(['require', '../dist/validate', 'activity-streams'], function (require, library, AS) {
  const validate = library.default;
  let activity = new AS();
  let errMsg = '';
  let suites = [];

  let testGroups = [
    {
      name: 'one',
      result: true,
      type: 'credentials',
      input: {
        '@id': 'blah',
        '@type': 'send',
        context: 'dummy',
        actor: {
          '@id': 'dood@irc.freenode.net',
          '@type': 'person',
          displayName: 'dood',
        },
        target: {
          '@id': 'irc.freenode.net/sockethub',
          '@type': 'person',
          displayName: 'sockethub'
        },
        object: {
          '@type': 'credentials'
        }
      },
      output: 'same'
    },
    {
      name: 'new format',
      result: true,
      type: 'credentials',
      input: {
        context: 'irc',
        actor: {
          '@id': 'sh-9K3Vk@irc.freenode.net',
          '@type': 'person',
          displayName: 'sh-9K3Vk',
          image: {
            height: 250,
            mediaType: 'image/jpeg',
            url: 'http://example.org/image.jpg',
            width: 250
          },
          url: 'http://sockethub.org'
        },
        object: {
          '@type': 'credentials',
          nick: 'sh-9K3Vk',
          port: 6667,
          secure: false,
          server: 'irc.freenode.net'
        }
      },
      output: 'same'
    },
    {
      name: 'no type',
      result: false,
      type: 'credentials',
      input: {
        'actor': 'hyper_rau@localhost',
        'context': 'xmpp',
        'object': {
          'username': 'hyper_rau',
          'password': '123',
          'server': 'localhost',
          'port': 5222,
          'resource': 'laptop'
        }
      }
    },
    {
      name: 'person',
      type: 'activity-object',
      result: true,
      input: {
        '@id': 'blah',
        '@type': 'person',
        displayName: 'dood'
      },
      output: 'same'
    },
    {
      name: 'person with extras',
      result: true,
      type: 'activity-object',
      input: {
        '@id': 'blah',
        '@type': 'person',
        displayName: 'bob',
        hello: 'there',
        i: [ 'am', 'extras' ]
      },
      output: 'same'
    },
    {
      name: 'alone credentials (as activity-object)',
      result: false,
      type: 'activity-object',
      input:  {
        '@type': 'credentials',
        nick: 'sh-9K3Vk',
        port: 6667,
        secure: false,
        server: 'irc.freenode.net'
      }
    },
    {
      name: 'alone credentials (as credentials)',
      result: false,
      type: 'credentials',
      input:  {
        '@type': 'credentials',
        nick: 'sh-9K3Vk',
        port: 6667,
        secure: false,
        server: 'irc.freenode.net'
      }
    },
    {
      name: 'new person',
      result: true,
      type: 'activity-object',
      input: {
        '@id': 'sh-9K3Vk@irc.freenode.net',
        '@type': 'person',
        displayName: 'sh-9K3Vk',
        image: {
          height: 250,
          mediaType: 'image/jpeg',
          url: 'http://example.org/image.jpg',
          width: 250
        },
        url: 'http://sockethub.org'
      },
      output: 'same'
    },
    {
      name: 'new person',
      result: true,
      type: 'activity-object',
      input: {
        '@id': 'irc://sh-9K3Vk@irc.freenode.net',
        '@type': 'person',
        displayName: 'sh-9K3Vk',
        url: 'http://sockethub.org'
      },
      output: 'same'
    },
    {
      name: 'bad parent object',
      result: false,
      type: 'activity-object',
      input: {
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
    },
    {
      name: 'expand actor and target of unknowns',
      result: true,
      type: 'message',
      input: {
        'actor': 'irc://uuu@localhost',
        '@type': 'join',
        'context': 'irc',
        'target': 'irc://irc.dooder.net/a-room'
      },
      output: {
        'actor': {
          '@id': 'irc://uuu@localhost',
          'displayName': 'uuu'
        },
        '@type': 'join',
        'context': 'irc',
        'target': {
          '@id': 'irc://irc.dooder.net/a-room',
          'displayName': '/a-room'
        }
      }
    },
    {
      name: 'expand actor and target of unknowns',
      result: true,
      type: 'message',
      input: {
        'actor': 'hyper_rau@localhost',
        '@type': 'join',
        'context': 'xmpp',
        'object': {},
        target: 'dooder'
      },
      output: {
        'actor': {
          '@id': 'hyper_rau@localhost',
          displayName: 'hyper_rau@localhost'
        },
        '@type': 'join',
        'context': 'xmpp',
        'object': {},
        target: {
          '@id': 'dooder',
          displayName: 'dooder'
        }
      }
    },
    {
      name: 'expand known person',
      result: true,
      type: 'message',
      input: {
        actor: 'sh-9K3Vk@irc.freenode.net',
        target: 'blah',
        '@type': 'send',
        context: 'irc',
        object: {}
      },
      output: {
        actor: {
          '@id': 'sh-9K3Vk@irc.freenode.net',
          '@type': 'person',
          displayName: 'sh-9K3Vk',
          image: {
            height: 250,
            mediaType: 'image/jpeg',
            url: 'http://example.org/image.jpg',
            width: 250
          },
          url: 'http://sockethub.org'
        },
        target: {
          '@id': 'blah',
          '@type': 'person',
          displayName: 'bob',
          hello: 'there',
          i: [ 'am', 'extras' ]
        },
        '@type': 'send',
        context: 'irc',
        object: {}
      }
    }
  ];

  function buildTest(name, result, type, input, output) {
    let string = 'fail';
    if (result) {
      string = 'pass';
    }

    let test = {
      desc: '# [' + string + '] ' + name,
      run: function (env, test) {
        env.validate(type)((state, msg) => {
          //console.log('input: ', input);
          //console.log('msg: ', msg);
          //console.log('expected output: ', output);
          //console.log('result: ', state);

          if (output === 'same') {
            test.assertAnd(
              input, msg,
              `input not the same as output: ${JSON.stringify(input)} ... ${JSON.stringify(msg)}`);
          } else if (output) {
            test.assertAnd(
              msg, output,
              `expected and returned output don't match: ` +
              `${JSON.stringify(msg)} ... ${JSON.stringify(output)}`);
          }

          test.assertAnd(
            result, state,
            `results don't match: ${JSON.stringify(result)} ... ${JSON.stringify(state)}`);

          if ((result) && (type === 'activity-object')) {
            // console.log('activity: ', activity);
            activity.Object.create(msg);
          }
          test.done();
        }, input);
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
        test.assertTypeAnd(validate, 'function');
        env.validate = validate;
        test.assertType(env.validate, 'function');
      }
    };
  }

  let suite = buildSuite('input validation tests');
  let tests = [];
  testGroups.forEach(function (entry, i) {
    tests.push(buildTest(entry.name, entry.result, entry.type, entry.input, entry.output));
  });
  suite.tests = tests;
  return [ suite ];
});