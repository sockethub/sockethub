const connectConfigPlatforms = {
    connectTimeoutMs: {
        type: "number",
        default: 30000,
    },
};

export const SockethubConfigSchema = {
    $id: "https://sockethub.org/schemas/v/sockethub-config.json",
    description: "Sockethub Config Schema",
    type: "object",
    required: ["platforms"],
    properties: {
        examples: {
            type: "object",
            properties: {
                enabled: {
                    type: "boolean",
                    default: false,
                },
                secret: {
                    type: "string",
                    default: "1234567890",
                },
            },
            additionalProperties: false,
        },
        log_file: {
            type: "string",
        },
        packageConfig: {
            type: "object",
            properties: {
                "@sockethub/activity-streams": {
                    type: "object",
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
                    additionalProperties: false,
                },
                "@sockethub/platform-dummy": {
                    type: "object",
                    properties: {
                        greeting: {
                            type: "string",
                            default: "Hello",
                        },
                    },
                    additionalProperties: false,
                },
                "@sockethub/platform-feeds": {
                    type: "object",
                    properties: {
                        ...connectConfigPlatforms,
                    },
                    additionalProperties: false,
                },
                "@sockethub/platform-irc": {
                    type: "object",
                    properties: {
                        ...connectConfigPlatforms,
                    },
                    additionalProperties: false,
                },
                "@sockethub/platform-xmpp": {
                    type: "object",
                    properties: {
                        ...connectConfigPlatforms,
                    },
                    additionalProperties: false,
                },
            },
        },
        platforms: {
            type: "array",
            items: {
                type: "string",
            },
        },
        public: {
            type: "object",
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
            additionalProperties: false,
        },
        redis: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    default: "redis://127.0.0.1:6379",
                },
            },
            additionalProperties: false,
        },
        sockethub: {
            type: "object",
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
            additionalProperties: false,
        },
    },
};
