var schemas = {
  "ping" : {
    "title": "message",
    "type": "object",
    "properties": {
      "timestamp": {
        "type": "integer"
      }
    },
    "required": ["timestamp"]
  },
  "search" : {
    "title": "search",
    "type": "object",
    "properties": {
      "timestamp": {
        "type": "integer"
      }
    },
    "required": ["timestamp"]
  }
};
module.exports = schemas;