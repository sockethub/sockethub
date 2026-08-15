export interface RuntimeConfig {
    sockethub: {
        port: number;
        host: string;
        path: string;
    };
    public: {
        protocol: string;
        host: string;
        port: number;
        path: string;
    };
    platforms?: string[];
}

const port = {
    type: "integer",
    minimum: 1,
    maximum: 65535,
} as const;

export const RuntimeConfigSchema = {
    $id: "https://sockethub.org/schemas/v/runtime-config.json",
    description: "Sockethub examples runtime configuration",
    type: "object",
    required: ["sockethub", "public"],
    additionalProperties: false,
    properties: {
        sockethub: {
            type: "object",
            required: ["port", "host", "path"],
            additionalProperties: false,
            properties: {
                port,
                host: { type: "string" },
                path: { type: "string" },
            },
        },
        public: {
            type: "object",
            required: ["protocol", "host", "port", "path"],
            additionalProperties: false,
            properties: {
                protocol: { type: "string" },
                host: { type: "string" },
                port,
                path: { type: "string" },
            },
        },
        platforms: {
            type: "array",
            items: { type: "string" },
        },
    },
} as const;
