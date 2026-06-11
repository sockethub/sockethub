import packageJson from "../package.json" with { type: "json" };

const version = packageJson.version;

export const PlatformIrcSchema = {
    name: "irc",
    version: version,
    contextUrl: "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
    contextVersion: "1",
    schemaVersion: "1",
    messages: {
        required: ["type"],
        properties: {
            type: {
                enum: [
                    "connect",
                    "update",
                    "join",
                    "leave",
                    "send",
                    "query",
                    "announce",
                    "disconnect",
                ],
            },
            // Inbound object shapes the client may send (when present). Owned by
            // this platform now that the base envelope no longer enumerates a
            // global object vocabulary.
            object: {
                oneOf: [
                    { $ref: "#/definitions/objectTypes/message" },
                    { $ref: "#/definitions/objectTypes/topic" },
                    { $ref: "#/definitions/objectTypes/address" },
                    { $ref: "#/definitions/objectTypes/attendance" },
                ],
            },
            // Room targets must be server-qualified as `server/#channel`,
            // consistent with what the platform emits inbound (see irc2as).
            // A bare `#channel` is rejected. Non-room targets (e.g. person
            // PMs / nick-change) are left unconstrained here.
            target: {
                type: "object",
                if: {
                    required: ["type"],
                    properties: { type: { const: "room" } },
                },
                // biome-ignore lint/suspicious/noThenProperty: JSON Schema `then` conditional keyword, not a thenable
                then: {
                    required: ["id"],
                    properties: {
                        id: { type: "string", pattern: "^[^/]+/.+$" },
                    },
                },
            },
        },
        definitions: {
            objectTypes: {
                message: {
                    type: "object",
                    required: ["type", "content"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["message"] },
                        content: { type: "string" },
                    },
                },
                topic: {
                    type: "object",
                    required: ["type", "content"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["topic"] },
                        content: { type: "string" },
                    },
                },
                address: {
                    type: "object",
                    required: ["type"],
                    additionalProperties: false,
                    properties: { type: { enum: ["address"] } },
                },
                attendance: {
                    type: "object",
                    required: ["type"],
                    additionalProperties: false,
                    properties: { type: { enum: ["attendance"] } },
                },
            },
        },
    },
    // Outbound (platform -> client) via the irc2as translator. Strict: every
    // message type, object type, and field is enumerated. Validated against the
    // canonical irc2as output fixtures.
    responses: {
        type: "object",
        required: ["type", "actor"],
        additionalProperties: false,
        properties: {
            "@context": { type: "array", items: { type: "string" } },
            id: { type: "string" },
            published: { type: "string" },
            type: {
                enum: ["update", "send", "join", "leave", "add", "remove"],
            },
            actor: {
                oneOf: [
                    { $ref: "#/definitions/responses/person" },
                    { $ref: "#/definitions/responses/service" },
                ],
            },
            target: {
                oneOf: [
                    { $ref: "#/definitions/responses/person" },
                    { $ref: "#/definitions/responses/room" },
                    { $ref: "#/definitions/responses/service" },
                ],
            },
            error: { type: "string" },
            object: {
                oneOf: [
                    { $ref: "#/definitions/responses/message" },
                    { $ref: "#/definitions/responses/me" },
                    { $ref: "#/definitions/responses/presence" },
                    { $ref: "#/definitions/responses/topic" },
                    { $ref: "#/definitions/responses/address" },
                    { $ref: "#/definitions/responses/relationship" },
                ],
            },
        },
        definitions: {
            responses: {
                person: {
                    type: "object",
                    required: ["id", "type"],
                    additionalProperties: false,
                    properties: {
                        id: { type: "string" },
                        type: { enum: ["person"] },
                        name: { type: "string" },
                    },
                },
                service: {
                    type: "object",
                    required: ["id", "type"],
                    additionalProperties: false,
                    properties: {
                        id: { type: "string" },
                        type: { enum: ["service"] },
                        name: { type: "string" },
                    },
                },
                room: {
                    type: "object",
                    required: ["id", "type"],
                    additionalProperties: false,
                    properties: {
                        // Server-qualified room id: `server/#channel`.
                        id: { type: "string", pattern: "^[^/]+/.+$" },
                        type: { enum: ["room"] },
                        name: { type: "string" },
                    },
                },
                message: {
                    type: "object",
                    required: ["type", "content"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["message"] },
                        content: { type: "string" },
                    },
                },
                me: {
                    type: "object",
                    required: ["type", "content"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["me"] },
                        content: { type: "string" },
                    },
                },
                presence: {
                    type: "object",
                    required: ["type"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["presence"] },
                        role: {
                            enum: ["owner", "member", "participant", "admin"],
                        },
                    },
                },
                topic: {
                    type: "object",
                    required: ["type", "content"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["topic"] },
                        content: { type: "string" },
                    },
                },
                address: {
                    type: "object",
                    required: ["type"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["address"] },
                    },
                },
                relationship: {
                    type: "object",
                    required: ["type", "relationship"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["relationship"] },
                        relationship: { enum: ["role"] },
                        subject: {
                            type: "object",
                            required: ["type", "role"],
                            additionalProperties: false,
                            properties: {
                                type: { enum: ["presence"] },
                                role: {
                                    enum: [
                                        "owner",
                                        "member",
                                        "participant",
                                        "admin",
                                    ],
                                },
                            },
                        },
                        object: { $ref: "#/definitions/responses/room" },
                    },
                },
            },
        },
    },
    credentials: {
        required: ["object"],
        properties: {
            // TODO platforms shouldn't have to define the actor property
            //  if they don't want to, just credential specifics
            actor: {
                type: "object",
                required: ["id"],
            },
            object: {
                type: "object",
                required: ["type", "nick", "server"],
                additionalProperties: false,
                // password and token are mutually exclusive
                not: { required: ["password", "token"] },
                // When saslMechanism is set, the matching secret must be
                // present: PLAIN requires password or token, OAUTHBEARER
                // requires token. Bare saslMechanism without a secret is
                // rejected. Expressed as allOf with negated implications
                // to avoid if/then (which trips the biome noThenProperty
                // rule).
                allOf: [
                    {
                        // PLAIN → password or token required
                        anyOf: [
                            {
                                not: {
                                    properties: {
                                        saslMechanism: { const: "PLAIN" },
                                    },
                                    required: ["saslMechanism"],
                                },
                            },
                            { required: ["password"] },
                            { required: ["token"] },
                        ],
                    },
                    {
                        // OAUTHBEARER → token required
                        anyOf: [
                            {
                                not: {
                                    properties: {
                                        saslMechanism: {
                                            const: "OAUTHBEARER",
                                        },
                                    },
                                    required: ["saslMechanism"],
                                },
                            },
                            { required: ["token"] },
                        ],
                    },
                ],
                properties: {
                    type: {
                        type: "string",
                    },
                    nick: {
                        type: "string",
                    },
                    username: {
                        type: "string",
                    },
                    password: {
                        type: "string",
                        minLength: 1,
                    },
                    token: {
                        type: "string",
                        minLength: 1,
                    },
                    server: {
                        type: "string",
                    },
                    port: {
                        type: "number",
                    },
                    secure: {
                        type: "boolean",
                    },
                    sasl: {
                        type: "boolean",
                    },
                    saslMechanism: {
                        type: "string",
                        enum: ["PLAIN", "OAUTHBEARER"],
                    },
                },
            },
        },
    },
};
