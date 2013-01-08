var ping = (function() {
  var pub = {};
  pub.init = function(d, resp) {
    var response = '{}';
    if (typeof d.timestamp) {
      response = '{"response": {"timestamp":"'+d.timestamp+'"}}';
    } else {
      response = '{"response": "invalid json"}';
    }
    resp(response);
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