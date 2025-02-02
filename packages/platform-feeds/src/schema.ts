import packageJSON from "../package.json" with { type: "json" };

export default {
    name: "feeds",
    version: packageJSON.version,
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
