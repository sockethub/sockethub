import packageJson from "../package.json" with { type: "json" };

// actor: WhatsApp Business phone number ID (Meta-assigned, numeric).
const actor = {
    type: "object",
    required: ["id", "type"],
    additionalProperties: false,
    properties: {
        id: { type: "string", pattern: "^[0-9]+$", maxLength: 128 },
        type: { const: "person" },
    },
};

// target: recipient phone number in international format (E.164 digits).
const target = {
    type: "object",
    required: ["id", "type"],
    additionalProperties: false,
    properties: {
        id: { type: "string", pattern: "^\\+?[1-9][0-9]{6,14}$" },
        type: { const: "person" },
    },
};

export const PlatformWhatsAppSchema = {
    name: "whatsapp",
    version: packageJson.version,
    contextUrl: "https://sockethub.org/ns/context/platform/whatsapp/v1.jsonld",
    contextVersion: "1",
    schemaVersion: "1",
    messages: {
        required: ["type", "actor", "target", "object"],
        properties: {
            type: { enum: ["send"] },
            actor,
            target,
            object: {
                type: "object",
                required: ["type", "content"],
                additionalProperties: false,
                properties: {
                    type: { const: "message" },
                    content: { type: "string", minLength: 1, maxLength: 4096 },
                },
            },
        },
    },
    credentials: {
        required: ["object"],
        properties: {
            object: {
                type: "object",
                required: ["type", "token", "apiVersion"],
                additionalProperties: false,
                properties: {
                    type: { const: "credentials" },
                    token: {
                        type: "string",
                        minLength: 1,
                        maxLength: 8192,
                        pattern: "^[^\\r\\n]+$",
                    },
                    apiVersion: {
                        type: "string",
                        pattern: "^v[0-9]{1,3}\\.[0-9]{1,2}$",
                    },
                },
            },
        },
    },
    responses: {
        type: "object",
        required: ["@context", "type", "actor", "target", "object"],
        properties: {
            "@context": { type: "array", items: { type: "string" } },
            type: { const: "send" },
            actor,
            target,
            object: {
                type: "object",
                required: ["type", "id", "content"],
                properties: {
                    type: { const: "message" },
                    id: { type: "string", minLength: 1 },
                    content: { type: "string" },
                },
            },
        },
    },
};
