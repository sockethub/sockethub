export const SockethubConfigSchema = {
    $id: "https://sockethub.org/schemas/v/sockethub-config.json",
    description: "Sockethub Config Schema",
    type: "object",
    required: ["platforms"],
    additionalProperties: false,
    properties: {
        $schema: {
            type: "string",
        },
        examples: {
            type: "boolean",
            default: true,
        },
        info: {
            type: "boolean",
            default: false,
        },
        logging: {
            type: "object",
            additionalProperties: false,
            properties: {
                level: {
                    type: "string",
                    enum: ["error", "warn", "info", "debug"],
                    default: "info",
                },
                fileLevel: {
                    type: "string",
                    enum: ["error", "warn", "info", "debug"],
                    default: "debug",
                },
                file: {
                    type: "string",
                    default: "sockethub.log",
                },
            },
        },
        platforms: {
            type: "array",
            items: {
                type: "string",
            },
            default: [
                "@sockethub/platform-dummy",
                "@sockethub/platform-feeds",
                "@sockethub/platform-irc",
                "@sockethub/platform-metadata",
                "@sockethub/platform-xmpp",
            ],
        },
        // Per-platform config, keyed by package name. Each platform's entry is
        // validated against its declared keys; entries for platforms without a
        // declared shape here are passed through unvalidated.
        packageConfig: {
            type: "object",
            properties: {
                "@sockethub/platform-dummy": {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        greeting: { type: "string", default: "Hello" },
                    },
                },
                "@sockethub/platform-feeds": {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        connectTimeoutMs: { type: "number" },
                        allowPrivateAddresses: { type: "boolean" },
                        concurrency: { type: "number", minimum: 1 },
                    },
                },
                "@sockethub/platform-irc": {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        connectTimeoutMs: { type: "number" },
                    },
                },
                "@sockethub/platform-xmpp": {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        connectTimeoutMs: { type: "number" },
                    },
                },
                "@sockethub/platform-metadata": {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        allowPrivateAddresses: { type: "boolean" },
                        concurrency: { type: "number", minimum: 1 },
                    },
                },
            },
        },
        credentialCheck: {
            type: "object",
            additionalProperties: false,
            properties: {
                reconnectIpSource: {
                    type: "string",
                    enum: ["socket", "proxy"],
                    default: "socket",
                },
                proxyHeader: {
                    type: "string",
                    default: "x-forwarded-for",
                },
            },
        },
        public: {
            type: "object",
            additionalProperties: false,
            properties: {
                protocol: {
                    type: "string",
                    default: "http",
                },
                host: {
                    type: "string",
                    default: "localhost",
                },
                port: {
                    type: "number",
                    default: 10550,
                },
                path: {
                    type: "string",
                    default: "/",
                },
            },
        },
        rateLimiter: {
            type: "object",
            additionalProperties: false,
            properties: {
                windowMs: {
                    type: "number",
                    default: 1000,
                },
                maxRequests: {
                    type: "number",
                    default: 100,
                },
                blockDurationMs: {
                    type: "number",
                    default: 5000,
                },
            },
        },
        redis: {
            type: "object",
            additionalProperties: false,
            properties: {
                url: {
                    type: "string",
                    default: "redis://127.0.0.1:6379",
                },
                connectTimeout: {
                    type: "number",
                    default: 10000,
                    description: "Connection timeout in milliseconds",
                },
                disconnectTimeout: {
                    type: "number",
                    default: 5000,
                    description: "Disconnect timeout in milliseconds",
                },
                maxRetriesPerRequest: {
                    type: ["number", "null"],
                    default: null as number | null,
                    description:
                        "Maximum number of retries per request (null for BullMQ default)",
                },
            },
        },
        sentry: {
            type: "object",
            additionalProperties: false,
            properties: {
                dsn: {
                    type: "string",
                    default: "",
                },
                traceSampleRate: {
                    type: "number",
                    default: 1.0,
                },
            },
        },
        sockethub: {
            type: "object",
            additionalProperties: false,
            properties: {
                port: {
                    type: "number",
                    default: 10550,
                },
                host: {
                    type: "string",
                    default: "localhost",
                },
                path: {
                    type: "string",
                    default: "/sockethub",
                },
            },
        },
        platformHeartbeat: {
            type: "object",
            additionalProperties: false,
            properties: {
                intervalMs: {
                    type: "number",
                    default: 5000,
                },
                timeoutMs: {
                    type: "number",
                    default: 15000,
                },
            },
        },
    },
};
