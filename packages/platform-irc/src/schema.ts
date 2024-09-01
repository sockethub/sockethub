import denoJson from "../deno.json" with { type: "json" };
export default {
  name: "irc",
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  version: denoJson.version,
  messages: {
    required: ["type"],
    properties: {
      type: {
        enum: [
          "connect",
          "update",
          "join",
          "leave",
          "send",
          "query",
          "announce",
        ],
      },
    },
  },
  credentials: {
    required: ["object"],
    properties: {
      // TODO platforms shouldn't have to define the actor property
      //  if they don't want to, just credential specifics
      actor: {
        type: "object",
        required: ["id"],
      },
      object: {
        type: "object",
        required: ["type", "nick", "server"],
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
          },
          nick: {
            type: "string",
          },
          username: {
            type: "string",
          },
          password: {
            type: "string",
          },
          server: {
            type: "string",
          },
          port: {
            type: "number",
          },
          secure: {
            type: "boolean",
          },
          sasl: {
            type: "boolean",
          },
        },
      },
    },
  },
};
