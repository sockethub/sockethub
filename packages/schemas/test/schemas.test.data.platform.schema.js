module.exports = {
  "version": "1.0",
  "messages": {
    "required": ['type'],
    "properties": {
      "type": {
        "enum": ['connect', 'update', 'send', 'join', 'query', 'foo']
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
        "required": ['type', 'username', 'password', 'host'],
        "additionalProperties": false,
        "properties": {
          "type": {
            "type": "string"
          },
          "username": {
            "type": "string"
          },
          "password": {
            "type": "string"
          },
          "host": {
            "type": "string"
          },
          "port": {
            "type": "number"
          }
        }
      }
    }
  }
};