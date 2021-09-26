const objectTypes = require('./object-types');

let validObjectRefs = [];
let validObjectDefs = {};

const keys = Object.keys(objectTypes);
keys.forEach(function (type, i) {
  if (objectTypes[type]["activity-object"]) {
    validObjectRefs.push({ "$ref": "#/definitions/type/" + type });
    validObjectDefs[type] = objectTypes[type];
    delete objectTypes[type]["activity-object"];
  }
});

module.exports = {
  "$id": "https://sockethub.org/schemas/v0/activity-object#",
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
