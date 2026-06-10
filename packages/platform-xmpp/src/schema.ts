import type { PlatformSchemaStruct } from "@sockethub/schemas";
import PackageJSON from "../package.json" with { type: "json" };

export const PlatformSchema: PlatformSchemaStruct = {
    name: "xmpp",
    version: PackageJSON.version,
    contextUrl: "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld",
    contextVersion: "1",
    schemaVersion: "1",
    messages: {
        required: ["type"],
        properties: {
            type: {
                enum: [
                    "connect",
                    "join",
                    "leave",
                    "send",
                    "update",
                    "request-friend",
                    "remove-friend",
                    "make-friend",
                    "query",
                    "disconnect",
                ],
            },
        },
    },
    // Outbound (platform -> client). Strict: every message type, object type,
    // and field the platform emits is enumerated. Validated against the
    // incoming-handlers test fixtures.
    responses: {
        type: "object",
        required: ["type", "actor"],
        additionalProperties: false,
        properties: {
            "@context": { type: "array", items: { type: "string" } },
            id: { type: "string" },
            type: {
                enum: [
                    "connect",
                    "close",
                    "error",
                    "update",
                    "send",
                    "query",
                    "request-friend",
                    "join",
                    "leave",
                ],
            },
            actor: { $ref: "#/definitions/responses/jid" },
            target: { $ref: "#/definitions/responses/jid" },
            error: { type: "string" },
            published: { type: "string" },
            object: {
                oneOf: [
                    { $ref: "#/definitions/responses/message" },
                    { $ref: "#/definitions/responses/presence" },
                    { $ref: "#/definitions/responses/attendance" },
                    { $ref: "#/definitions/responses/roomInfo" },
                    { $ref: "#/definitions/responses/connect" },
                ],
            },
        },
        definitions: {
            responses: {
                jid: {
                    type: "object",
                    required: ["id", "type"],
                    additionalProperties: false,
                    properties: {
                        id: { type: "string" },
                        type: { enum: ["person", "room"] },
                        name: { type: "string" },
                    },
                },
                message: {
                    type: "object",
                    required: ["type"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["message"] },
                        id: { type: "string" },
                        content: { type: "string" },
                        "xmpp:stanza-id": { type: "string" },
                        "xmpp:replace": {
                            type: "object",
                            required: ["id"],
                            additionalProperties: false,
                            properties: { id: { type: "string" } },
                        },
                    },
                },
                presence: {
                    type: "object",
                    required: ["type"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["presence"] },
                        presence: {
                            enum: [
                                "away",
                                "chat",
                                "dnd",
                                "xa",
                                "offline",
                                "online",
                                "notauthorized",
                            ],
                        },
                        content: { type: "string" },
                    },
                },
                attendance: {
                    type: "object",
                    required: ["type"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["attendance"] },
                        members: { type: "array", items: { type: "string" } },
                    },
                },
                connect: {
                    type: "object",
                    required: ["type"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["connect"] },
                        status: { type: "string" },
                        condition: { type: "string" },
                    },
                },
                roomInfoField: {
                    type: "object",
                    required: ["type", "value"],
                    additionalProperties: false,
                    properties: {
                        type: { type: "string" },
                        label: { type: "string" },
                        value: {
                            oneOf: [
                                { type: "string" },
                                { type: "number" },
                                { type: "boolean" },
                                { type: "null" },
                                { type: "array", items: { type: "string" } },
                            ],
                        },
                        options: {
                            type: "array",
                            items: {
                                type: "object",
                                required: ["label", "value"],
                                additionalProperties: false,
                                properties: {
                                    label: { type: "string" },
                                    value: { type: "string" },
                                },
                            },
                        },
                    },
                },
                roomInfo: {
                    type: "object",
                    required: ["type"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["room-info"] },
                        features: { type: "array", items: { type: "string" } },
                        identities: {
                            type: "array",
                            items: {
                                type: "object",
                                required: ["category", "type"],
                                additionalProperties: false,
                                properties: {
                                    category: { type: "string" },
                                    type: { type: "string" },
                                    name: { type: "string" },
                                },
                            },
                        },
                        roominfo: {
                            type: "object",
                            additionalProperties: {
                                $ref: "#/definitions/responses/roomInfoField",
                            },
                        },
                        roomconfig: {
                            type: "object",
                            additionalProperties: {
                                $ref: "#/definitions/responses/roomInfoField",
                            },
                        },
                        custom: {
                            type: "object",
                            additionalProperties: {
                                $ref: "#/definitions/responses/roomInfoField",
                            },
                        },
                    },
                },
            },
        },
    },
    credentials: {
        required: ["object"],
        properties: {
            // TODO platforms shouldn't have to define the actor property if
            //  they don't want to, just credential specifics
            actor: {
                type: "object",
                required: ["id"],
            },
            object: {
                type: "object",
                required: ["type", "userAddress", "resource", "password"],
                additionalProperties: false,
                properties: {
                    type: {
                        type: "string",
                    },
                    userAddress: {
                        type: "string",
                    },
                    password: {
                        type: "string",
                    },
                    server: {
                        type: "string",
                    },
                    port: {
                        type: "number",
                    },
                    resource: {
                        type: "string",
                    },
                },
            },
        },
    },
};
