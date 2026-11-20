import packageJson from "../package.json" with { type: "json" };

/** Push services accept at most 4096 bytes; that is 5464 base64 characters. */
export const MAX_CONTENT_BYTES = 4096;
/** The longest a push service will hold a message for an offline device. */
export const MAX_TTL_SECONDS = 2419200;
/** Used when a message does not set `ttl`. */
export const DEFAULT_TTL_SECONDS = 86400;

// The app that is sending. It must not identify a user: Sockethub also
// carries chat traffic, and an address here would tie a device to it.
const actor = {
    type: "object",
    required: ["id", "type"],
    additionalProperties: false,
    properties: {
        id: { type: "string", minLength: 1, maxLength: 1024 },
        type: { enum: ["website", "service"] },
        name: { type: "string", maxLength: 256 },
    },
};
// The subscription's delivery URL on the browser vendor's push service.
const target = {
    type: "object",
    required: ["id", "type"],
    additionalProperties: false,
    properties: {
        id: {
            type: "string",
            format: "uri",
            pattern: "^https?://",
            maxLength: 2048,
        },
        type: { const: "service" },
    },
};
// One message, already encrypted by the app for its own subscription
// (RFC 8291, `aes128gcm`). Sockethub cannot read it.
const push = {
    content: {
        type: "string",
        minLength: 1,
        maxLength: 5464,
        pattern: "^[A-Za-z0-9+/_-]+={0,2}$",
    },
    ttl: { type: "integer", minimum: 0, maximum: MAX_TTL_SECONDS },
    urgency: { enum: ["very-low", "low", "normal", "high"] },
    topic: { type: "string", pattern: "^[A-Za-z0-9_-]{1,32}$" },
};
const sendObject = {
    type: "object",
    required: ["type", "content"],
    additionalProperties: false,
    properties: { type: { const: "push" }, ...push },
};
// The complete list of future messages for one subscription. It replaces
// any earlier list, and an empty list cancels.
const scheduleObject = {
    type: "object",
    required: ["type", "items"],
    additionalProperties: false,
    properties: {
        type: { const: "schedule" },
        items: {
            type: "array",
            maxItems: 1000,
            items: {
                type: "object",
                required: ["deliverAt", "content"],
                additionalProperties: false,
                properties: {
                    deliverAt: { type: "string", format: "date-time" },
                    ...push,
                },
            },
        },
    },
};

const responseActor = {
    type: "object",
    required: ["id", "type"],
    additionalProperties: true,
    properties: { id: { type: "string" }, type: { type: "string" } },
};

export const PlatformWebPushSchema = {
    name: "webpush",
    version: packageJson.version,
    contextUrl: "https://sockethub.org/ns/context/platform/webpush/v1.jsonld",
    contextVersion: "1",
    schemaVersion: "1",
    messages: {
        required: ["type", "actor", "target", "object"],
        properties: {
            type: { type: "string", enum: ["send", "schedule"] },
            actor,
            target,
        },
        oneOf: [
            { properties: { type: { const: "send" }, object: sendObject } },
            {
                properties: {
                    type: { const: "schedule" },
                    object: scheduleObject,
                },
            },
        ],
    },
    // Outbound (platform -> client). The delivery URL and the message are
    // never echoed back: results can be cached for replay, and the URL is the
    // only thing that authorizes a schedule change.
    responses: {
        type: "object",
        required: ["type", "actor", "object"],
        additionalProperties: false,
        properties: {
            "@context": { type: "array", items: { type: "string" } },
            id: { type: "string" },
            type: { enum: ["send", "schedule"] },
            actor: responseActor,
            object: {
                oneOf: [
                    {
                        type: "object",
                        required: ["type", "status"],
                        additionalProperties: false,
                        properties: {
                            type: { const: "delivery" },
                            // accepted: the push service took the message.
                            // gone: the subscription no longer exists.
                            // retry: a temporary failure; try again later.
                            // rejected: this request can never succeed.
                            status: {
                                enum: ["accepted", "gone", "retry", "rejected"],
                            },
                            httpStatus: { type: "integer" },
                            // Seconds the push service asked us to wait.
                            retryAfter: { type: "integer", minimum: 0 },
                            detail: { type: "string" },
                        },
                    },
                    {
                        type: "object",
                        required: ["type", "pending"],
                        additionalProperties: false,
                        properties: {
                            type: { const: "schedule" },
                            pending: { type: "integer", minimum: 0 },
                        },
                    },
                ],
            },
        },
    },
};
