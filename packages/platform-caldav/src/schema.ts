import packageJson from "../package.json" with { type: "json" };

const actor = {
    type: "object",
    required: ["id", "type"],
    additionalProperties: false,
    properties: {
        id: { type: "string", minLength: 1, maxLength: 1024 },
        type: { enum: ["person"] },
    },
};
const target = {
    type: "object",
    required: ["id", "type"],
    additionalProperties: false,
    properties: {
        id: { type: "string", format: "uri", maxLength: 4096 },
        type: { enum: ["calendar"] },
    },
};
const person = {
    type: "object",
    required: ["email"],
    additionalProperties: false,
    properties: {
        email: { type: "string", format: "email", maxLength: 1024 },
        name: { type: "string", maxLength: 1024 },
        role: { enum: ["chair", "required", "optional", "non-participant"] },
        status: {
            enum: [
                "needs-action",
                "accepted",
                "declined",
                "tentative",
                "delegated",
            ],
        },
        rsvp: { type: "boolean" },
    },
};
const recurrence = {
    type: "object",
    required: ["frequency"],
    additionalProperties: false,
    properties: {
        frequency: { enum: ["daily", "weekly", "monthly", "yearly"] },
        interval: { type: "integer", minimum: 1, maximum: 999 },
        count: { type: "integer", minimum: 1, maximum: 99999 },
        until: { type: "string", format: "date-time" },
        byDay: {
            type: "array",
            uniqueItems: true,
            maxItems: 31,
            items: {
                type: "string",
                pattern: "^(?:[+-]?[1-5])?(?:MO|TU|WE|TH|FR|SA|SU)$",
            },
        },
        byMonthDay: {
            type: "array",
            uniqueItems: true,
            maxItems: 62,
            items: {
                type: "integer",
                minimum: -31,
                maximum: 31,
                not: { const: 0 },
            },
        },
    },
    not: { required: ["count", "until"] },
};
const reminder = {
    type: "object",
    required: ["trigger"],
    additionalProperties: false,
    properties: {
        trigger: { type: "string", minLength: 2, maxLength: 64 },
        action: { enum: ["display", "email"] },
        description: { type: "string", maxLength: 4096 },
        recipients: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: { type: "string", format: "email" },
        },
    },
};
const attachment = {
    type: "object",
    additionalProperties: false,
    properties: {
        url: { type: "string", format: "uri", maxLength: 4096 },
        data: { type: "string", maxLength: 1048576 },
        mediaType: { type: "string", maxLength: 255 },
        filename: { type: "string", maxLength: 1024 },
    },
    oneOf: [{ required: ["url"] }, { required: ["data"] }],
};
const shared = {
    id: { type: "string", format: "uri", maxLength: 4096 },
    etag: { type: "string", minLength: 1, maxLength: 1024 },
    uid: { type: "string", minLength: 1, maxLength: 255 },
    sequence: { type: "integer", minimum: 0, maximum: 2147483647 },
    name: { type: "string", minLength: 1, maxLength: 4096 },
    content: { type: "string", maxLength: 65536 },
    location: { type: "string", maxLength: 4096 },
    url: { type: "string", format: "uri", maxLength: 4096 },
    timeZone: { type: "string", minLength: 1, maxLength: 255 },
    recurrence,
    organizer: person,
    attendees: { type: "array", maxItems: 1000, items: person },
    reminders: { type: "array", maxItems: 100, items: reminder },
    attachments: { type: "array", maxItems: 100, items: attachment },
};
const eventObject = {
    type: "object",
    required: ["type", "name", "startTime"],
    additionalProperties: false,
    properties: {
        ...shared,
        type: { enum: ["event"] },
        startTime: { type: "string", minLength: 10, maxLength: 64 },
        endTime: { type: "string", minLength: 10, maxLength: 64 },
        allDay: { type: "boolean", default: false },
    },
};
const taskObject = {
    type: "object",
    required: ["type", "name"],
    additionalProperties: false,
    properties: {
        ...shared,
        type: { enum: ["task"] },
        startTime: { type: "string", minLength: 10, maxLength: 64 },
        due: { type: "string", minLength: 10, maxLength: 64 },
        allDay: { type: "boolean", default: false },
        status: {
            enum: ["needs-action", "in-process", "completed", "cancelled"],
        },
        completedTime: { type: "string", format: "date-time" },
        percentComplete: { type: "integer", minimum: 0, maximum: 100 },
    },
    allOf: [
        {
            if: {
                properties: { status: { const: "completed" } },
                required: ["status"],
            },
            // biome-ignore lint/suspicious/noThenProperty: JSON Schema conditional keyword
            then: { required: ["completedTime"] },
        },
        {
            if: { required: ["completedTime"] },
            // biome-ignore lint/suspicious/noThenProperty: JSON Schema conditional keyword
            then: {
                properties: { status: { const: "completed" } },
                required: ["status"],
            },
        },
    ],
};
const deleteObject = {
    type: "object",
    required: ["id", "type", "etag"],
    additionalProperties: false,
    properties: {
        id: shared.id,
        type: { enum: ["event", "task"] },
        etag: shared.etag,
    },
};
const queryObject = {
    type: "object",
    additionalProperties: false,
    properties: {
        type: { enum: ["event", "task"] },
        startTime: { type: "string", format: "date-time" },
        endTime: { type: "string", format: "date-time" },
    },
};
const calendarItem = { oneOf: [eventObject, taskObject] };
const mutationObject = {
    type: "object",
    required: ["id", "type"],
    additionalProperties: false,
    properties: {
        id: shared.id,
        type: { enum: ["event", "task"] },
        uid: shared.uid,
        etag: shared.etag,
    },
};

export const PlatformCalDavSchema = {
    name: "caldav",
    version: packageJson.version,
    contextUrl: "https://sockethub.org/ns/context/platform/caldav/v1.jsonld",
    contextVersion: "1",
    schemaVersion: "1",
    messages: {
        required: ["type", "actor"],
        properties: {
            type: {
                type: "string",
                enum: ["fetch", "query", "create", "update", "delete"],
            },
            actor,
            target,
            object: {
                oneOf: [eventObject, taskObject, deleteObject, queryObject],
            },
        },
    },
    messageConstraints: {
        oneOf: [
            {
                properties: { type: { const: "fetch" } },
                required: ["type", "actor"],
                not: {
                    anyOf: [{ required: ["target"] }, { required: ["object"] }],
                },
            },
            {
                properties: { type: { const: "query" }, object: queryObject },
                required: ["type", "actor", "target"],
            },
            {
                properties: { type: { const: "create" }, object: calendarItem },
                required: ["type", "actor", "target", "object"],
            },
            {
                properties: {
                    type: { const: "update" },
                    object: {
                        oneOf: [
                            {
                                ...eventObject,
                                required: [
                                    ...eventObject.required,
                                    "id",
                                    "etag",
                                    "uid",
                                ],
                            },
                            {
                                ...taskObject,
                                required: [
                                    ...taskObject.required,
                                    "id",
                                    "etag",
                                    "uid",
                                ],
                            },
                        ],
                    },
                },
                required: ["type", "actor", "target", "object"],
            },
            {
                properties: { type: { const: "delete" }, object: deleteObject },
                required: ["type", "actor", "target", "object"],
            },
        ],
    },
    credentials: {
        required: ["object"],
        properties: {
            object: {
                oneOf: [
                    {
                        type: "object",
                        required: ["type", "url", "username", "password"],
                        additionalProperties: false,
                        properties: {
                            type: { enum: ["credentials"] },
                            url: {
                                type: "string",
                                format: "uri",
                                pattern: "^https://",
                                maxLength: 4096,
                            },
                            username: {
                                type: "string",
                                minLength: 1,
                                maxLength: 1024,
                            },
                            password: {
                                type: "string",
                                minLength: 1,
                                maxLength: 4096,
                            },
                        },
                    },
                    {
                        type: "object",
                        required: ["type", "url", "token"],
                        additionalProperties: false,
                        properties: {
                            type: { enum: ["credentials"] },
                            url: {
                                type: "string",
                                format: "uri",
                                pattern: "^https://",
                                maxLength: 4096,
                            },
                            token: {
                                type: "string",
                                minLength: 1,
                                maxLength: 8192,
                            },
                        },
                    },
                ],
            },
        },
    },
    responses: {
        oneOf: [
            {
                type: "object",
                required: ["@context", "type", "totalItems", "items"],
                additionalProperties: false,
                properties: {
                    "@context": { type: "array", items: { type: "string" } },
                    id: { type: ["string", "null"] },
                    type: { const: "collection" },
                    summary: { type: "string" },
                    totalItems: { type: "integer", minimum: 0 },
                    items: {
                        type: "array",
                        items: {
                            oneOf: [
                                calendarItem,
                                {
                                    type: "object",
                                    required: [
                                        "id",
                                        "type",
                                        "name",
                                        "components",
                                    ],
                                    additionalProperties: false,
                                    properties: {
                                        id: shared.id,
                                        type: { const: "calendar" },
                                        name: { type: "string" },
                                        color: {
                                            type: "string",
                                            maxLength: 64,
                                        },
                                        components: {
                                            type: "array",
                                            uniqueItems: true,
                                            items: { enum: ["event", "task"] },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                },
            },
            {
                type: "object",
                required: ["@context", "type", "actor", "target", "object"],
                additionalProperties: false,
                properties: {
                    "@context": { type: "array", items: { type: "string" } },
                    id: { type: "string" },
                    type: { enum: ["create", "update", "delete"] },
                    actor,
                    target,
                    object: mutationObject,
                },
            },
        ],
    },
};
