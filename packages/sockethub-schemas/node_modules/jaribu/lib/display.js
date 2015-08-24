if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['jaribu/colors'], function (colors, undefined) {
 
  var pub = {},
      _ = {},
      c = colors,
      cfg = {
        type: 'console'
      },
      //console.log(c.reset); // reset colors
      passed = c.green + 'passed' + c.reset,
      failed = c.red + 'failed' + c.reset;


  if ((typeof window !== 'undefined') && (typeof window.document === 'object')) {
    cfg.type = 'browser';
  }

  var testOutput;
  function __browserWrite (line) {
    if (!testOutput) {
      testOutput = document.getElementById('jaribuTestOutput');
    }
    testOutput.innerHTML += line;
    // window.document.write(line);
  }


  pub.linebreak = function () {
    _.linebreak[cfg.type]();
  };
  _.linebreak = {
    console: function () {
      console.log("\n");
    },
    browser: function () {
      __browserWrite('<br />');
    }
  };

  pub.begin = function (num_suites, total_tests) {
    _.begin[cfg.type](num_suites, total_tests);
  };
  _.begin = {
    console: function (num_suites, total_tests) {
      console.log("\nrunning... " + num_suites + ' suites, ' + total_tests + ' tests.');
    },
    browser: function (num_suites, total_tests) {
      __browserWrite('<p>running... ' + num_suites + ' suites, ' + total_tests + ' tests.</p>');
    }
  };

  pub.print = function (msg) {
    _.print[cfg.type](msg);
  };
  _.print = {
    console: function (msg) {
      process.stdout.write(msg);
    },
    browser: function (msg) {
      __browserWrite(msg);
    }
  };

  pub.printn = function (msg) {
    _.printn[cfg.type](msg);
  };
  _.printn = {
    console: function (msg) {
      process.stdout.write(msg + "\n");
    },
    browser: function (msg) {
      __browserWrite(msg + '<br />');
    }
  };

  pub.write = function (msg) {
    _.write[cfg.type](msg);
  };
  _.write = {
    console: function (msg) {
      // console.log('    ' + c.yellow + '> ' + msg + c.reset);
    },
    browser: function (msg) {
      // __browserWrite(c.grey + ' > ' + msg + c.reset);
    }
  };


  /*
  * Suite info display functions
  */
  pub.suiteBorder = function () {
    _.suiteBorder[cfg.type]();
  };
  _.suiteBorder = {
    console: function () {
      process.stdout.write("\n\n= ");
    },
    browser: function () {
      __browserWrite('</p>= ');
    }
  };

  // test or suite details
  pub.details = function (name, o) {
    _.details[cfg.type](name, o);
  };
  _.details = {
    console: function (name, o) {
      if (name === 'suite') {
        if (typeof o.name !== 'undefined') {
          process.stdout.write(c.cyan + o.name + c.reset + ' - ');
        }
        process.stdout.write(c.blue + o.desc + c.reset + "\n");
      } else {
        console.log("\n- [" + o.parent.position +
            '/' + o.position + '] test ' + c.reset +
            c.blue + o.desc + c.reset);
      }
    },
    browser: function (name, o) {
      if (name === 'suite') {
        if (typeof o.name !== 'undefined') {
          __browserWrite(c.cyan + o.name + c.reset + ' - ');
        }
        __browserWrite(c.blue + o.desc + c.reset + '<br />');
      } else {
        __browserWrite("<br />- " + '[' + o.parent.position +
            '/' + o.position + '] test ' + c.reset +
            c.blue + o.desc + c.reset);
      }
    }
  };

  pub.beforeEach = function () {
    _.beforeEach[cfg.type]();
  };
  _.beforeEach = {
    console: function () {
      process.stdout.write('-');
    },
    browser: function () {
      __browserWrite('-');
    }
  };

  pub.afterEach = function () {
    _.afterEach[cfg.type]();
  };
  _.afterEach = {
    console: function () {
      process.stdout.write('`');
    },
    browser: function () {
      __browserWrite('`');
    }
  };

  // setup intro
  pub.setup = function (name) {
    _.setup[cfg.type](name);
  };
  _.setup = {
    console: function (name) {
      if (name === 'suite') {
        process.stdout.write('/');
      } else {
        process.stdout.write('/');
      }
    },
    browser: function (name) {
      if (name === 'suite') {
        __browserWrite('@');
      } else {
        __browserWrite('@');
      }
    }
  };

  // takedowns
  pub.takedown = function (name) {
    _.takedown[cfg.type](name);
  };
  _.takedown = {
    console: function (name) {
      if (name === 'suite') {
        process.stdout.write('#');
      } else {
        process.stdout.write('#');
      }
    },
    browser: function (name) {
      if (name === 'suite') {
        __browserWrite('#');
      } else {
        __browserWrite('#');
      }
    }
  };

  _.mergeMessages = {
    console: function (type, o) {
      var msg = '';
      if (o[type].failmsg) {
        msg = 'failed (' + o[type].failmsg + ')';
      } else {
        msg = 'failed';
      }
      return msg + " " + c.yellow + o[type]._message + c.reset;
    },
    browser: function (type, o) {
      var msg = '';
      if (o[type].failmsg) {
        msg = 'failed (' + o[type].failmsg + ')';
      } else {
        msg = 'failed';
      }
      return msg + " " + c.grey + o[type]._message + c.reset;
    }
  };


  /*
   * display test results
   */

  // FAIL
  pub.fail = function (type, o) {
    var msg = _.mergeMessages[cfg.type](type, o);
    _.fail[cfg.type](type, o, msg);
  };
  _.fail = {
    console: function (type, o, msg) {
      var type_name = type;
      if (type === 'actual') {
        type_name = 'test';
      }
        console.log("\n" + c.redbg + ' FAIL' + c.reset + ' ' + c.cyan + o.name  +
           c.reset + ' ' + type_name + ' ' + c.red + msg + c.reset);
      // } else {
      //   console.log(c.red + 'A- ' + msg + c.reset);
      // }

      if (o[type]._stackTrace !== undefined) {
        console.log(c.reset + c.red + String(o[type]._stackTrace) + c.reset);
      }
    },
    browser: function (type, o, msg) {
      // if (type === 'actual') {
        __browserWrite('<br />' + c.redbg + ' FAIL' + c.reset + ' ' + c.cyan + o.name  +
           c.reset + ' test ' + c.red + msg + c.reset);
      // } else {
      //   __browserWrite('<p>' + c.red + msg + c.reset + '</p>');
      // }

      if (o[type]._stackTrace !== undefined) {
        __browserWrite(c.reset + '<pre>' + c.red + String(o[type]._stackTrace) + c.reset + '</pre></p>');
      }
    }
  };

  // PASS
  pub.pass = function (type, o) {
    _.pass[cfg.type](type, o);
  };
  _.pass = {
    console: function (type, o) {
      if (type === 'actual') {
        process.stdout.write(c.green + '+ ' + c.reset);
      } else {
        //process.stdout.write(c.yellow + '.' + c.reset);
      }
    },
    browser: function (type, o) {
      if (type === 'actual') {
        __browserWrite(c.green + '+ ' + c.reset);
      } else {
        //__browserWrite(c.yellow + '.' + c.reset);
      }
    }
  };


  /*
  * summary displays
  */
  pub.summary = function (num_suites, summary) {
    _.summary[cfg.type](num_suites, summary);
  };

  _.summary = {
    console: function (num_suites, summary) {
      console.log("\n\nSummary\n=======\n");
      process.stdout.write('scaffolding report  ');
      console.log(c.red + summary.scaffolding.failed + c.reset + ' failed,  ' +
            c.green + summary.scaffolding.passed + c.reset + ' passed, ' + 
            c.cyan + summary.scaffolding.skipped + c.reset + ' skipped, ' + 
            c.blue + summary.scaffolding.total + c.reset + ' total.');
      process.stdout.write('       test report  ');
      console.log(c.red + summary.tests.failed + c.reset + ' failed,  ' +
            c.green + summary.tests.passed + c.reset + ' passed, '+
            c.cyan + summary.tests.skipped + c.reset + ' skipped, '+
            c.blue + summary.tests.total + c.reset + ' total.');
    },
    browser: function (num_suites, summary) {
      __browserWrite('<p>&nbsp;<br /></p><p><u>Summary</u></p>');
      __browserWrite('scaffolding report  ');
      __browserWrite('<p>' + c.red + summary.scaffolding.failed + c.reset + ' failed,  ' +
            c.green + summary.scaffolding.passed + c.reset + ' passed, '+
            c.cyan + summary.scaffolding.skipped + c.reset + ' skipped, '+
            c.blue + summary.scaffolding.total + c.reset + ' total.</p>');
      __browserWrite('       test report  ');
      __browserWrite('<p>' + c.red + summary.tests.failed + c.reset + ' failed,  ' +
            c.green + summary.tests.passed + c.reset + ' passed, '+
            c.cyan + summary.tests.skipped + c.reset +' skipped, '+
            c.blue + summary.tests.total + c.reset + ' total.</p>');
    }
  };

  pub.failures = function (summary) {
    _.failures[cfg.type](summary);
  };
  _.failures = {
    console: function (summary) {
      var i, o;
      var failedScaffoldingLength = summary.scaffolding.failObjs.length;
      if (failedScaffoldingLength > 0) {
        process.stdout.write("\nfailed scaffolding:");
      }
      pub.linebreak();
      for (i = 0; i < failedScaffoldingLength; i += 1) {
        o = summary.scaffolding.failObjs[i];
        if (o.obj.parent !== undefined) {
          pub.details('suite', o.obj.parent);
          pub.details(o.name, o.obj);
        } else {
          pub.details('suite', o.obj);
        }
        process.stdout.write("\n" + o.type + ': ');
        pub.fail(o.type, o.obj);
      }

      var failedTestsLength = summary.tests.failObjs.length;
      if (failedTestsLength > 0) {
        console.log("\nfailed tests:");
      }
      for (i = 0; i < failedTestsLength; i += 1) {
        o = summary.tests.failObjs[i];
        pub.details('suite', o.obj.parent);
        pub.details(o.name, o.obj);
        pub.fail(o.type, o.obj);
        pub.linebreak();
      }
    },
    browser: function (summary) {
      var i, o;
      var failedScaffoldingLength = summary.scaffolding.failObjs.length;
      if (failedScaffoldingLength > 0) {
        __browserWrite("<br />failed scaffolding:");
      }
      pub.linebreak();
      for (i = 0; i < failedScaffoldingLength; i += 1) {
        o = summary.scaffolding.failObjs[i];
        if (o.obj.parent !== undefined) {
          pub.details('suite', o.obj.parent);
          pub.details(o.name, o.obj);
        } else {
          pub.details('suite', o.obj);
        }
        __browserWrite("\n" + o.type + ': ');
        pub.fail(o.type, o.obj);
      }

      var failedTestsLength = summary.tests.failObjs.length;
      if (failedTestsLength > 0) {
        __browserWrite("<br />failed tests:");
      }
      for (i = 0; i < failedTestsLength; i += 1) {
        o = summary.tests.failObjs[i];
        pub.details('suite', o.obj.parent);
        pub.details(o.name, o.obj);
        pub.fail(o.type, o.obj);
        pub.linebreak();
      }
    }
  };

  return pub;
});
