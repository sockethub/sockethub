import packageJson from "../package.json" with { type: "json" };

const version = packageJson.version;

export const PlatformMetadataSchema = {
    name: "metadata",
    version: version,
    contextUrl: "https://sockethub.org/ns/context/platform/metadata/v1.jsonld",
    contextVersion: "1",
    schemaVersion: "1",
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
        definitions: {
            objectTypes: {
                "feed-parameters-url": {
                    type: "object",
                    additionalProperties: true,
                },
            },
        },
    },
};
