import packageJson from "../package.json" with { type: "json" };
const version = packageJson.version;

export const PlatformMetadataSchema = {
    name: "metadata",
    version: version,
    messages: {
        required: ["type"],
        properties: {
            type: {
                type: "string",
                enum: ["fetch"],
            },
            object: {
                type: "object",
                oneOf: [
                    { $ref: "#/definitions/objectTypes/feed-parameters-url" },
                ],
            },
        },
    },
};
