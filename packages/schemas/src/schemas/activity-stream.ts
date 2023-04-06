import activityObject from "./activity-object";
import { ObjectTypesList, ObjectTypesSchema } from "../helpers/objects";
import { IActivityStream, ObjectRefs } from "../types";

const validActorRefs  = activityObject.properties.object.oneOf;
const validTargetRefs = activityObject.properties.object.oneOf;
// eslint-disable-next-line security-node/detect-crlf
console.log(validActorRefs);

const validObjectRefs: ObjectRefs = [];

ObjectTypesList.forEach(function (type) {
  validObjectRefs.push({ "$ref": "#/definitions/type/" + type });
});

const contextSchema = {
  "type": "string"
};
const typeSchema = {
  "type": "string"
};

export default {
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
    },
    "published": {
      "type": "string",
      "format": "date-time"
    }
  },

  "definitions": {
    "type": ObjectTypesSchema
  }
};

export interface JobActivityStream extends IActivityStream {
  id: string;
}
