import { ObjectTypesList, ObjectTypesSchema } from "../helpers/objects.js";
import { ActivityObjectSchema } from "./activity-object.js";

const validActorRefs = ActivityObjectSchema.properties.object.oneOf;
const validTargetRefs = ActivityObjectSchema.properties.object.oneOf;
console.log(validActorRefs);

const validObjectRefs = [];

for (const type of ObjectTypesList) {
    validObjectRefs.push({ $ref: `#/definitions/type/${type}` });
}

const contextSchema = {
    type: "string",
};
const typeSchema = {
    type: "string",
};

export const ActivityStreamSchema = {
    $id: "https://sockethub.org/schemas/v/activity-stream.json",
    description: "Schema for Sockethub Activity Streams",

    type: "object",
    required: ["context", "type", "actor"],
    properties: {
        id: {
            type: "string",
        },
        type: typeSchema,
        context: contextSchema,
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
