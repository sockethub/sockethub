const activityObjects = require('./sockethub-activity-object.js');
const o = require('./object-types.js');

const validActorRefs  = activityObjects.properties.object.oneOf;
const validTargetRefs = activityObjects.properties.object.oneOf;
console.log(validActorRefs);

let validObjectRefs = [];

const keys = Object.keys(o.objectTypes);
keys.forEach(function (type, i) {
  validObjectRefs.push({ "$ref": "#/definitions/type/" + type });
});

const contextSchema = {
  "type": "string"
};
const typeSchema = {
  "type": "string"
};

module.exports = {
  "$id": "https://sockethub.org/schemas/v0/activity-stream#",
  "description": "Schema for Sockethub Activity Streams",

  "type": "object",
  "required" : [ "context", "type", "actor" ],
  "properties": {
    "id": {
      "type": "string"
    },
    "type": typeSchema,
    "context": contextSchema,
    "actor": {
      "type": "object",
      "oneOf": validActorRefs
    },
    "target": {
      "type": "object",
      "oneOf": validTargetRefs
    },
    "object": {
      "type": "object",
      "oneOf": validObjectRefs
    }
  },

  "definitions": {
    "type": o.objectTypes
  }
};
