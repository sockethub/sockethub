import { validObjectRefs, validObjectDefs } from "../helpers/objects";

export default {
  "$id": "https://sockethub.org/schemas/v0/activity-object#",
  "description": "Schema for Sockethub Activity Objects",

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
