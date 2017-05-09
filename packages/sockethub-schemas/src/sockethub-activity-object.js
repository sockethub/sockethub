var objectTypes = require('./object-types');

var validObjects = [];
var validObjectTypes = {};

var keys = Object.keys(objectTypes);
keys.forEach(function (type, i) {
  if (objectTypes[type]["activity-object"]) {
    validObjects.push({ "$ref": "#/definitions/type/" + type });
    validObjectTypes[type] = objectTypes[type];
  }
});

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
    "type": validObjectTypes
  }
};
