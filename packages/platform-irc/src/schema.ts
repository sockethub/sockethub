import packageJson from "../package.json" with { type: "json" };

const version = packageJson.version;

export const PlatformIrcSchema = {
    name: "irc",
    version: version,
    contextUrl: "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
    contextVersion: "1",
    schemaVersion: "1",
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
                not: { required: ["password", "token"] },
                // When saslMechanism is set, the matching secret must be
                // present: PLAIN requires password or token, OAUTHBEARER
                // requires token. Bare saslMechanism without a secret is
                // rejected. Expressed as allOf with negated implications
                // to avoid if/then (which trips the biome noThenProperty
                // rule).
                allOf: [
                    {
                        // PLAIN → password or token required
                        anyOf: [
                            {
                                not: {
                                    properties: {
                                        saslMechanism: { const: "PLAIN" },
                                    },
                                    required: ["saslMechanism"],
                                },
                            },
                            { required: ["password"] },
                            { required: ["token"] },
                        ],
                    },
                    {
                        // OAUTHBEARER → token required
                        anyOf: [
                            {
                                not: {
                                    properties: {
                                        saslMechanism: {
                                            const: "OAUTHBEARER",
                                        },
                                    },
                                    required: ["saslMechanism"],
                                },
                            },
                            { required: ["token"] },
                        ],
                    },
                ],
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
                        minLength: 1,
                    },
                    token: {
                        type: "string",
                        minLength: 1,
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
                    saslMechanism: {
                        type: "string",
                        enum: ["PLAIN", "OAUTHBEARER"],
                    },
                },
            },
        },
    },
};
