if (typeof define !== 'function') {
  let define = require('amdefine')(module);
}
define(['require', '../dist/middleware'], function (require, Middleware) {
  return [
    {
      desc: 'src/middleware',
      abortOnFail: true,
      beforeEach: function (env, test) {
        env.middleware = new Middleware.default((...params) => {
          this.fail(params);
        });
        test.done();
      },
      tests: [
        {
          desc: 'basic 1 input param',
          run: function (env, test) {
            test.assertType(env.middleware.chain, 'function');
            const m = env.middleware.chain((next, input) => {
              next(true, input);
            }, (input) => {
              test.assert(input, 'alacadabra');
            });
            m('alacadabra');
          }
        },

        {
          desc: 'basic 1 input param with error',
          run: function (env, test) {
            const middleware = new Middleware.default((err, input) => {
              test.assertAnd(err, 'incorrect input');
              test.assert(input, 'foobar');
            });
            const m = middleware.chain((next, input) => {
              next(false, 'incorrect input', input);
            }, (input) => {
              test.fail('should not reach final function in chain');
            });
            m('foobar');
          }
        },

        {
          desc: 'basic 1 input param, 5 funcs',
          run: function (env, test) {

            const m = env.middleware.chain((next, input) => {
              next(true, ++input);
            }, (next, input) => {
              next(true, ++input);
            }, (next, input) => {
              next(true, ++input);
            }, (next, input) => {
              next(true, ++input);
            }, (input) => {
              test.assert(input, 4);
            });
            m(0);
          }
        },

        {
          desc: 'basic 2 inputs param, 2 funcs',
          run: function (env, test) {
            const cb = function () {
              test.done();
            };
            const m = env.middleware.chain((next, input, cb) => {
              next(true, ++input, cb);
            }, (input, cb) => {
              test.assertAnd(input, 1);
              cb();
            });
            m(0, cb);
          }
        },

        {
          desc: 'basic 4 input params, 5 funcs',
          run: function (env, test) {

            const m = env.middleware.chain((next, input1, input2, input3, input4) => {
              next(true, ++input1, input2, input3, input4);
            }, (next, input1, input2, input3, input4) => {
              next(true, input1, ++input2, input3, input4);
            }, (next, input1, input2, input3, input4) => {
              next(true, input1, input2, ++input3, input4);
            }, (next, input1, input2, input3, input4) => {
              next(true, input1, input2, input3, ++input4);
            }, (input1, input2, input3, input4) => {
              test.assert([input1, input2, input3, input4], [1, 1, 4, 6]);
            });
            m(0, 0, 2, 5);
          }
        }
      ]
    }
  ];
});
