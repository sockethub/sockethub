import packageJSON from "../package.json" with { type: "json" };

export default {
    name: "feeds",
    version: packageJSON.version,
    contextUrl: "https://sockethub.org/ns/context/platform/feeds/v1.jsonld",
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
                    { $ref: "#/definitions/objectTypes/feed-parameters-date" },
                    { $ref: "#/definitions/objectTypes/feed-parameters-url" },
                ],
            },
        },
        definitions: {
            objectTypes: {
                "feed-parameters-date": {
                    type: "object",
                    additionalProperties: true,
                },
                "feed-parameters-url": {
                    type: "object",
                    additionalProperties: true,
                },
            },
        },
    },
    // Outbound (platform -> client): the feeds platform only emits a single
    // `collection` message whose `items` are `post` entries. Strict: every
    // field the platform constructs is enumerated.
    responses: {
        type: "object",
        required: ["type", "totalItems", "items"],
        additionalProperties: false,
        properties: {
            "@context": { type: "array", items: { type: "string" } },
            id: { type: ["string", "null"] },
            type: { enum: ["collection"] },
            summary: { type: "string" },
            totalItems: { type: "number" },
            items: {
                type: "array",
                items: { $ref: "#/definitions/responses/post" },
            },
        },
        definitions: {
            responses: {
                post: {
                    type: "object",
                    required: ["type", "actor", "object"],
                    additionalProperties: false,
                    properties: {
                        "@context": {
                            type: "array",
                            items: { type: "string" },
                        },
                        type: { enum: ["post"] },
                        actor: { $ref: "#/definitions/responses/feedChannel" },
                        object: { $ref: "#/definitions/responses/feedItem" },
                    },
                },
                feedChannel: {
                    type: "object",
                    required: ["id", "type", "name", "link"],
                    additionalProperties: false,
                    properties: {
                        id: { type: "string" },
                        type: { enum: ["feed"] },
                        name: { type: "string" },
                        link: { type: "string" },
                        description: { type: "string" },
                        image: { type: "string" },
                        categories: {
                            type: "array",
                            items: { type: "string" },
                        },
                        language: { type: "string" },
                        author: { type: "string" },
                    },
                },
                feedItem: {
                    type: "object",
                    required: [
                        "type",
                        "title",
                        "id",
                        "content",
                        "contentType",
                        "url",
                        "datenum",
                    ],
                    additionalProperties: false,
                    properties: {
                        type: { enum: ["article", "note"] },
                        title: { type: "string" },
                        id: { type: "string" },
                        brief: { type: "string" },
                        content: { type: "string" },
                        contentType: { enum: ["html", "text"] },
                        url: { type: "string" },
                        published: { type: "string" },
                        updated: { type: "string" },
                        datenum: { type: "number" },
                        tags: { type: "array", items: { type: "string" } },
                        media: { type: "array" },
                        source: { type: "string" },
                    },
                },
            },
        },
    },
};
