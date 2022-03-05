if (typeof define !== 'function') {
  let define = require('amdefine')(module);
}
define(['require'], function (require) {
  return [
    {
      desc: 'dist/bootstrap/init',
      abortOnFail: true,
      setup: function (env, test) {
        env.init = require('../dist/bootstrap/init').default;
        test.assertType(env.init, 'object');
      },
      tests: [
        {
          desc: 'platforms',
          run: function (env, test) {
            test.assertTypeAnd(env.init.platforms, 'object');
            test.assert(env.init.platforms.has('irc'), true);
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
