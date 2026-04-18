const connectConfigPlatforms = {
    connectTimeoutMs: {
        type: "number",
    },
};

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
        packageConfig: {
            type: "object",
            properties: {
                "@sockethub/activity-streams": {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        specialObjs: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            default: ["credentials"],
                        },
                        failOnUnknownObjectProperties: {
                            type: "boolean",
                            default: true,
                        },
                    },
                },
                "@sockethub/platform-dummy": {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        greeting: {
                            type: "string",
                            default: "Hello",
                        },
                    },
                },
                "@sockethub/platform-feeds": {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        ...connectConfigPlatforms,
                    },
                },
                "@sockethub/platform-irc": {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        ...connectConfigPlatforms,
                    },
                },
                "@sockethub/platform-xmpp": {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        ...connectConfigPlatforms,
                    },
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
        httpActions: {
            type: "object",
            additionalProperties: false,
            properties: {
                enabled: {
                    type: "boolean",
                    default: false,
                },
                path: {
                    type: "string",
                    default: "/sockethub-http",
                },
                requireRequestId: {
                    type: "boolean",
                    default: true,
                },
                maxMessagesPerRequest: {
                    type: "number",
                    default: 20,
                },
                maxPayloadBytes: {
                    type: "number",
                    default: 262144,
                },
                idempotencyTtlMs: {
                    type: "number",
                    default: 300000,
                },
                requestTimeoutMs: {
                    type: "number",
                    default: 30000,
                },
                idleTimeoutMs: {
                    type: "number",
                    default: 15000,
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
