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
            // A metadata fetch takes no parameters — the target URL is the
            // actor id. Strictly reject any inbound `object` rather than leave
            // a permissive, unenforced placeholder. (The outbound response
            // carries an `object`/`page`, validated by the `responses` schema.)
            object: false,
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
                        // Post video (populated for X/Twitter statuses via
                        // FxTwitter): a direct media URL plus the poster
                        // thumbnail and dimensions.
                        video: {
                            type: "object",
                            required: ["url"],
                            additionalProperties: false,
                            properties: {
                                url: { type: "string" },
                                thumbnail: { type: "string" },
                                width: { type: "number" },
                                height: { type: "number" },
                                duration: { type: "number" },
                            },
                        },
                        url: { type: "string" },
                        favicon: { type: "string" },
                        charset: { type: "string" },
                    },
                },
                // open-graph-scraper returns ogImage as an array of image
                // objects (url + optional dimensions/type/alt text).
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
                            alt: { type: "string" },
                        },
                    },
                },
            },
        },
    },
};
