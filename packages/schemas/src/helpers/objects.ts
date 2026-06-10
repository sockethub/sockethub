// The shared actor/target entity vocabulary. Content object types (message,
// presence, attendance, room-info, topic, …) are owned by each platform's
// `messages` (inbound) and `responses` (outbound) schemas; the base envelope no
// longer enumerates a global object vocabulary.
export const ObjectTypesSchema = {
    feed: {
        required: ["id", "type"],
        additionalProperties: true,
        properties: {
            type: {
                enum: ["feed"],
            },
            id: {
                type: "string",
                format: "iri",
            },
            name: {
                type: "string",
            },
            description: {
                type: "string",
            },
            author: {
                type: "string",
            },
            favicon: {
                type: "string",
            },
        },
    },

    person: {
        required: ["id", "type"],
        additionalProperties: true,
        properties: {
            id: {
                type: "string",
            },
            type: {
                enum: ["person"],
            },
            name: {
                type: "string",
            },
        },
    },

    room: {
        required: ["id", "type"],
        additionalProperties: true,
        properties: {
            id: {
                type: "string",
            },
            type: {
                enum: ["room"],
            },
            name: {
                type: "string",
            },
        },
    },

    service: {
        required: ["id", "type"],
        additionalProperties: true,
        properties: {
            id: {
                type: "string",
            },
            type: {
                enum: ["service"],
            },
            name: {
                type: "string",
            },
        },
    },

    platform: {
        required: ["id", "type"],
        additionalProperties: true,
        properties: {
            id: {
                type: "string",
            },
            type: {
                enum: ["platform"],
            },
            name: {
                type: "string",
            },
        },
    },

    website: {
        required: ["id", "type"],
        additionalProperties: true,
        properties: {
            id: {
                type: "string",
                format: "iri",
            },
            type: {
                enum: ["website"],
            },
            name: {
                type: "string",
            },
        },
    },

    address: {
        required: ["type"],
        additionalProperties: false,
        properties: {
            type: {
                enum: ["address"],
            },
        },
    },
};

// Internal AS object types reserved for Sockethub IPC/housekeeping.
export const InternalObjectTypesList = ["platform", "heartbeat"];
export const ObjectTypesList = Object.keys(ObjectTypesSchema);
export const ActorTypesList = [
    "person",
    "room",
    "service",
    "feed",
    "website",
    "platform",
];
export const TargetTypesList = [
    "person",
    "room",
    "service",
    "feed",
    "website",
    "platform",
    "address",
];
export const validActorRefs = ActorTypesList.map((type) => ({
    $ref: `#/definitions/type/${type}`,
}));
export const validTargetRefs = TargetTypesList.map((type) => ({
    $ref: `#/definitions/type/${type}`,
}));
