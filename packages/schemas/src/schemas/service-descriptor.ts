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

/**
 * Where to connect, as server-absolute paths (leading `/`) on the origin the
 * descriptor was fetched from. No origin is advertised: a client has already
 * reached the server, and resolving paths against that same origin cannot be
 * misdirected by a misconfigured `public` block.
 */
export interface ServiceEndpoints {
    /**
     * The Socket.IO server path, to be passed as the `path` option of `io()`
     * (a path appended to the URL would select a namespace instead).
     */
    socketIO: string;
    /** The HTTP actions path. Present only when that transport is enabled. */
    httpActions?: string;
}

// An API version is a SemVer major: a non-negative integer.
const apiVersion = {
    type: "integer",
    minimum: 0,
} as const;

const nonEmptyString = { type: "string", minLength: 1 } as const;

// A server-absolute path: starts with a single "/" and carries no scheme or
// host. "//host/x" and "/\\host/x" are rejected because URL resolution would
// read them as protocol-relative and send the client to another origin.
const absolutePath = { type: "string", pattern: "^/(?![/\\\\])" } as const;

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
            required: ["socketIO"],
            additionalProperties: true,
            properties: {
                socketIO: absolutePath,
                httpActions: absolutePath,
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
