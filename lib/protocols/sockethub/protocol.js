var schemas = require('./schemas.js');
var functions = require('./functions.js');
module.exports = {
  "commands" : [
    {
      "name" : "ping",
      "schema" : schemas['ping'],
      "func" : functions['ping']
    },
    {
      "name" : "search",
      "schema" : schemas['search'],
      "func" : functions['search']
    }
  ]
};