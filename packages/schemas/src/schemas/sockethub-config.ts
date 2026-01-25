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
        "$schema": {
            type: "string"
        },
        examples: {
            type: "boolean",
            default: true
        },
        log_file: {
            type: "string",
            default: "sockethub.log"
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
                "@sockethub/platform-xmpp"
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
                    default: 1000
                },
                maxRequests: {
                    type: "number",
                    default: 100
                },
                blockDurationMs: {
                    type: "number",
                    default: 5000
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
            },
        },
        sentry: {
            type: "object",
            additionalProperties: false,
            properties: {
                dsn: {
                    type: "string",
                    default: ""
                },
                traceSampleRate: {
                    type: "number",
                    default: 1.0
                }
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
    },
};
