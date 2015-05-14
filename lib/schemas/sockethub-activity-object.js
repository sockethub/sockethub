var objectTypes = require('./object-types');

var validObjects = [];

var keys = Object.keys(objectTypes);
for (var i = 0, len = keys.length; i < len; i++) {
  validObjects.push({ "$ref": "#/definitions/type/" + keys[i] });
}

module.exports = {
  "id": "http://sockethub.org/schemas/v0/activity-object#",
  "$schema": "http://json-schema.org/draft-04/schema#",
  "description": "schema for Sockethub Activity Objects",

  "type": "object",
  "required" : [ "object" ],
  "properties": {
    "object": {
      "type": "object",
      "oneOf": validObjects
    }
  },

  "definitions": {
    "type": objectTypes
  }
};
