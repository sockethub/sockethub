if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function () {
  var suites = [];

  suites.push({
    desc: "should be able to throw and catch errors as part of tests",
    tests: [

      {
        desc: "just a throw, no other params",
        run: function (env, test) {

          function causeTrouble() {
            throw new Error("I'm nothing but trouble.");
          }

          this.throws(causeTrouble);
        }
      },

      {
        desc: "make a function that throws an error and test it",
        run: function (env, test) {

          function causeTrouble() {
            throw new Error("I'm nothing but trouble.");
          }

          this.throws(causeTrouble, Error, "raised Error");
        }
      },

      {
        desc: "make a simple string error",
        run: function (env, test) {
          this.throws(
            function() {
              throw "error";
            },
            "throws with just a message, no expected"
          );
        }
      },

      {
        desc: "throw an async error",
        run: function (env, test) {
          function causeTrouble() {
            setTimeout(function () {
              throw new Error("I'm nothing but trouble.");
            }, 1000);
          }

          this.throws(causeTrouble, Error, "raised Error from async call");
        }
      },

      {
        desc: "throw custom error",
        run: function (env, test) {

          function CustomError( message ) {
            this.message = message;
          }
          CustomError.prototype.toString = function() {
            return this.message;
          };

          this.throws(
            function() {
              throw new CustomError();
            },
            CustomError,
            "raised error is an instance of CustomError"
          );
        }
      },

      {
        desc: "throw an async error - and fail!",
        willFail: true,
        run: function (env, test) {
          function causeTrouble() {
            setTimeout(function () {
              throw new Error("I'm nothing but trouble.");
            }, 1000);
          }
        }
      }

    ]
  });

  return suites;
});