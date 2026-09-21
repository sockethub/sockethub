/**
 * The public service descriptor served on a bare GET of the HTTP actions
 * path. It carries API versions only (the SemVer major of the server package
 * and of each platform package), never exact package versions.
 */
export interface ServiceDescriptor {
    name: "sockethub";
    apiVersion: number;
    platforms: Array<{ id: string; apiVersion: number }>;
}

// An API version is a SemVer major: a non-negative integer.
const apiVersion = {
    type: "integer",
    minimum: 0,
} as const;

export const ServiceDescriptorSchema = {
    $id: "https://sockethub.org/schemas/v/service-descriptor.json",
    description: "Sockethub HTTP actions service descriptor",
    type: "object",
    required: ["name", "apiVersion", "platforms"],
    // Open to new members: clients validating against this version of the
    // schema must keep working when a later server adds descriptor fields.
    additionalProperties: true,
    properties: {
        name: { const: "sockethub" },
        apiVersion,
        platforms: {
            type: "array",
            items: {
                type: "object",
                required: ["id", "apiVersion"],
                additionalProperties: true,
                properties: {
                    id: { type: "string", minLength: 1 },
                    apiVersion,
                },
            },
        },
    },
} as const;
