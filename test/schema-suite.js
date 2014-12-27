if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require', 'tv4', './../lib/schemas/sockethub-activity-streams'], function (require, tv4, ASSchema) {

  var as = {
    working: {
      one: {
        id: 'blah',
        verb: 'send',
        platform: 'hello',
        actor: {
          objectType: 'person',
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
    },
    failing: {
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
      abortOnFail: true,
      setup: function (env, test) {
        test.assertTypeAnd(ASSchema, 'function');
        var schema = ASSchema(['hello', 'goodbye'], ['send', 'fetch']);

        env.schemaId = 'http://sockethub.org/schemas/v0/activity-stream#';
        test.assertAnd(schema.id, env.schemaId);
        tv4.addSchema(schema.id, schema);
        test.done();
      },
      tests: [
        {
          desc: 'basic working schema',
          run: function (env, test) {
            var result = tv4.validate(as.working.one, env.schemaId);
            console.log(tv4.error);
            test.assert(result, true);
          }
        },

        {
          desc: 'basic failing schema',
          willFail: true,
          run: function (env, test) {
            test.assert(tv4.validate(as.failing.one, env.schemaId), true);
          }
        },

        {
          desc: 'use bad verb',
          willFail: true,
          run: function (env, test) {
            var obj = as.working.one;
            obj.verb = 'run';
            test.assert(tv4.validate(obj, env.schemaId), true);
          }
        }
      ]
    }
  ];
});
