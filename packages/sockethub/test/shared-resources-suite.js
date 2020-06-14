if (typeof define !== 'function') {
  let define = require('amdefine')(module);
}
define(['require', '../dist/shared-resources'], function (require, SharedResources) {
  const SR = SharedResources.default;
  return [
    {
      desc: 'src/shared-resources',
      abortOnFail: true,
      tests: [
        {
          desc: 'platformInstances',
          run: function (env, test) {
            test.assert(SR.platformInstances instanceof Map, true);
          }
        },

        {
          desc: 'sessionConnections',
          run: function (env, test) {
            test.assert(SR.sessionConnections instanceof Map, true);
          }
        },

        {
          desc: 'helpers.removePlatform',
          run: function (env, test) {
            const pObj = { id: 'test1', actor: { '@id': 'foobar' },
              process: {
                removeAllListeners: () => {},
                unref: () => {},
                kill: () => {},
              }};
            SR.platformInstances.set(pObj.id, pObj);
            test.assertAnd(SR.platformInstances.get(pObj.id), pObj);
            SR.helpers.removePlatform(pObj);
            test.assert(SR.platformInstances.get(pObj.id), undefined);
          }
        },
      ]
    }
  ];
});
