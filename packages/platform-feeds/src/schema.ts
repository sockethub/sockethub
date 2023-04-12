export default {
  name: "feeds",
  version: require("./../package.json").version,
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
