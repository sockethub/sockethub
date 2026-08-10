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
        type: { enum: ["addressBook"] },
    },
};
const typedValue = {
    type: "object",
    required: ["value"],
    additionalProperties: false,
    properties: {
        value: { type: "string", minLength: 1, maxLength: 4096 },
        types: {
            type: "array",
            uniqueItems: true,
            maxItems: 32,
            items: {
                type: "string",
                minLength: 1,
                maxLength: 64,
                pattern: "^[A-Za-z0-9-]+$",
            },
        },
        preferred: { type: "boolean" },
    },
};
const address = {
    type: "object",
    additionalProperties: false,
    properties: {
        types: typedValue.properties.types,
        preferred: { type: "boolean" },
        postOfficeBox: { type: "string", maxLength: 1024 },
        extendedAddress: { type: "string", maxLength: 1024 },
        street: { type: "string", maxLength: 4096 },
        locality: { type: "string", maxLength: 1024 },
        region: { type: "string", maxLength: 1024 },
        postalCode: { type: "string", maxLength: 256 },
        country: { type: "string", maxLength: 1024 },
    },
};
const shared = {
    id: { type: "string", format: "uri", maxLength: 4096 },
    etag: { type: "string", minLength: 1, maxLength: 1024 },
    uid: { type: "string", minLength: 1, maxLength: 255 },
    type: { const: "person" },
    name: { type: "string", minLength: 1, maxLength: 4096 },
    givenName: { type: "string", maxLength: 1024 },
    additionalNames: {
        type: "array",
        maxItems: 32,
        items: { type: "string", maxLength: 1024 },
    },
    familyName: { type: "string", maxLength: 1024 },
    honorificPrefixes: {
        type: "array",
        maxItems: 16,
        items: { type: "string", maxLength: 256 },
    },
    honorificSuffixes: {
        type: "array",
        maxItems: 16,
        items: { type: "string", maxLength: 256 },
    },
    nickname: { type: "string", maxLength: 1024 },
    emails: { type: "array", maxItems: 100, items: typedValue },
    telephones: { type: "array", maxItems: 100, items: typedValue },
    addresses: { type: "array", maxItems: 100, items: address },
    organization: { type: "string", maxLength: 4096 },
    title: { type: "string", maxLength: 1024 },
    role: { type: "string", maxLength: 1024 },
    urls: { type: "array", maxItems: 100, items: typedValue },
    photoUrls: {
        type: "array",
        maxItems: 16,
        items: {
            type: "string",
            format: "uri",
            pattern: "^https?://[^\\r\\n]+$",
            maxLength: 4096,
        },
    },
    note: { type: "string", maxLength: 65536 },
    birthday: {
        type: "string",
        minLength: 4,
        maxLength: 32,
        pattern: "^[^\\r\\n]+$",
    },
    vcardVersion: { enum: ["3.0", "4.0"] },
    updateSupported: { type: "boolean" },
};
const contact = {
    type: "object",
    required: ["type", "name"],
    additionalProperties: false,
    properties: shared,
};
const query = {
    type: "object",
    additionalProperties: false,
    properties: {
        type: { const: "contactQuery" },
        text: { type: "string", minLength: 1, maxLength: 1024 },
        fields: {
            type: "array",
            uniqueItems: true,
            maxItems: 4,
            items: { enum: ["name", "email", "telephone", "organization"] },
        },
        limit: { type: "integer", minimum: 1, maximum: 1000 },
    },
};
const deletion = {
    type: "object",
    required: ["id", "type", "etag"],
    additionalProperties: false,
    properties: { id: shared.id, type: shared.type, etag: shared.etag },
};
const updateContact = {
    ...contact,
    required: ["type", "name", "id", "uid", "etag"],
};
const responseContact = {
    ...contact,
    required: ["id", "type", "uid", "name", "vcardVersion", "updateSupported"],
};
const mutation = {
    type: "object",
    required: ["id", "type"],
    additionalProperties: false,
    properties: {
        id: shared.id,
        type: shared.type,
        uid: shared.uid,
        etag: shared.etag,
    },
};
const credentialsObject = {
    oneOf: [
        {
            type: "object",
            required: ["type", "url", "username", "password"],
            additionalProperties: false,
            properties: {
                type: { const: "credentials" },
                url: {
                    type: "string",
                    format: "uri",
                    pattern: "^https?://",
                    maxLength: 4096,
                },
                username: { type: "string", minLength: 1, maxLength: 1024 },
                password: { type: "string", minLength: 1, maxLength: 4096 },
            },
        },
        {
            type: "object",
            required: ["type", "url", "token"],
            additionalProperties: false,
            properties: {
                type: { const: "credentials" },
                url: {
                    type: "string",
                    format: "uri",
                    pattern: "^https?://",
                    maxLength: 4096,
                },
                token: { type: "string", minLength: 1, maxLength: 8192 },
            },
        },
    ],
};

export const PlatformCardDavSchema = {
    name: "carddav",
    version: packageJson.version,
    contextUrl: "https://sockethub.org/ns/context/platform/carddav/v1.jsonld",
    contextVersion: "1",
    schemaVersion: "1",
    messages: {
        required: ["type", "actor"],
        properties: {
            type: { enum: ["fetch", "query", "create", "update", "delete"] },
            actor,
            target,
            object: { oneOf: [contact, query, deletion] },
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
                properties: { type: { const: "query" }, object: query },
                required: ["type", "actor", "target"],
            },
            {
                properties: { type: { const: "create" }, object: contact },
                required: ["type", "actor", "target", "object"],
            },
            {
                properties: {
                    type: { const: "update" },
                    object: updateContact,
                },
                required: ["type", "actor", "target", "object"],
            },
            {
                properties: { type: { const: "delete" }, object: deletion },
                required: ["type", "actor", "target", "object"],
            },
        ],
    },
    credentials: {
        required: ["object"],
        properties: { object: credentialsObject },
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
                                responseContact,
                                {
                                    type: "object",
                                    required: ["id", "type", "name"],
                                    additionalProperties: false,
                                    properties: {
                                        id: shared.id,
                                        type: { const: "addressBook" },
                                        name: { type: "string" },
                                        description: { type: "string" },
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
                    object: mutation,
                },
            },
        ],
    },
};
