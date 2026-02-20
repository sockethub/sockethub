import packageJson from "../package.json" with { type: "json" };

const version = packageJson.version;

export const PlatformIrcSchema = {
    name: "irc",
    version: version,
    as2: {
        contextUrl: "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
        contextVersion: "1",
        schemaVersion: "1",
    },
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
                    "disconnect",
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
