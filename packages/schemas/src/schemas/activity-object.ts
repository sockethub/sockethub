import { validObjectDefs, validObjectRefs } from "../helpers/objects.js";

export const ActivityObjectSchema = {
    $id: "https://sockethub.org/schemas/v/activity-object.json",
    description: "Schema for Sockethub Activity Objects",

    type: "object",
    required: ["object"],
    properties: {
        object: {
            type: "object",
            oneOf: validObjectRefs,
        },
    },

    definitions: {
        type: validObjectDefs,
    },
};
