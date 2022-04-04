const packageJSON = require('../package.json');

module.exports = {
  "version": packageJSON.version,
  "messages": {
    "required": ['type'],
    "properties": {
      "type": {
        "enum": ['connect', 'update', 'send', 'join', 'query', 'request-friend',
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
        "required": ["id"]
      },
      "object": {
        "type": "object",
        "required": ['type', 'userAddress', 'password', 'resource'],
        "additionalProperties": false,
        "properties": {
          "type": {
            "type": "string"
          },
          "userAddress": {
            "type": "string"
          },
          "password": {
            "type": "string"
          },
          "server": {
            "type": "string"
          },
          "port": {
            "type": "number"
          },
          "resource": {
            "type": "string"
          }
        }
      }
    }
  }
};
