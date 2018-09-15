if (typeof define !== 'function') {
  let define = require('amdefine')(module);
}
define(['require'], function (require) {
  return [
    {
      desc: 'test init process',
      abortOnFail: true,
      setup: function (env, test) {
        env.init = require('./../lib/bootstrap/init');
        test.assertType(env.init, 'object');
      },
      tests: [
        {
          desc: 'host, port, path',
          run: function (env, test) {
            test.assertAnd(env.init.host, 'localhost');
            test.assertAnd(env.init.port, 10550);
            test.assert(env.init.path, '/sockethub');
          }
        },

        {
          desc: 'platforms',
          run: function (env, test) {
            test.assertTypeAnd(env.init.platforms, 'object');
            test.assertTypeAnd(env.init.platforms.exists, 'function');
            test.assert(env.init.platforms.exists('irc'), true);
          }
        }
      ]
    },
    {
      desc: 'nconf should have defaults set',
      setup: function (env, test) {
        env.nconf = require('nconf');
        test.assertType(env.nconf.get, 'function');
      },
      tests: [
        {
          desc: 'whitelist and blacklist',
          run: function (env, test) {
            console.log('whitelist: ', typeof require('nconf').get('platforms:whitelist'));
            test.assertTypeAnd(require('nconf').get('platforms:whitelist'), 'array');
            test.assertType(require('nconf').get('platforms:blacklist'), 'array');
          }
        }
      ]
    }
  ];
});
