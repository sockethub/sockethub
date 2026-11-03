/* biome-ignore-all lint/suspicious/noThenProperty: JSON Schema conditional keywords */
import packageJson from "../package.json" with { type: "json" };

const address = { type: "string", format: "email", maxLength: 254 };
const addresses = {
    type: "array",
    minItems: 1,
    maxItems: 100,
    uniqueItems: true,
    items: address,
};
const folder = {
    type: "string",
    minLength: 1,
    maxLength: 1024,
    pattern: "^[^\\r\\n\\u0000]+$",
};
const cursor = {
    type: "object",
    additionalProperties: false,
    required: ["uidValidity", "uid"],
    properties: {
        uidValidity: { type: "string", pattern: "^[0-9]+$", maxLength: 20 },
        uid: { type: "integer", minimum: 0, maximum: 4294967295 },
    },
};
const filter = {
    from: addresses,
    to: addresses,
    match: { enum: ["any", "all"] },
};
const server = {
    type: "object",
    additionalProperties: false,
    required: ["host", "username"],
    properties: {
        host: {
            type: "string",
            minLength: 1,
            maxLength: 253,
            pattern: "^[^\\s/\\\\]+$",
        },
        port: { type: "integer", minimum: 1, maximum: 65535 },
        secure: { type: "boolean" },
        username: { type: "string", minLength: 1, maxLength: 1024 },
        password: { type: "string", minLength: 1, maxLength: 4096 },
        token: { type: "string", minLength: 1, maxLength: 16384 },
    },
    oneOf: [{ required: ["password"] }, { required: ["token"] }],
};
const input = (properties: object) => ({
    type: "object",
    additionalProperties: false,
    properties: { type: { const: "message" }, ...properties },
});
export const PlatformEmailSchema = {
    name: "email",
    version: packageJson.version,
    contextUrl: "https://sockethub.org/ns/context/platform/email/v1.jsonld",
    contextVersion: "1",
    schemaVersion: "1",
    credentials: {
        required: ["object"],
        properties: {
            object: {
                type: "object",
                additionalProperties: false,
                required: ["type", "from"],
                properties: {
                    type: { const: "credentials" },
                    from: address,
                    imap: server,
                    smtp: server,
                },
                anyOf: [{ required: ["imap"] }, { required: ["smtp"] }],
            },
        },
    },
    messages: {
        required: ["type"],
        properties: {
            type: {
                enum: [
                    "connect",
                    "disconnect",
                    "fetch",
                    "watch",
                    "unwatch",
                    "send",
                ],
            },
            object: { type: "object" },
        },
    },
    messageConstraints: {
        allOf: [
            {
                if: { properties: { type: { const: "fetch" } } },
                then: {
                    properties: {
                        object: input({
                            ...filter,
                            folders: {
                                type: "array",
                                minItems: 1,
                                maxItems: 10,
                                uniqueItems: true,
                                items: folder,
                            },
                            cursors: {
                                type: "object",
                                maxProperties: 10,
                                additionalProperties: cursor,
                            },
                            limit: { type: "integer", minimum: 1, maximum: 50 },
                        }),
                    },
                },
            },
            {
                if: { properties: { type: { const: "watch" } } },
                then: {
                    properties: {
                        object: input({ ...filter, folder, cursor }),
                    },
                },
            },
            {
                if: { properties: { type: { const: "send" } } },
                then: {
                    required: ["object"],
                    properties: {
                        object: {
                            ...input({
                                to: addresses,
                                cc: addresses,
                                bcc: addresses,
                                subject: {
                                    type: "string",
                                    maxLength: 998,
                                    pattern: "^[^\\r\\n]*$",
                                },
                                content: { type: "string", maxLength: 131072 },
                                html: { type: "string", maxLength: 131072 },
                                inReplyTo: {
                                    type: "string",
                                    maxLength: 998,
                                    pattern: "^[^\\r\\n]+$",
                                },
                                references: {
                                    type: "array",
                                    maxItems: 50,
                                    items: {
                                        type: "string",
                                        maxLength: 998,
                                        pattern: "^[^\\r\\n]+$",
                                    },
                                },
                            }),
                            required: ["to"],
                            anyOf: [
                                { required: ["content"] },
                                { required: ["html"] },
                            ],
                        },
                    },
                },
            },
        ],
    },
    responses: {
        type: "object",
        required: ["type"],
        properties: {
            type: {
                enum: [
                    "connect",
                    "disconnect",
                    "watch",
                    "unwatch",
                    "send",
                    "post",
                    "collection",
                ],
            },
            actor: { type: "object", required: ["id", "type"] },
            object: { type: "object" },
            items: {
                type: "array",
                maxItems: 50,
                items: {
                    type: "object",
                    required: ["type", "actor", "object"],
                },
            },
            cursors: { type: "object", additionalProperties: cursor },
            hasMore: { type: "boolean" },
            error: { type: "string" },
        },
    },
};
