function getTests() {
  return [
    {
      desc: 'ensure amd module is loaded correctly',
      run: function (env, test) {
        if (typeof amdMod !== 'undefined') {
          test.assertTypeAnd(amdMod, 'object');
          test.assertTypeAnd(amdMod.Object, 'object');
          test.assertType(amdMod.Stream, 'object');
        } else {
          test.done(); // don't test amd
        }
      }
    },

    {
      desc: '# get  - with no params returns undefined',
      run: function (env, test) {
        test.assert(env.mod.Object.get('thingy'), undefined);
      }
    },

    {
      desc: '# create 1',
      run: function (env, test) {
        test.assert(env.mod.Object.create({id:'thingy1'}), true);
      }
    },

    {
      desc: '# get',
      run: function (env, test) {
        test.assert(env.mod.Object.get('thingy1'), {id:'thingy1'});
      }
    },

    {
      desc: '# create with no identifier',
      run: function (env, test) {
        test.throws(env.mod.Object.create, Error, 'caught thrown exception');
      }
    },

    {
      desc: '# create 2',
      run: function (env, test) {
        test.assert(env.mod.Object.create({id:'thingy2'}), true);
      }
    },

    {
      desc: '# create 3 w/events',
      run: function (env, test) {
        env.mod.on('activity-object-create', function onObjCreate(obj) {
          test.assert(obj.id, 'thingy3');
        });
        setTimeout(function () {
          test.assertAnd(env.mod.Object.create({id:'thingy3'}), true);
        }, 0);
      }
    },

    {
      desc: '# delete 2 w/events',
      run: function (env, test) {
        env.mod.on('activity-object-delete', function onObjDelete(id) {
          test.assert(id, 'thingy2');
        });
        setTimeout(function () {
          test.assertAnd(env.mod.Object.delete('thingy2'), true);
        }, 0);
      }
    },

  ];
}


if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
//define(['require', 'array-keys', './../browser/activity-streams.min.js'], function (require, ArrayKeys, amdMod) {
define(['require', 'array-keys'], function (require, ArrayKeys) {
  return [{
    desc: "basic tests",
    setup: function (env, test) {
      env.mod = require('./../lib/activity-streams');
      test.assertTypeAnd(env.mod, 'object');
      test.assertTypeAnd(env.mod.Object, 'object');
      test.assertType(env.mod.Stream, 'object');
    },
    tests: getTests(),
  },
  {
    desc: "basic tests (browserify)",
    setup: function (env, test) {
      env.mod = require('./../browser/activity-streams.js');
      console.log('mod: ', env.mod);
      test.assertTypeAnd(env.mod, 'object');
      test.assertTypeAnd(env.mod.Object, 'object');
      test.assertType(env.mod.Stream, 'object');
    },
    tests: getTests(),
  },
  {
    desc: "basic tests (browserify minified)",
    setup: function (env, test) {
      env.mod = require('./../browser/activity-streams.min.js');
      test.assertTypeAnd(env.mod, 'object');
      test.assertTypeAnd(env.mod.Object, 'object');
      test.assertType(env.mod.Stream, 'object');
    },
    tests: getTests(),
  }];
});
