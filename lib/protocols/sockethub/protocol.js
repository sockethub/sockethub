var schemas = require('./schemas.js');
var functions = (function() {
  var pub = {};

  pub.ping = function(d, resp) {
    var response = '{}';
    if (typeof d.timestamp) {
      response = '{"response": {"timestamp":"'+d.timestamp+'"}}';
    } else {
      response = '{"response": "invalid json"}';
    }
    resp(response);
  };

  pub.message = function(d, resp) {
    var response = '{}';
    resp(response);
  };
  return pub;
})();

module.exports = {
  "commands" : [
    {
      "name" : "ping",
      "schema" : schemas['ping'],
      "func" : functions.ping
    },
    {
      "name" : "register",
      "schema" : schemas['register'],
      "func" : function(){}
    },
    {
      "name" : "search",
      "schema" : schemas['search'],
      "func" : function(){}
    }
  ]
};