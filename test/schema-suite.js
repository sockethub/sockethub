if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require', 'tv4', './../lib/schemas/sockethub-activity-streams'], function (require, tv4, schemaSHAS) {

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
     }
    }
  };

  return [
    {
      desc: 'validate activity streams schema',
      setup: function (env, test) {
        test.assertTypeAnd(schemaSHAS, 'function');
        var schema = schemaSHAS(['hello', 'goodbye'], ['send', 'fetch']);

        env.schemaId = 'http://sockethub.org/schemas/v0/activity-stream#';
        test.assertAnd(schema.id, env.schemaId);
        tv4.addSchema(schema.id, schema);
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
        },

        {
          desc: 'use bad verb',
          run: function (env, test) {
            var obj = as.pass.one;
            obj.verb = 'run';
            test.assert(tv4.validate(obj, env.schemaId), false);
          }
        }
      ]
    }
  ];
});
