if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['jaribu/helpers', 'jaribu/tools/Write'],
function (helpers, Write, undefined) {

  /*
   * The Suite objects is the 'root' object for a test suite (which is
   * a collection of related tests). It's behavior is more or less the
   * same as the Test object.
   */
  write = new Write();
  function Suite() {}
  Suite.prototype = {
    constructor: Suite,
    type: "Suite",
    name: "",
    desc: "",
    helpers: helpers.pub,
    write: write.func,
    setup: undefined,
    takedown: undefined,
    beforeEach: undefined,
    afterEach: undefined,
    env: undefined,
    testIndex: 0,
    next: undefined,
    prev: undefined,
    position: null
  };

  return Suite;
});