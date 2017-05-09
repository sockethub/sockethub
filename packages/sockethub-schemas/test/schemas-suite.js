if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require', 'tv4', './../schemas/activity-stream'], function (require, tv4, schemaSHAS) {

  var testGroups = [
    {
      name: 'one',
      result: true,
      type: 'activity-stream',
      input: {
        '@type': 'send',
        context: 'irc',
        actor: {
          '@id': 'irc://dood@irc.freenode.net',
          '@type': 'person',
          displayName: 'dood'
        },
        target: {
          '@id': 'irc://irc.freenode.net/sockethub',
          '@type': 'room',
          displayName: 'sockethub'
        },
        object: {
          '@type': 'credentials'
        }
      }
    },
    {
      name: 'bad uri',
      result: false,
      type: 'activity-stream',
      input: {
        '@id': 'blah',
        '@type': 'send',
        context: 'dood',
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
      }
    },
    {
      name: 'wrong actor type',
      result: false,
      type: 'activity-stream',
      input: {
        '@id': 'blah',
        '@type': 'send',
        context: 'dood',
        actor: {
          id: 'irc://doobar@freenode.net/channel',
          '@type': 'message',
          content: 'hi there'
        },
        target: {
          '@id': 'xmpp:bob@crusty.net/Home',
          '@type': 'person',
          displayName: 'bob'
        },
        object: {
          '@type': 'feed',
          '@id': 'http://rss.example.org/feed.rss'
        }
      }
    },

  ];

  var suite = {
      desc: 'schema - activity stream',
      abortOnFail: true,
      setup: function (env, test) {
        test.assertTypeAnd(schemaSHAS, 'object');
        //var schema = schemaSHAS(['hello', 'goodbye'], ['send', 'fetch']);
        env.schemaId = 'http://sockethub.org/schemas/v0/'; // appended with type + #

        test.assertAnd(schemaSHAS.id, env.schemaId + 'activity-stream#');
        tv4.addSchema(schemaSHAS.id, schemaSHAS);
        test.done();
      },
      tests: []
  };

  testGroups.forEach(function (entry, i) {
    suite.tests.push({
      desc: entry.name,
      run: function (env, test) {
        var result = tv4.validate(entry.input, env.schemaId + entry.type + '#');
        var msg = (tv4.error) ? tv4.error.dataPath + ': ' +  tv4.error.message : '';
        test.assert(result, entry.result, msg);
      }
    })
  });

  return [ suite ];
});
