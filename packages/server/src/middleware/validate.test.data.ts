export default [
    {
        name: "mismatched types",
        valid: false,
        type: "credentials",
        input: {
            id: "blah",
            type: "send",
            context: "fakeplatform",
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
            context: "fakeplatform",
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
            context: "fakeplatform",
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
        name: "basic person",
        type: "activity-object",
        valid: true,
        input: {
            id: "blah",
            type: "person",
            name: "dood",
        },
        output: "same",
    },
    {
        name: "person with extras",
        valid: true,
        type: "activity-object",
        input: {
            id: "blah",
            type: "person",
            name: "bob",
            hello: "there",
            i: ["am", "extras"],
        },
        output: "same",
    },
    {
        name: "alone credentials (as activity-object)",
        valid: false,
        type: "activity-object",
        input: {
            type: "credentials",
            nick: "sh-9K3Vk",
            port: 6667,
            secure: false,
            server: "irc.freenode.net",
        },
        error:
            "Error: /object: must match exactly one schema in oneOf: " +
            "credentials, feed, message, me, person, room, service, website, " +
            "attendance, presence, relationship, topic, address",
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
        error: "Error: platform context undefined not registered with this Sockethub instance.",
    },
    {
        name: "new person",
        valid: true,
        type: "activity-object",
        input: {
            id: "sh-9K3Vk@irc.freenode.net",
            type: "person",
            name: "sh-9K3Vk",
            image: {
                height: 250,
                mediaType: "image/jpeg",
                url: "https://example.org/image.jpg",
                width: 250,
            },
            url: "https://sockethub.org",
        },
        output: "same",
    },
    {
        name: "new person",
        valid: true,
        type: "activity-object",
        input: {
            id: "irc://sh-9K3Vk@irc.freenode.net",
            type: "person",
            name: "sh-9K3Vk",
            url: "https://sockethub.org",
        },
        output: "same",
    },
    {
        name: "bad parent object",
        valid: false,
        type: "activity-stream",
        input: {
            string: "this is a string",
            array: [
                "this",
                "is",
                {
                    an: "array",
                },
            ],
            as: {
                id: "blah",
                type: "send",
                context: "hello",
                actor: {
                    name: "dood",
                },
                target: {
                    type: "person",
                    name: "bob",
                },
                object: {
                    type: "credentials",
                },
            },
            noId: {
                name: "dood",
            },
            noId2: {
                type: "person",
                name: "bob",
            },
            noDisplayName: {
                id: "larg",
            },
        },
        error: "Error: platform context undefined not registered with this Sockethub instance.",
    },
    {
        name: "unexpected AS",
        valid: false,
        type: "message",
        input: {
            actor: "irc://uuu@localhost",
            type: "join",
            context: "fakeplatform",
            target: "irc://irc.dooder.net/a-room",
        },
        error: "Error: [fakeplatform] /actor: must be object",
    },
    {
        name: "missing type property",
        valid: false,
        type: "message",
        input: {
            actor: { id: "irc://uuu@localhost", type: "person" },
            context: "fakeplatform",
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
            context: "foobar111",
            target: { id: "irc://irc.dooder.net/a-room", type: "room" },
        },
        error: "Error: platform context foobar111 not registered with this Sockethub instance.",
    },
    {
        name: "missing actor property",
        valid: false,
        type: "message",
        input: {
            type: "foo",
            context: "fakeplatform",
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
            context: "fakeplatform",
            actor: { id: "irc://uuu@localhost", type: "person" },
        },
    },
    {
        name: "message with wrong type",
        valid: false,
        type: "message",
        input: {
            type: "foorg",
            context: "fakeplatform",
            actor: { id: "irc://uuu@localhost", type: "person" },
        },
        error:
            "Error: platform type foorg not supported by fakeplatform platform. " +
            "(types: credentials, echo, fail)",
    },
];
