const activityObjects = require('./sockethub-activity-object.js');
const objectTypes     = require('./object-types.js');

const validActorRefs  = activityObjects.properties.object.oneOf;
const validTargetRefs = activityObjects.properties.object.oneOf;

let validObjectRefs = [];

const keys = Object.keys(objectTypes);
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
  "id": "http://sockethub.org/schemas/v0/activity-stream#",
  "$schema": "http://json-schema.org/draft-04/schema#",
  "description": "schema for Sockethub Activity Streams",

  "type": "object",
  "required" : [ "context", "@type", "actor" ],
  "properties": {
    "@id": {
      "type": "string"
    },
    "@type": typeSchema,
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
    "type": objectTypes
  }
};
