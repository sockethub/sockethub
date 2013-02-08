var smtp = require('./smtp-implementation');
module.exports = {
  schema: {
    "config": {
      "credentials" : {
        "type": "object",
        "required": false,
        "patternProperties" : {
          ".+": {
            "type": "object",
            "required": true,
            "properties": {
              "smtp": {
                "type": "object",
                "required": false,
                "properties" : {
                  "host" : {
                    "name" : "host",
                    "required" : true,
                    "type": "string"
                  },
                  "username" : {
                    "name" : "username",
                    "required" : true,
                    "type": "string"
                  },
                  "password" : {
                    "name" : "password",
                    "required" : true,
                    "type": "string"
                  },
                  "secure" : {
                    "name" : "secure",
                    "required" : false,
                    "type": "string"
                  },
                  "port" : {
                    "name" : "port",
                    "required" : false,
                    "type": "string"
                  },
                  "domain" : {
                    "name" : "domain",
                    "required" : false,
                    "type": "string"
                  },
                  "mimeTransport" : {
                    "name" : "mimeTransport",
                    "required" : false,
                    "type": "string"
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  send: smtp.send
};
