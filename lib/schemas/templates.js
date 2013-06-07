module.exports = {
  actor: {
    "type": "object",
    "required": true,
    "properties": {
      "name": {
        "type": "string",
        "required": false
      },
      "address": {
        "type": "string",
        "required": true,
        "pattern": "^[a-zA-Z0-9]+"
      }
    }
  },
  target: {
    "type": "array",
    "required": true,
    "items": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "required": false
        },
        "address": {
          "type": "string",
          "required": true
        },
        "field": {
          "type": "string",
          "required": false
        }
      }
    }
  }
};