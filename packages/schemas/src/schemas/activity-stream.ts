import {
    AS2_BASE_CONTEXT_URL,
    SOCKETHUB_BASE_CONTEXT_URL,
} from "../context.js";
import {
    ObjectTypesSchema,
    validActorRefs,
    validTargetRefs,
} from "../helpers/objects.js";

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
    // Reject unknown top-level message properties. Inbound messages carry only
    // the properties below; `error`/`sessionSecret` are added server-side after
    // validation, so they never reach this schema.
    additionalProperties: false,
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
        // Object shape is validated per-platform by each platform's `messages`
        // (inbound) and `responses` (outbound) schemas, which own their object
        // vocabulary. The base envelope only requires it to be an object.
        object: {
            type: "object",
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
