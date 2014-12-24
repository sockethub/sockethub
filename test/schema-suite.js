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
        test.assertAnd(schema.id, 'http://sockethub.org/activity-stream-schema#');
        tv4.addSchema('http://sockethub.org/activity-stream-schema#', schema);
        test.done();
      },
      tests: [
        {
          desc: 'basic working schema',
          run: function (env, test) {
            var result = tv4.validate(as.working.one, 'http://sockethub.org/activity-stream-schema#');
            console.log(tv4.error);
            test.assert(result, true);
          }
        },

        {
          desc: 'basic failing schema',
          willFail: true,
          run: function (env, test) {
            test.assert(tv4.validate(as.failing.one, 'http://sockethub.org/activity-stream-schema#'), true);
          }
        },

        {
          desc: 'use bad verb',
          willFail: true,
          run: function (env, test) {
            var obj = as.working.one;
            obj.verb = 'run';
            test.assert(tv4.validate(obj, 'http://sockethub.org/activity-stream-schema#'), true);
          }
        }
      ]
    }
  ];
});
