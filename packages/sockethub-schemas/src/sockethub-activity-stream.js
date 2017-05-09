var activityObjects = require('./sockethub-activity-object.js');
var objectTypes     = require('./object-types.js');

var validActorRefs  = activityObjects.properties.object.oneOf;
var validTargetRefs = activityObjects.properties.object.oneOf

var validObjectRefs = [];
var keys = Object.keys(objectTypes);
keys.forEach(function (type, i) {
  validObjectRefs.push({ "$ref": "#/definitions/type/" + type });
});

var contextSchema = {
  "type": "string"
};
var typeSchema = {
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
