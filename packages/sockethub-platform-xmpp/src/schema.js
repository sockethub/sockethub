const packageJSON = require('../package.json');

module.exports = {
  "version": packageJSON.version,
  "messages": {
    "required": ['@type'],
    "properties": {
      "@type": {
        "enum": ['connect', 'update', 'send', 'join', 'observe', 'request-friend',
          'remove-friend', 'make-friend']
      }
    }
  },
  "credentials": {
    "required": ['object'],
    "properties": {
      // TODO platforms shouldn't have to define the actor property if
      //  they don't want to, just credential specifics
      "actor": {
        "type": "object",
        "required": ["@id"]
      },
      "object": {
        "name": "object",
        "type": "object",
        "required": ['@type', 'username', 'password', 'resource'],
        "additionalProperties": false,
        "properties": {
          "@type": {
            "name": "@type",
            "type": "string"
          },
          "username": {
            "name": "username",
            "type": "string"
          },
          "password": {
            "name": "password",
            "type": "string"
          },
          "server": {
            "name": "server",
            "type": "string"
          },
          "port": {
            "name": "port",
            "type": "number"
          },
          "resource": {
            "name": "resource",
            "type": "string"
          }
        }
      }
    }
  }
};