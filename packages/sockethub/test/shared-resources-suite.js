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
          desc: 'socketConnections',
          run: function (env, test) {
            test.assert(SR.socketConnections instanceof Map, true);
          }
        },

        {
          desc: 'platformMappings',
          run: function (env, test) {
            test.assert(SR.platformMappings instanceof Map, true);
          }
        },

        {
          desc: 'helpers.removePlatform',
          run: function (env, test) {
            const pObj = {id: 'test1', actor: {'@id': 'foobar'}};
            SR.platformInstances.set(pObj.id, pObj);
            SR.platformMappings.set('foobar', pObj.id);
            test.assertAnd(SR.platformMappings.get('foobar'), pObj.id);
            test.assertAnd(SR.platformInstances.get(pObj.id), pObj);
            SR.helpers.removePlatform(pObj);
            test.assertAnd(SR.platformMappings.get('foobar'), undefined);
            test.assert(SR.platformInstances.get(pObj.id), undefined);
          }
        },
      ]
    }
  ];
});
