export interface ExamplesConfig {
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
    // Where the HTTP actions endpoint is served, so the examples can run API
    // discovery against it. Absent when written by an older server.
    httpActions?: {
        enabled: boolean;
        path: string;
    };
}

const port = {
    type: "integer",
    minimum: 1,
    maximum: 65535,
} as const;

export const ExamplesConfigSchema = {
    $id: "https://sockethub.org/schemas/v/examples-config.json",
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
        httpActions: {
            type: "object",
            required: ["enabled", "path"],
            additionalProperties: false,
            properties: {
                enabled: { type: "boolean" },
                path: { type: "string" },
            },
        },
    },
} as const;
