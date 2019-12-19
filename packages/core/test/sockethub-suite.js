if (typeof define !== 'function') {
  let define = require('amdefine')(module);
}
define(['require', '../dist/sockethub'], function (require, Sockethub) {
  return [
    {
      desc: 'src/sockethub',
      abortOnFail: true,
      beforeEach: function () {
        this.env.sockethub = new Sockethub.default();
        this.done();
      },
      tests: [
        {
          desc: 'boot',
          run: function () {
            this.env.sockethub.boot();
            this.assertTypeAnd(this.env.sockethub.platforms, 'object');
            this.assertType(this.env.sockethub.platforms.size, 'number');
          }
        }
      ]
    }
  ];
});