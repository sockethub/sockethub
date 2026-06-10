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
    // Outbound (platform -> client): the metadata platform echoes the `fetch`
    // request with a `page` object built from open-graph-scraper output. Strict:
    // every field the platform constructs is enumerated.
    responses: {
        type: "object",
        required: ["type", "actor", "object"],
        additionalProperties: false,
        properties: {
            "@context": { type: "array", items: { type: "string" } },
            id: { type: "string" },
            type: { enum: ["fetch"] },
            actor: {
                type: "object",
                required: ["id", "type"],
                additionalProperties: false,
                properties: {
                    id: { type: "string" },
                    type: { enum: ["website"] },
                    name: { type: "string" },
                },
            },
            object: { $ref: "#/definitions/responses/page" },
        },
        definitions: {
            responses: {
                page: {
                    type: "object",
                    required: ["type"],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["page"] },
                        language: { type: "string" },
                        title: { type: "string" },
                        name: { type: "string" },
                        description: { type: "string" },
                        image: { $ref: "#/definitions/responses/ogImage" },
                        url: { type: "string" },
                        favicon: { type: "string" },
                        charset: { type: "string" },
                    },
                },
                // open-graph-scraper returns ogImage as an array of image
                // objects (url + optional dimensions/type).
                ogImage: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["url"],
                        additionalProperties: false,
                        properties: {
                            url: { type: "string" },
                            type: { type: "string" },
                            width: { type: ["string", "number"] },
                            height: { type: ["string", "number"] },
                        },
                    },
                },
            },
        },
    },
};
