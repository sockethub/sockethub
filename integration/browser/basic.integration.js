import { expect } from "@esm-bundle/chai";
import createTestUtils from "../utils.js";
import {
    connectXMPP,
    emitWithAck,
    getConfig,
    joinXMPPRoom,
    sendXMPPMessage,
    setXMPPCredentials,
    validateGlobals,
    waitFor,
    waitForSchemas,
} from "./shared-setup.js";

const config = getConfig();
const utils = createTestUtils(config);

describe(`Sockethub Basic Integration Tests at ${config.sockethub.url}`, () => {
    validateGlobals();

    describe("SockethubClient()", () => {
        let sc;
        const incomingMessages = [];

        before(async () => {
            sc = new SockethubClient(
                io(config.sockethub.url, { path: "/sockethub" }),
            );
            sc.socket.on("message", (msg) => {
                incomingMessages.push(msg);
            });
            await waitFor(() => sc.socket.connected, config.timeouts.connect);
            await waitForSchemas(sc);
        });

        after(() => {
            if (sc?.socket) {
                sc.socket.disconnect();
            }
        });

        describe("ActivityStreams", () => {
            it("handles empty objects", () => {
                expect(() => {
                    sc.ActivityStreams.Object.create(undefined);
                }).to.throw(
                    'ActivityStreams validation failed: the "object" property is undefined. Example: { id: "user@example.com", type: "person" }',
                );
                expect(() => {
                    sc.ActivityStreams.Object.create(null);
                }).to.throw(
                    'ActivityStreams validation failed: the "object" property is null. Example: { id: "user@example.com", type: "person" }',
                );
                expect(() => {
                    sc.ActivityStreams.Object.create("");
                }).to.throw(
                    'ActivityStreams validation failed: the "object" property received string "" but expected an object. Use: { id: "", type: "person" }',
                );
                expect(() => {
                    sc.ActivityStreams.Object.create("foo");
                }).to.throw(
                    'ActivityStreams validation failed: the "object" property received string "foo" but expected an object. Use: { id: "foo", type: "person" }',
                );
                expect(() => {
                    sc.ActivityStreams.Object.create(123);
                }).to.throw(
                    'ActivityStreams validation failed: the "object" property must be an object, received number (123). Example: { id: "user@example.com", type: "person" }',
                );
                expect(() => {
                    sc.ActivityStreams.Object.create([]);
                }).to.throw(
                    'ActivityStreams validation failed: the "object" property must be an object, received array (). Example: { id: "user@example.com", type: "person" }',
                );
                expect(() => {
                    sc.ActivityStreams.Object.create({});
                }).to.throw(
                    'ActivityStreams validation failed: the "object" property requires an \'id\' property. Example: { id: "user@example.com", type: "person" }',
                );
            });
        });

        describe("Dummy", () => {
            const actor = {
                id: "jimmy@dummy",
                type: "person",
                name: "Jimmy",
            };

            it("creates activity-object", () => {
                sc.ActivityStreams.Object.create(actor);
                expect(sc.ActivityStreams.Object.get(actor.id)).to.eql(actor);
            });

            const dummyMessageCount = 5;
            for (let i = 0; i < dummyMessageCount; i++) {
                it(`sends echo ${i} and gets response`, async () => {
                    const dummyObj = {
                        type: "echo",
                        actor: actor.id,
                        "@context": sc.contextFor("dummy"),
                        object: {
                            type: "message",
                            content: `hello world ${i}`,
                        },
                    };
                    const msg = await emitWithAck(
                        sc.socket,
                        "message",
                        dummyObj,
                        { label: `dummy echo ${i}` },
                    );
                    if (msg?.error) {
                        throw new Error(msg.error);
                    }
                    expect(msg.target).to.eql(
                        sc.ActivityStreams.Object.get(actor.id),
                    );
                    expect(msg.actor.type).to.equal("platform");
                });
            }

            it("sends fail and returns error", async () => {
                const dummyObj = {
                    type: "fail",
                    actor: actor.id,
                    "@context": sc.contextFor("dummy"),
                    object: { type: "message", content: "failure message" },
                };
                const msg = await emitWithAck(sc.socket, "message", dummyObj, {
                    label: "dummy fail",
                });
                if (msg?.error) {
                    expect(msg.error).to.equal("Error: failure message");
                    dummyObj.error = "Error: failure message";
                    dummyObj.platform = "dummy";
                    dummyObj.actor = sc.ActivityStreams.Object.get(actor.id);
                    expect(msg).to.eql(dummyObj);
                } else {
                    throw new Error(
                        "didn't receive expected failure from dummy platform",
                    );
                }
            });

            it("sends a throw and returns error", async () => {
                const dummyObj = {
                    type: "throw",
                    actor: actor.id,
                    "@context": sc.contextFor("dummy"),
                    object: { type: "message", content: "failure message" },
                };
                const msg = await emitWithAck(sc.socket, "message", dummyObj, {
                    label: "dummy throw",
                });
                if (msg?.error) {
                    expect(msg.error).to.equal("Error: failure message");
                    dummyObj.error = "Error: failure message";
                    dummyObj.platform = "dummy";
                    dummyObj.actor = sc.ActivityStreams.Object.get(actor.id);
                    expect(msg).to.eql(dummyObj);
                } else {
                    throw new Error(
                        "didn't receive expected failure from dummy platform",
                    );
                }
            });
        });

        describe("Feeds", () => {
            describe("fetches a feed", () => {
                it("gets expected results", async () => {
                    const msg = await emitWithAck(
                        sc.socket,
                        "message",
                        {
                            "@context": sc.contextFor("feeds"),
                            type: "fetch",
                            actor: {
                                type: "feed",
                                id: `${config.sockethub.url}/feed.xml`,
                            },
                        },
                        { label: "feeds fetch" },
                    );
                    expect(msg.type).to.eql("collection");
                    expect(msg.items.length).to.eql(20);
                    expect(msg.totalItems).to.eql(20);
                    for (const m of msg.items) {
                        expect(typeof m.object.content).to.equal("string");
                        expect(m.object.contentType).to.equal("html");
                        expect(m.actor.type).to.equal("feed");
                        expect(m.type).to.equal("post");
                    }
                    if (msg?.error) {
                        throw new Error(
                            `Failed to fetch ${msg.items?.[0]?.actor?.id || "feed"}: ${msg.error}`,
                        );
                    }
                });
            });
        });

        const jid = utils.createXmppJid();
        const actorObject = {
            id: jid,
            type: "person",
            name: "Jimmy Userson",
        };

        describe("XMPP", () => {
            describe("Credentials", () => {
                it("fires an empty callback", async () => {
                    await setXMPPCredentials(sc, jid);
                });
            });

            describe("ActivityStreams.create", () => {
                it("successfully creates and stores an activity-object", () => {
                    const obj = sc.ActivityStreams.Object.create(actorObject);
                    const getObj = sc.ActivityStreams.Object.get(
                        actorObject.id,
                    );
                    expect(obj).to.eql(actorObject);
                    expect(getObj).to.eql(actorObject);
                });
            });

            describe("connect", () => {
                it("is successful", async () => {
                    const msg = await connectXMPP(sc, jid);
                    expect(msg).to.eql({
                        type: "connect",
                        platform: "xmpp",
                        actor: actorObject,
                        "@context": sc.contextFor("xmpp"),
                    });
                });
            });

            describe("Join", () => {
                it("should be successful", async () => {
                    const msg = await joinXMPPRoom(sc, jid, "test@prosody");
                    expect(msg).to.eql({
                        type: "join",
                        platform: "xmpp",
                        actor: actorObject,
                        "@context": sc.contextFor("xmpp"),
                        target: {
                            id: "test@prosody",
                            type: "room",
                        },
                    });
                });
            });

            describe("Send", () => {
                it("should be successful", async () => {
                    const msg = await sendXMPPMessage(
                        sc,
                        jid,
                        "test@prosody",
                        "Hello, world!",
                    );
                    expect(msg).to.eql({
                        type: "send",
                        platform: "xmpp",
                        actor: actorObject,
                        "@context": sc.contextFor("xmpp"),
                        object: {
                            type: "message",
                            content: "Hello, world!",
                        },
                        target: {
                            id: "test@prosody",
                            type: "room",
                        },
                    });
                });
            });
        });

        describe("IPC Channel Closed Error Reproduction", () => {
            // Test to reproduce the ERR_IPC_CHANNEL_CLOSED error
            // This simulates the scenario where wrong credentials cause platform termination
            // while the platform is still trying to send messages

            describe("XMPP with invalid credentials", () => {
                const invalidActorId = "baduser@prosody/TestResource";

                it("should handle IPC channel closure gracefully when using wrong credentials", async () => {
                    // First set invalid credentials
                    await emitWithAck(
                        sc.socket,
                        "credentials",
                        {
                            actor: {
                                id: invalidActorId,
                                type: "person",
                            },
                            "@context": sc.contextFor("xmpp"),
                            type: "credentials",
                            object: {
                                type: "credentials",
                                password: "wrong_password_123",
                                resource: "TestResource",
                                userAddress: "baduser@prosody",
                            },
                        },
                        { label: "xmpp invalid credentials" },
                    );

                    // Try to connect with bad credentials
                    // This should trigger platform termination and potential IPC race condition
                    const msg = await emitWithAck(
                        sc.socket,
                        "message",
                        {
                            type: "connect",
                            actor: invalidActorId,
                            "@context": sc.contextFor("xmpp"),
                        },
                        { label: "xmpp invalid connect" },
                    );
                    // We expect this to fail due to bad credentials
                    // The important part is that Sockethub shouldn't crash
                    // even if there's a race condition with IPC channel closure
                    if (msg?.error) {
                        // This is expected - wrong credentials should fail
                        expect(msg.error).to.be.a("string");
                    } else {
                        throw new Error(
                            "Expected authentication failure with wrong credentials",
                        );
                    }
                });
            });

            describe("IRC with invalid credentials", () => {
                const invalidIrcActorId = "baduser@irc.libera.chat";

                it("should handle IPC channel closure gracefully with IRC wrong credentials", async () => {
                    // Set invalid IRC credentials
                    await emitWithAck(
                        sc.socket,
                        "credentials",
                        {
                            actor: {
                                id: invalidIrcActorId,
                                type: "person",
                            },
                            "@context": sc.contextFor("irc"),
                            type: "credentials",
                            object: {
                                type: "credentials",
                                nick: "baduser",
                                password: "wrong_password_456",
                                server: "irc.libera.chat",
                                port: 6667,
                            },
                        },
                        { label: "irc invalid credentials" },
                    );

                    // Try to connect with bad credentials
                    const msg = await emitWithAck(
                        sc.socket,
                        "message",
                        {
                            type: "connect",
                            actor: invalidIrcActorId,
                            "@context": sc.contextFor("irc"),
                        },
                        { label: "irc invalid connect" },
                    );
                    // We expect this to fail and importantly NOT crash the server
                    if (msg?.error) {
                        expect(msg.error).to.be.a("string");
                    } else {
                        // Even if it doesn't fail immediately, that's ok
                        // The test is mainly to ensure no crashes occur
                    }
                });
            });
        });

        describe("Incoming Message queue", () => {
            it("should be empty", () => {
                expect(incomingMessages.length).to.be.below(2);
                if (incomingMessages.length === 1) {
                    expect(incomingMessages).to.eql([
                        {
                            "@context": sc.contextFor("xmpp"),
                            platform: "xmpp",
                            type: "message",
                            actor: { id: "test@prosody", type: "room" },
                            error: '<error type="cancel"><service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>',
                            target: {
                                id: jid,
                                type: "person",
                            },
                        },
                    ]);
                } else {
                    expect(incomingMessages).to.eql([]);
                }
            });
        });
    });
});
