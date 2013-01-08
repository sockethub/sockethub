var ping = (function() {
  var pub = {};
  pub.init = function(d) {
    console.log("PING CALLED ", d);
  };

  return pub;
}());

var search = (function() {
  var pub = {};
  pub.init = function(d) {

  };

  return pub;
}());

module.exports = {
  'ping' : ping.init,
  'search' : search.init
};