const o = require('./object-types');

module.exports = {
  "$id": "https://sockethub.org/schemas/v0/activity-object#",
  "description": "Schema for Sockethub Activity Objects",

  "type": "object",
  "required" : [ "object" ],
  "properties": {
    "object": {
      "type": "object",
      "oneOf": o.validObjectRefs
    }
  },

  "definitions": {
    "type": o.validObjectDefs
  }
};
