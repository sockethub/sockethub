if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function() {
  var pub = {};

  pub.checkString = function(s) {
    if (typeof s === 'string') {
      return true;
    } else {
      return false;
    }
  };

  return pub;
});