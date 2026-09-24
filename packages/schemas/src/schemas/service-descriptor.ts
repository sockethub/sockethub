/**
 * The public service descriptor served on a bare GET of the HTTP actions
 * path and on `GET /` with `Accept: application/json`. It carries API
 * versions only (the SemVer major of the server package and of each platform
 * package), never exact package versions, plus the public connection
 * endpoints so a client needs nothing but the server's base URL.
 */
export interface ServiceDescriptor {
    name: "sockethub";
    apiVersion: number;
    /**
     * Where to connect. Absent from descriptors written by servers that
     * predate endpoint discovery.
     */
    endpoints?: ServiceEndpoints;
    platforms: Array<{ id: string; apiVersion: number }>;
}

export interface ServiceEndpoints {
    /**
     * The Socket.IO transport. The origin and the server path are separate
     * members because they are separate `io()` arguments: a path appended to
     * the URL would be read by Socket.IO as a namespace, not the server path.
     */
    socket: { origin: string; path: string };
    /** Absolute URL of the HTTP actions endpoint. Present only when enabled. */
    httpActions?: string;
}

// An API version is a SemVer major: a non-negative integer.
const apiVersion = {
    type: "integer",
    minimum: 0,
} as const;

const nonEmptyString = { type: "string", minLength: 1 } as const;

export const ServiceDescriptorSchema = {
    $id: "https://sockethub.org/schemas/v/service-descriptor.json",
    description: "Sockethub service descriptor",
    type: "object",
    required: ["name", "apiVersion", "platforms"],
    // Open to new members: clients validating against this version of the
    // schema must keep working when a later server adds descriptor fields.
    additionalProperties: true,
    properties: {
        name: { const: "sockethub" },
        apiVersion,
        endpoints: {
            type: "object",
            required: ["socket"],
            additionalProperties: true,
            properties: {
                socket: {
                    type: "object",
                    required: ["origin", "path"],
                    additionalProperties: true,
                    properties: {
                        // An origin only: scheme and host, no path or query.
                        origin: {
                            type: "string",
                            pattern: "^https?://[^/?#\\s]+$",
                        },
                        path: nonEmptyString,
                    },
                },
                httpActions: nonEmptyString,
            },
        },
        platforms: {
            type: "array",
            items: {
                type: "object",
                required: ["id", "apiVersion"],
                additionalProperties: true,
                properties: {
                    id: nonEmptyString,
                    apiVersion,
                },
            },
        },
    },
} as const;
