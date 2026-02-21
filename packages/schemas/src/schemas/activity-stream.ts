import {
    AS2_BASE_CONTEXT_URL,
    SOCKETHUB_BASE_CONTEXT_URL,
} from "../context.js";
import { ObjectTypesList, ObjectTypesSchema } from "../helpers/objects.js";
import { ActivityObjectSchema } from "./activity-object.js";

const validActorRefs = ActivityObjectSchema.properties.object.oneOf;
const validTargetRefs = ActivityObjectSchema.properties.object.oneOf;
// console.log(validActorRefs);

const validObjectRefs = [];

for (const type of ObjectTypesList) {
    validObjectRefs.push({ $ref: `#/definitions/type/${type}` });
}

const contextSchema = {
    type: "array",
    minItems: 3,
    maxItems: 3,
    items: {
        type: "string",
    },
    allOf: [
        {
            contains: {
                const: AS2_BASE_CONTEXT_URL,
            },
        },
        {
            contains: {
                const: SOCKETHUB_BASE_CONTEXT_URL,
            },
        },
    ],
};
const typeSchema = {
    type: "string",
};

export const ActivityStreamSchema = {
    $id: "https://sockethub.org/schemas/v/activity-stream.json",
    description: "Schema for Sockethub Activity Streams",

    type: "object",
    required: ["@context", "type", "actor"],
    properties: {
        "@context": contextSchema,
        id: {
            type: "string",
        },
        type: typeSchema,
        actor: {
            type: "object",
            oneOf: validActorRefs,
        },
        target: {
            type: "object",
            oneOf: validTargetRefs,
        },
        object: {
            type: "object",
            oneOf: validObjectRefs,
        },
        published: {
            type: "string",
            format: "date-time",
        },
    },

    definitions: {
        type: ObjectTypesSchema,
    },
};
