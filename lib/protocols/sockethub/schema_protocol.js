// the schema defining the platforms schema (returned from
// <protocol_name>/protocol.js, which must list the verbs and platforms
// supported, with schemas for the verbs./
module.exports = {
  "type" : "object",
  "properties" : {
    "verbs" : {
      "title": "verbs",
      "type": "object",
      "required" : true,
      "patternProperties": {
        ".+": {
          "title" : "ping",
          "type": "object",
          "required" : false,
          "properties" : {
            "name" : {
              "title" : "name",
              "type": "string",
              "required": true
            },
            "schema" : {
              "title" : "schema",
              "type": "object",
              "required": true
            }
          }
        }
      }
    },

    "platforms" : {
      "title": "platforms",
      "type": "object",
      "required": true,
      "patternProperties": {
        ".+": {
          "type": "object",
          "required": false,
          "properties": {
            "name": {
              "type": "string",
              "required" : true
            },
            "verbs": {
              "type": "object",
              "required" : true
            }
          }
        }
      }
    }
  }
};
