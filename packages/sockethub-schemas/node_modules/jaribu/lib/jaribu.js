if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([
  'jaribu/colors', 'jaribu/display', 'jaribu/tools/Env',
  'jaribu/Scaffolding', 'jaribu/Test', 'jaribu/Suite'],
function (c, display, Env, Scaffolding, Test, Suite) {
  "use strict";
  var suites = [];
  var err_msg = '';
  var pub = {};
  var _ = {};
  _.onComplete = function () {};

  var runningInBrowser = false;
  if (typeof window === 'object') {
    runningInBrowser = true;
  }

  function buildTestObj(env, s, t) {
    if (! t.desc ) {
      err_msg = s.name + ": test '" + t.name +
              "'' requires a 'desc' property";
      return false;
    } else if (typeof t.run !== 'function') {
      err_msg = s.name + ": test '" + t.name +
              "'' requires a 'run' function";
      return false;
    }

    var test = new Test();
    //test.name = t.name;
    test.desc = t.desc;
    test.setup = new Scaffolding();
    test.actual = new Scaffolding();
    test.takedown = new Scaffolding();

    // even though before/afterEach are defined
    // at the suite level, we need a separate object
    // for each test to run so that it's environment
    // is preserved and there's no bleed.
    test.beforeEach = new Scaffolding();
    test.afterEach = new Scaffolding();
    test.beforeEach.env = env;
    test.afterEach.env = env;
    if (typeof s.beforeEach === 'function') {
      test.beforeEach.run = s.beforeEach;
    }
    if (typeof s.afterEach === 'function') {
      test.afterEach.run = s.afterEach;
    }

    test.setup.env = env;
    test.actual.env = env;
    test.takedown.env = env;
    test.actual.run = t.run;
    test.actual.willFail = undefined;
    if (typeof t.setup === 'function') {
      test.setup.run = t.setup;
    }
    if (typeof t.takedown === 'function') {
      test.takedown.run = t.takedown;
    }
    // figureout if there is a timeout to override default
    if (typeof t.timeout === 'number') {
      test.actual.timeout = t.timeout;
      test.setup.timeout = t.timeout;
      test.takedown.timeout = t.timeout;
    }
    if (typeof t.willFail === 'boolean') {
      // if true, a failing test passes, and passing test fails
      test.actual.willFail = t.willFail;
    }

    //console.log(test);
    return test;
  }

  function buildSuiteObj(suite, env, s) {
    suite.name = s.name;
    suite.desc = s.desc;
    suite.setup = new Scaffolding();
    suite.takedown = new Scaffolding();
    suite.setup.env = env;
    suite.takedown.env = env;
    if (typeof s.setup === 'function') {
      suite.setup.run = s.setup;
    }
    if (typeof s.takedown === 'function') {
      suite.takedown.run = s.takedown;
    }
    if (typeof s.abortOnFail === 'boolean') {
      // if true, abort execution
      suite.abortOnFail = s.abortOnFail;
    }
    return suite;
  }

  /**
   * load a single suite json object into the library
   *
   * @param  {object}   s   suite object from test file
   * @return {boolean}      success of loading
   */
  pub.loadSuite = function (s) {
    if (! s.desc ) {
      err_msg = '... suite requires a \'desc\' property';
      return false;
    } else if (! s.tests ) {
      err_msg = '... suite requires a \'tests\' array';
      return false;
    } else if ((runningInBrowser) && 
               ((typeof s.runInBrowser === 'boolean') && (! s.runInBrowser))) {
      err_msg = '... suite should not run in the browser. skipping.';
      return false;
    }

    /*
     * Create all the test objects from the JSON data
     */
    var tests = [];
    var suite = new Suite(); // we define this early so we can assign it
                             // as parent to test objects
    var env = new Env();
    if (typeof s.timeout === 'number') {
      // override test timeouts with Suite timeout
      Test.prototype.timeout = s.timeout;
      // override test timeouts with Suite timeout
      Scaffolding.prototype.timeout = s.timeout;
    }

    for (var i = 0, len = s.tests.length; i < len; i++) {
      var test = buildTestObj(env, s, s.tests[i]);
      // set position related attributes to test object
      test.position = i;
      if (i !== 0) {
        test.prev = tests[i - 1];
        tests[i - 1].next = test;
      }
      test.parent = suite;
      tests.push(test);
    }


    /*
     * Create the suite object
     */
    suite = buildSuiteObj(suite, env, s);
    suite.tests = tests;

    // set position related attributes to suite object
    suite.position = suites.length;
    if (suite.position !== 0) {
      suite.prev = suites[suite.position - 1];
      suites[suite.position - 1].next = suite;
    }
    suites.push(suite);
    return true;
  };


  /**
   *  shall reset the jaribu enviroment to load new tests
   **/
  pub.reset = function() {
    suites = [];
  };


  /**
   * returns the error message
   * @return {string} error message
   */
  pub.getErrorMessage = function () {
    return err_msg;
  };


  /**
   * returns the number of suites loaded
   * @return {number} number of suites loaded
   */
  pub.getNumSuites = function () {
    return suites.length;
  };


  /**
   * returns the total number of tests in all the suites combined.
   * @return {number} total number of tests
   */
  pub.getNumTests = function () {
    var total_tests = 0, i = 0;
    var num_suites = pub.getNumSuites();
    for (i = 0; i < num_suites; i += 1) {
      total_tests = total_tests + suites[i].tests.length;
    }
    return total_tests;
  };


  /**
   * begins the test cyle, by activating the first suite
   * @param  {function} onComplete    function to call when all tests are
   *                                  complete
   * @return {}
   */
  pub.begin = function (onComplete) {
    _.onComplete = onComplete;

    function errFunction (error) {
      if ((typeof(_.current) === 'object') &&
          (! _.current._genertingStackTrace) &&
          (! _.current.willThrow)) {
        _.current.result(false, "\n" + error, error.stack);
      } else if (((typeof(_.current) !== 'object') ||
                  (( !_.current.willThrow)) &&
                   ( !_.current.genertingStackTrace))) {
        console.error("Uncaught exception without test context: ", "\n", error, error.stack);
        process.exit(-1);
      }
    }

    if (typeof process !== 'undefined') {
      process.on('uncaughtException', errFunction);
    } else {
      window.addEventListener('error', errFunction);
    }

    var num_suites = pub.getNumSuites();
    var total_tests = pub.getNumTests();
    display.begin(num_suites, total_tests);

    if (suites[0]) {
      run('setup', 0);
    }
  };


  /**
   * test object is passed here when it passes the test, setup or takedown.
   * handles printing the result, and updating the objects status.
   *
   * @param  {string}  part       - indicates the portion of test just run
   * @param  {number}  suiteIndex - the index number of the test run
   * @param  {number}  testIndex  - the index number of the test run [optional]
   */
  function pass(part, suiteIndex, testIndex) {
    var o;
    var isSuite = false;

    if (typeof testIndex === 'number') {
      o = suites[suiteIndex].tests[testIndex];
    } else {
      isSuite = true;
      o = suites[suiteIndex];
    }

    display.pass(part, o);

    if ( isSuite ) {  // Suite ----------------------------
      if (part === 'setup') {  // setup completed
        o.setup.status = true;
        // run the next test in suite
        if (!testIndex) {
          testIndex = 0;
        } else {
          testIndex = testIndex + 1;
        }

        if (typeof o.tests[testIndex] === 'object') {
          run('beforeEach', suiteIndex, testIndex);
        } else {
          run('takedown', suiteIndex);
        }
      } else if (part === 'takedown') {  // takedown completed
        o.takedown.status = true;
        if (o.next) {
          // move on to the next suite
          run('setup', suiteIndex + 1);
        } else {
          // finished, show summary results
          showSummary();
        }
      }
    } else {  // Test ----------------------------------------------
      if (part === 'beforeEach') {  // beforeEach completed
        o.beforeEach.status = true;
        // run the test setup
        run('setup', suiteIndex, testIndex);
      } else if (part === 'setup') {  // setup completed
        o.setup.status = true;
        // run the test
        run('actual', suiteIndex, testIndex);
      } else if (part === 'takedown') {  // takedown completed
        o.takedown.status = true;
        // call afterEach
        run('afterEach', suiteIndex, testIndex);
      } else if (part === 'afterEach') {  // afterEach completed
        o.afterEach.status = true;
        if (typeof o.parent.tests[testIndex + 1] === 'object') {
          o.parent.testIndex = testIndex + 1;
          run('beforeEach', suiteIndex, testIndex + 1);
        } else {
          // run suites takedown
          run('takedown', suiteIndex);
        }
      } else {
        // test is complete
        o.status = true;
        run('takedown', suiteIndex, testIndex);
      }
    }
  }


  /**
   * test object is passed here when it fails the test, setup or takedown.
   * handles printing the result, and updating the objects status.
   *
   * @param  {string}  part       - indicates the portion of test just run
   * @param  {number}  suiteIndex - the index number of the test run
   * @param  {number}  testIndex  - the index number of the test run [optional]
   * @param  {string}  msg        - any special failure message [optional]
   */
  function fail(part, suiteIndex, testIndex, msg) {
    if (typeof testIndex === 'string') {
      msg = testIndex;
      testIndex = undefined;
    }

    var o;
    var isSuite = false;

    if (typeof testIndex === 'number') {
      o = suites[suiteIndex].tests[testIndex];
      if (typeof msg === 'string') {
        suites[suiteIndex].tests[testIndex][part].failmsg = msg;
      }
      display.details('test', o);
    } else {
      isSuite = true;
      o = suites[suiteIndex];
      if (typeof msg === 'string') {
        suites[suiteIndex][part].failmsg = msg;
      }
      display.details('suite', o);
    }

    display.fail(part, o);

    // if we've failed, we always perform the takedown.
    if (part === 'takedown') {
      // takedown has been done
      o.takedown.status = false;
      if ( isSuite ) {
        // run next suite
        run('setup', o.next);
      } else {
        // run afterEach for this test
        run('afterEach', suiteIndex, testIndex);
      }
    } else if (part === 'afterEach') {
      o.afterEach.status = false;
      if (typeof o.parent.tests[o.parent.testIndex] === 'object') {
        var ti = o.parent.testIndex;
        o.parent.testIndex = o.parent.testIndex + 1;
        run('beforeEach', suiteIndex, ti);
      } else {
        // run suites takedown
        run('takedown', suiteIndex);
      }
    } else if (part === 'beforeEach') {
      o.beforeEach.status = false;
      run('afterEach', suiteIndex, testIndex);
    } else if (part === 'setup') {
      o.setup.status = false;
      run('takedown', suiteIndex, testIndex);
    } else if (part === 'actual') {
      // the actual test
      o.status = false;
      if (o.parent.abortOnFail) {
        display.print('test failed with abortOnFail set... aborting.');
        showSummary();
      }
      run('takedown', suiteIndex, testIndex);
    } else {
      throw new Error('no part specified in run()');
    }
  }


  /**
   * generically handles each aspect of a suite/test setup/run/takedown
   * using the commonalities in each of the objects methods, and the
   * chaining references (o.next).
   *
   * @param  {string}  part        - the portion of test to be run.
   *                                  (setup, beforeEach, etc.) if undefined
   *                                  assumes 'actual' test
   * @param  {number}  suiteIndex - the index number of the test to run
   * @param  {number}  testIndex   - the index number of the test to run [optional]
   *
   */
  function run(part, suiteIndex, testIndex) {
    var local;
    var o;
    var isSuite = true;

    if (typeof testIndex === 'number') {
      isSuite = false;
      o = suites[suiteIndex].tests[testIndex];
    } else {
      o = suites[suiteIndex];
    }

    if ( part === 'setup' ) {
      if ( isSuite ) {
        display.suiteBorder();
        display.details('suite', o);
        // display.setup('suite');
      } else {
        // display.linebreak();
        //display.details('test', o);
        // display.setup('test');
      }
      local = o.setup;
    } else if ( part === 'beforeEach' ) {
      //display.beforeEach();
      local = o.beforeEach;
    } else if ( part === 'afterEach' ) {
      //display.afterEach();
      local = o.afterEach;
    } else if ( part === 'takedown' ) {
      // if ( isSuite ) {
      //   display.takedown('suite');
      // } else {
      //   display.takedown('test');
      // }
      local = o.takedown;
    } else {
      // must be a test
      local = o.actual;
    }

    executeTest(part, local, suiteIndex, testIndex);
  }


  function executeTest(part, local, suiteIndex, testIndex) {
    //
    // we run the test in the next tick so that the function returns and
    // we don't build up the call stack
    //
    setTimeout(function () {
      // save reference to current test, so the 'uncaughtException' handler can fail
      // the right test.
      _.current = local;

      try {
        //
        // some objects should be given the current test to avoid requiring the
        // tester to pass in the object to apply the results against.
        //
        if (local.WebSocketClient.prototype) {// FIXME no proper test for existence
          local.WebSocketClient.prototype.setTest(local);
        }

        // set running flag
        local._running = true;
        var ret = local.run(local.env.get(), local);
        if (ret && typeof(ret.then) === 'function') {
          ret.then(
            function () {
              local.result(true, 'promise fulfilled');
            },
            function (err) {
              var stack;
              if (err.hasOwnProperty('stack')) {
                stack = err.stack;
              } else {
                stack = new Error('').stack;
              }
              local.result(false, 'promise failed ' + err, stack);
            }
          );
        }

        // if the promise library has a fail function, we can catch unexpected errors
        if (ret && typeof(ret.fail) === 'function') {
          ret.fail(function (err) {
            var stack;
            if (err.hasOwnProperty('stack')) {
              stack = err.stack;
            } else {
              stack = new Error('').stack;
            }
            local.result(false, 'promise failed with an exception ' + err, stack);
          });
        }
      } catch (err) {
        //console.log('LOCAL: ',local);
        if (err.hasOwnProperty('stack')) {
          local.result(false, "\n"+err, err.stack);
        } else {
          local.result(false, "\n"+err);
        }
      }

      waitResult(part, suiteIndex, testIndex, local);
    }, 0);
  }

  function waitResult(part, suiteIndex, testIndex, local) {
    // this is function calls itself after a set interval, checking the
    // status of the test via. the result property.
    // result is initialized as undefined, and the test is not complete
    // until it is 'true' or 'false'.
    var processed = false;
    var waitCount = 0;
    var waitInterval = 50;

    (function _waitResult() {
      if (processed) {
        console.log('test processed, aborting waitResult');
        return;
      } else if (local.result() === undefined)  {
        if (waitCount < local.timeout) {
          waitCount = waitCount + waitInterval;
          setTimeout(_waitResult, waitInterval);
          return;
        } else {
          if (local.willFail === true) {
            display.print('!');
            pass(part, suiteIndex, testIndex);
          } else {
            fail(part, suiteIndex, testIndex, 'timeout');
          }
        }
      } else if (local.result() === false) {
        if (local.willFail === true) {
          display.print('!');
          pass(part, suiteIndex, testIndex);
        } else {
          fail(part, suiteIndex, testIndex);
        }
      } else if (local.result() === true) {
        if ((typeof local.willFail === 'boolean') &&
            (local.willFail === true)) {
          display.print('!');
          fail(part, suiteIndex, testIndex);
        } else {
          pass(part, suiteIndex, testIndex);
        }
      } else {
        display.print(c.red + 'ERROR GETTING RESULT' + c.reset);
        fail(part, suiteIndex, testIndex);
      }
      processed = true;
    }());
  }

  function getTestSummary(summary, suite) {
    // iterate through tests for this suite, populating the summary
    for (var i = 0, len = suite.tests.length; i < len; i++) {
      var t = suite.tests[i];
      var types = [ 'setup', 'takedown', 'beforeEach', 'afterEach' ];
      summary.scaffolding.total = summary.scaffolding.total + 2;

      for (var j = 0, jlen = types.length; j < jlen; j++) {
        if (typeof t[types[j]].status === 'undefined') {
          summary.scaffolding.skipped =
                      summary.scaffolding.skipped + 1;
        } else if (!t[types[j]].status) {
          summary.scaffolding.failed = summary.scaffolding.failed + 1;
          summary.scaffolding.failObjs.push({
            name: 'test',
            type: types[j],
            obj: t
          });
        } else {
          summary.scaffolding.passed = summary.scaffolding.passed + 1;
        }
      }

      summary.tests.total = summary.tests.total + 1;
      if (typeof t.status === 'undefined') {
        summary.tests.skipped = summary.tests.skipped + 1;
      } else if (!t.status) {
        summary.tests.failed = summary.tests.failed + 1;
        summary.tests.failObjs.push({
          name: 'test',
          type: 'actual',
          obj: t
        });
      } else {
        summary.tests.passed = summary.tests.passed + 1;
      }
    }
  }

  function getSuiteSummary(summary, suite) {
    // suite setup & takedown summarization
    var types = ['setup', 'takedown'];
    for (var i = 0, len = types.length; i < len; i++) {
      if (typeof suite[types[i]].status === 'undefined') {
        summary.scaffolding.skipped = summary.scaffolding.skipped + 1;
      } else if (!suite[types[i]].status) {
        summary.scaffolding.failed = summary.scaffolding.failed + 1;
        summary.scaffolding.failObjs.push({
          name: 'suite',
          type: types[i],
          obj: suite
        });
      } else {
        summary.scaffolding.passed = summary.scaffolding.passed + 1;
      }
    }
  }

  function getSummary() {
    var summary = {
      'scaffolding': {
        'total': 0,
        'failed': 0,
        'passed': 0,
        'skipped': 0,
        'failObjs': []
      },
      'tests': {
        'total': 0,
        'failed': 0,
        'passed': 0,
        'skipped': 0,
        'failObjs': []
      }
    };

    for (var i = 0, num_suites = pub.getNumSuites(); i < num_suites; i++) {
      summary.scaffolding.total = summary.scaffolding.total + 2;
      getSuiteSummary(summary, suites[i]);
      getTestSummary(summary, suites[i]);
    }
    return summary;
  }

  function showSummary() {
    var num_suites = pub.getNumSuites();
    var summary = getSummary();

    display.summary(num_suites, summary);

    // call specified onComplete function
    _.onComplete();

    if (((summary.tests.failed > 0) || (summary.tests.failed > 0)) ||
        ((summary.scaffolding.failed > 0) || (summary.scaffolding.failed > 0))) {
      display.printn(c.redbg +   ' FAIL' + c.reset + c.red +
              ' some tests failed!' + c.reset);
      if (typeof process !== 'undefined') {
        process.exit(1);
      }
    } else {
      display.printn(c.greenbg + '  OK ' + c.reset + c.green +
              ' all tests passed!' + c.reset);
      if (typeof process !== 'undefined') {
        process.exit(0);
      }
    }
  }

  pub.display = display;
  return pub;
});