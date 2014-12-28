var objectTypes = require('./object-types');

var validObjects = [
  { "$ref": "#/definitions/objectTypes/person" },
  { "$ref": "#/definitions/objectTypes/room" },
];

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
    "objectTypes": objectTypes
  }
};
