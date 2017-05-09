if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require', 'tv4', './../schemas/activity-stream'], function (require, tv4, schemaSHAS) {

  var as = {
    pass: {
      one: {
        '@id': 'blah',
        '@type': 'send',
        context: 'dummy',
        actor: {
          '@id': 'irc://dood@irc.freenode.net',
          '@type': 'person',
          displayName: 'dood'
        },
        target: {
          '@id': 'irc://irc.freenode.net/sockethub',
          '@type': 'person',
          displayName: 'sockethub'
        },
        object: {
          '@type': 'credentials'
        }
      }
    },
    fail: {
      one: {
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
    }
  };

  return [
    {
      desc: 'schema - activity stream',
      abortOnFail: true,
      setup: function (env, test) {
        test.assertTypeAnd(schemaSHAS, 'object');
        //var schema = schemaSHAS(['hello', 'goodbye'], ['send', 'fetch']);
        env.schemaId = 'http://sockethub.org/schemas/v0/activity-stream#';

        test.assertAnd(schemaSHAS.id, env.schemaId);
        tv4.addSchema(schemaSHAS.id, schemaSHAS);
        test.done();
      },
      tests: [
        {
          desc: 'basic passing schema',
          run: function (env, test) {
            var result = tv4.validate(as.pass.one, env.schemaId);
            var msg = (tv4.error) ? tv4.error.dataPath + ': ' +  tv4.error.message : '';
            test.assert(result, true, msg);
          }
        },

        {
          desc: 'basic failing schema',
          run: function (env, test) {
            test.assert(tv4.validate(as.fail.one, env.schemaId), false, tv4.error.message);
          }
        }
      ]
    }
  ];
});
