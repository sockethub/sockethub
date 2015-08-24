var objectTypes = require('./object-types');

var validActors = [
  { "$ref": "#/definitions/type/person" },
  { "$ref": "#/definitions/type/room" }
];

var validTargets = validActors;

var validObjects = validActors;
validObjects.push(
  { "$ref": "#/definitions/type/credentials" },
  { "$ref": "#/definitions/type/message" }
);

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
      "oneOf": validActors
    },
    "target": {
      "type": "object",
      "oneOf": validTargets
    },
    "object": {
      "type": "object",
      "oneOf": validObjects
    }
  },

  "definitions": {
    "type": objectTypes
  }
};
