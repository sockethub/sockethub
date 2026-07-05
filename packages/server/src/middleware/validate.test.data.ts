export default [
    {
        name: "mismatched types",
        valid: false,
        type: "credentials",
        input: {
            id: "blah",
            type: "send",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/fakeplatform/v1.jsonld",
            ],
            actor: {
                id: "dood@irc.freenode.net",
                type: "person",
                name: "dood",
            },
            target: {
                id: "irc.freenode.net/service",
                type: "person",
                name: "service",
            },
            object: {
                type: "credentials",
                user: "foo",
                pass: "bar",
            },
        },
        error: "Error: credential activity streams must have credentials set as type",
    },
    {
        name: "basic",
        valid: true,
        type: "credentials",
        input: {
            id: "blah",
            type: "credentials",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/fakeplatform/v1.jsonld",
            ],
            actor: {
                id: "dood@irc.freenode.net",
                type: "person",
                name: "dood",
            },
            object: {
                type: "credentials",
                user: "foo",
                pass: "bar",
            },
        },
        output: "same",
    },
    {
        name: "no type specified",
        valid: false,
        type: "credentials",
        input: {
            actor: "hyper_rau@localhost",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/fakeplatform/v1.jsonld",
            ],
            object: {
                username: "hyper_rau",
                password: "123",
                server: "localhost",
                port: 5222,
                resource: "laptop",
            },
        },
        error: "Error: credential activity streams must have credentials set as type",
    },
    {
        name: "alone credentials (as credentials)",
        valid: false,
        type: "credentials",
        input: {
            type: "credentials",
            nick: "sh-9K3Vk",
            port: 6667,
            secure: false,
            server: "irc.freenode.net",
        },
        error:
            "Error: platform context URL not registered with this Sockethub instance." +
            " No platform @context values were provided.",
    },
    {
        name: "unexpected AS",
        valid: false,
        type: "message",
        input: {
            actor: "irc://uuu@localhost",
            type: "join",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/fakeplatform/v1.jsonld",
            ],
            target: "irc://irc.dooder.net/a-room",
        },
        // AJV can report different first errors depending on evaluation order.
        error: [
            "Error: [fakeplatform] /actor: must be object",
            "Error: [fakeplatform] /target: must match exactly one schema in oneOf: person, room, service, feed, website, address",
        ],
    },
    {
        name: "missing type property",
        valid: false,
        type: "message",
        input: {
            actor: { id: "irc://uuu@localhost", type: "person" },
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/fakeplatform/v1.jsonld",
            ],
            target: { id: "irc://irc.dooder.net/a-room", type: "room" },
        },
        error: "Error: [fakeplatform] activity stream: must have required property 'type'",
    },
    {
        name: "invalid context property",
        valid: false,
        type: "message",
        input: {
            actor: { id: "irc://uuu@localhost", type: "person" },
            type: "foo",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/foobar111/v1.jsonld",
            ],
            target: { id: "irc://irc.dooder.net/a-room", type: "room" },
        },
        error:
            "Error: platform context URL not registered with this Sockethub instance." +
            " Unregistered platform @context value: " +
            "https://sockethub.org/ns/context/platform/foobar111/v1.jsonld",
    },
    {
        name: "missing actor property",
        valid: false,
        type: "message",
        input: {
            type: "foo",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/fakeplatform/v1.jsonld",
            ],
            target: { id: "irc://irc.dooder.net/a-room", type: "room" },
        },
        error: "Error: [fakeplatform] activity stream: must have required property 'actor'",
    },
    {
        name: "traditional message",
        valid: true,
        type: "message",
        input: {
            type: "echo",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/fakeplatform/v1.jsonld",
            ],
            actor: { id: "irc://uuu@localhost", type: "person" },
        },
    },
    {
        name: "message with wrong type",
        valid: false,
        type: "message",
        input: {
            type: "foorg",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/fakeplatform/v1.jsonld",
            ],
            actor: { id: "irc://uuu@localhost", type: "person" },
        },
        error: "Error: [fakeplatform] /type: must be equal to one of the allowed values",
    },
];
