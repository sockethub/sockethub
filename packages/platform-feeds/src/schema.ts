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
    },
};
