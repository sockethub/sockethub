const objectTypes = require('./object-types');

let validObjectRefs = [];
let validObjectDefs = {};

const keys = Object.keys(objectTypes);
keys.forEach(function (type, i) {
  if (objectTypes[type]["activity-object"]) {
    validObjectRefs.push({ "$ref": "#/definitions/type/" + type });
    validObjectDefs[type] = objectTypes[type];
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
      "oneOf": validObjectRefs
    }
  },

  "definitions": {
    "type": validObjectDefs
  }
};
