export default [
    [
        "credentials with no context",
        {
            type: "credentials",
            object: {
                type: "credentials",
            },
        },
        false,
        "credential activity streams must have an @context set",
    ],

    [
        "credentials with no type",
        {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/test-platform/v1.jsonld",
            ],
            actor: {
                id: "test-platform-user",
                type: "person",
            },
            object: {
                type: "credentials",
            },
        },
        false,
        "credential activity streams must have credentials set as type",
    ],

    [
        "credentials with props",
        {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/test-platform/v1.jsonld",
            ],
            type: "credentials",
            actor: {
                id: "test-platform-user",
                type: "person",
            },
            object: {
                type: "credentials",
                user: "foo",
                pass: "bar",
            },
        },
        false,
        "[test-platform] /object: must NOT have additional properties: pass",
    ],

    [
        "credentials with props",
        {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/test-platform/v1.jsonld",
            ],
            type: "credentials",
            actor: {
                id: "test-platform-user",
                type: "person",
            },
            object: {
                type: "credentials",
                username: "foo",
                password: "bar",
            },
        },
        false,
        `[test-platform] /object: must have required property 'host'`,
    ],

    [
        "credentials with props",
        {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/test-platform/v1.jsonld",
            ],
            type: "credentials",
            actor: {
                id: "test-platform-user",
                type: "person",
            },
            object: {
                type: "credentials",
                username: "foo",
                password: "bar",
                host: "yarg",
            },
        },
        true,
        "",
    ],
];
