import PackageJSON from "../package.json" with { type: "json" };

export const PlatformSchema = {
    name: "xmpp",
    version: PackageJSON.version,
    messages: {
        required: ["type"],
        properties: {
            type: {
                enum: [
                    "connect",
                    "join",
                    "leave",
                    "send",
                    "update",
                    "request-friend",
                    "remove-friend",
                    "make-friend",
                    "query",
                    "disconnect",
                ],
            },
        },
    },
    credentials: {
        required: ["object"],
        properties: {
            // TODO platforms shouldn't have to define the actor property if
            //  they don't want to, just credential specifics
            actor: {
                type: "object",
                required: ["id"],
            },
            object: {
                type: "object",
                required: ["type", "userAddress", "password", "resource"],
                additionalProperties: false,
                properties: {
                    type: {
                        type: "string",
                    },
                    userAddress: {
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
                    resource: {
                        type: "string",
                    },
                },
            },
        },
    },
};
