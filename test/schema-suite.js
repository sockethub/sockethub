if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require', 'tv4', './../lib/schemas/sockethub-activity-stream'], function (require, tv4, schemaSHAS) {

  var as = {
    pass: {
      one: {
        id: 'blah',
        verb: 'send',
        platform: 'hello',
        actor: {
          id: 'irc://dood@irc.freenode.net',
          objectType: 'person',
          displayName: 'dood'
        },
        target: {
          id: 'irc://irc.freenode.net/sockethub',
          objectType: 'person',
          displayName: 'sockethub'
        },
        object: {
          objectType: 'credentials'
        }
      }
    },
    fail: {
      one: {
        id: 'blah',
        verb: 'send',
        platform: 'dood',
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
     }
    }
  };

  return [
    {
      desc: 'schema - activity stream',
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
            console.log(tv4.error);
            test.assert(result, true);
          }
        },

        {
          desc: 'basic failing schema',
          run: function (env, test) {
            test.assert(tv4.validate(as.fail.one, env.schemaId), false);
          }
        }
      ]
    }
  ];
});
