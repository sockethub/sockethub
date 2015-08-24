if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['jaribu/testlib2'], function (testlib2) {
  var pub = {};

  joinStrings = function(s1, s2) {
    return s1 + s2;
  };

  pub.stringBeast = function(s1, s2, s3, s4) {
    var c1, c2;
    if ((testlib2.checkString(s1)) && (testlib2.checkString(s2))) {
      c1 = joinStrings(s1, s2);
    }
    if ((testlib2.checkString(s3)) && (testlib2.checkString(s4))) {
      c2 = joinStrings(s3, s4);
    }
    return joinStrings(c1, c2);
  };

  return pub;
});