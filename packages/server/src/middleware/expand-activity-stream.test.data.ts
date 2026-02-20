export default [
    {
        name: "not an object",
        valid: false,
        type: "message",
        input: "hello world",
        error: "Error: message received is not an object.",
    },
    {
        name: "basic invalid type",
        valid: true,
        type: "credentials",
        input: {
            id: "foo",
            type: "send",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/dummy/v1.jsonld",
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
            },
        },
        output: "same",
    },
    {
        name: "basic valid type",
        valid: true,
        type: "credentials",
        input: {
            id: "foo",
            type: "credentials",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/dummy/v1.jsonld",
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
            },
        },
        output: "same",
    },
    {
        name: "new format",
        valid: true,
        type: "credentials",
        input: {
            type: "credentials",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
            ],
            actor: {
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
            object: {
                type: "credentials",
                nick: "sh-9K3Vk",
                port: 6667,
                secure: false,
                server: "irc.freenode.net",
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
                "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld",
            ],
            object: {
                username: "hyper_rau",
                password: "123",
                server: "localhost",
                port: 5222,
                resource: "laptop",
            },
        },
        error: "Error: activity stream must contain a type property.",
    },
    {
        name: "expand unknown actor",
        type: "message",
        valid: "true",
        input: {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/foo/v1.jsonld",
            ],
            type: "bar",
            actor: "foo@bar",
            object: {
                content: "bar",
            },
        },
        output: {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/foo/v1.jsonld",
            ],
            type: "bar",
            actor: {
                id: "foo@bar",
            },
            object: {
                content: "bar",
            },
        },
    },
    {
        name: "expand unknown actor 2",
        type: "message",
        valid: "true",
        input: {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/foo/v1.jsonld",
            ],
            type: "bar",
            actor: "someone@example.org/resource",
            object: {
                content: "bar",
            },
        },
        output: {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/foo/v1.jsonld",
            ],
            type: "bar",
            actor: {
                id: "someone@example.org/resource",
            },
            object: {
                content: "bar",
            },
        },
    },
    {
        name: "expand unknown actor 2",
        type: "message",
        valid: "true",
        input: {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/foo/v1.jsonld",
            ],
            type: "bar",
            actor: "xmpp:someone@example.org/resource",
            object: {
                content: "bar",
            },
        },
        output: {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/foo/v1.jsonld",
            ],
            type: "bar",
            actor: {
                id: "xmpp:someone@example.org/resource",
            },
            object: {
                content: "bar",
            },
        },
    },
    {
        name: "person",
        type: "message",
        valid: true,
        input: {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/some context/v1.jsonld",
            ],
            type: "some type",
            actor: "blah",
            object: {},
        },
        output: {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/some context/v1.jsonld",
            ],
            type: "some type",
            actor: {
                id: "blah",
                type: "person",
                name: "dood",
            },
            object: {},
        },
    },
    {
        name: "person with extras",
        valid: true,
        type: "message",
        input: {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/some context/v1.jsonld",
            ],
            type: "some type",
            actor: "blah2",
            object: {},
        },
        output: {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/some context/v1.jsonld",
            ],
            type: "some type",
            actor: {
                id: "blah2",
                type: "person",
                name: "bob",
                hello: "there",
                i: ["am", "extras"],
            },
            object: {},
        },
    },
    {
        name: "bad parent object",
        valid: false,
        type: "message",
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
                "@context": [
                    "https://www.w3.org/ns/activitystreams",
                    "https://sockethub.org/ns/context/v1.jsonld",
                    "https://sockethub.org/ns/context/platform/hello/v1.jsonld",
                ],
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
        error: "Error: activity stream must contain an @context array.",
    },
    {
        name: "no actor specified",
        valid: false,
        type: "message",
        input: {
            type: "some type",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld",
            ],
            object: {
                type: "error",
                content: "error message",
            },
        },
        error: "Error: activity stream must contain an actor property.",
    },
    {
        name: "expand actor and target of unknowns",
        valid: true,
        type: "message",
        input: {
            actor: "irc://uuu@localhost",
            type: "join",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
            ],
            target: "irc://irc.dooder.net/a-room",
        },
        output: {
            actor: {
                id: "irc://uuu@localhost",
            },
            type: "join",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
            ],
            target: {
                id: "irc://irc.dooder.net/a-room",
            },
        },
    },
    {
        name: "expand actor and target of unknowns",
        valid: true,
        type: "message",
        input: {
            actor: "hyper_rau@localhost",
            type: "join",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld",
            ],
            object: {},
            target: "dooder",
        },
        output: {
            actor: {
                id: "hyper_rau@localhost",
            },
            type: "join",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld",
            ],
            object: {},
            target: {
                id: "dooder",
            },
        },
    },
    {
        name: "expand known person",
        valid: true,
        type: "message",
        input: {
            actor: "sh-9K3Vk@irc.freenode.net",
            target: "blah3",
            type: "send",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
            ],
            object: {},
        },
        output: {
            actor: {
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
            target: {
                id: "blah3",
                type: "person",
                name: "bob",
                hello: "there",
                i: ["am", "extras"],
            },
            type: "send",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
            ],
            object: {},
        },
    },
];
