import { expect } from "@esm-bundle/chai";
import "./../packages/server/res/sockethub-client.js";
import "./../packages/server/res/socket.io.js";

const SH_PORT = 10550;

mocha.bail(true);
mocha.timeout("60s");

describe(`Sockethub tests at port ${SH_PORT}`, () => {
    it("has global `io`", () => {
        typeof expect(typeof io).to.equal("function");
    });

    it("has global `SockethubClient`", () => {
        typeof expect(typeof SockethubClient).to.equal("function");
    });

    describe("SockethubClient()", () => {
        let sc;
        const incomingMessages = [];

        before(() => {
            sc = new SockethubClient(
                io(`http://localhost:${SH_PORT}/`, { path: "/sockethub" }),
            );
            sc.socket.on("message", (msg) => {
                // console.log(">> incoming message: ", msg);
                incomingMessages.push(msg);
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
                it(`sends echo ${i} and gets response`, (done) => {
                    const dummyObj = {
                        type: "echo",
                        actor: actor.id,
                        context: "dummy",
                        object: {
                            type: "message",
                            content: `hello world ${i}`,
                        },
                    };
                    sc.socket.emit("message", dummyObj, (msg) => {
                        if (msg?.error) {
                            done(new Error(msg.error));
                        } else {
                            expect(msg.target).to.eql(
                                sc.ActivityStreams.Object.get(actor.id),
                            );
                            expect(msg.actor.type).to.equal("platform");
                            done();
                        }
                    });
                });
            }

            it("sends fail and returns error", (done) => {
                const dummyObj = {
                    type: "fail",
                    actor: actor.id,
                    context: "dummy",
                    object: { type: "message", content: "failure message" },
                };
                sc.socket.emit("message", dummyObj, (msg) => {
                    if (msg?.error) {
                        dummyObj.error = "Error: failure message";
                        dummyObj.actor = sc.ActivityStreams.Object.get(
                            actor.id,
                        );
                        expect(msg).to.eql(dummyObj);
                        done();
                    } else {
                        done(
                            new Error(
                                "didn't receive expected failure from dummy platform",
                            ),
                        );
                    }
                });
            });

            it("sends a throw and returns error", (done) => {
                const dummyObj = {
                    type: "throw",
                    actor: actor.id,
                    context: "dummy",
                    object: { type: "message", content: "failure message" },
                };
                sc.socket.emit("message", dummyObj, (msg) => {
                    if (msg?.error) {
                        dummyObj.error = "failure message";
                        dummyObj.actor = sc.ActivityStreams.Object.get(
                            actor.id,
                        );
                        expect(msg).to.eql(dummyObj);
                        done();
                    } else {
                        done(
                            new Error(
                                "didn't receive expected failure from dummy platform",
                            ),
                        );
                    }
                });
            });
        });

        describe("Feeds", () => {
            describe("fetches a feed", () => {
                it("gets expected results", (done) => {
                    sc.socket.emit(
                        "message",
                        {
                            context: "feeds",
                            type: "fetch",
                            actor: {
                                type: "feed",
                                id: `http://localhost:${SH_PORT}/feed.xml`,
                            },
                        },
                        (msg, second) => {
                            expect(msg.type).to.eql("collection");
                            expect(msg.items.length).to.eql(20);
                            expect(msg.totalItems).to.eql(20);
                            for (const m of msg.items) {
                                expect(typeof m.object.content).to.equal(
                                    "string",
                                );
                                expect(m.object.contentType).to.equal("html");
                                expect(m.actor.type).to.equal("feed");
                                expect(m.type).to.equal("post");
                            }
                            done(
                                msg?.error
                                    ? new Error(
                                          `Failed to fetch ${msg.items?.[0]?.actor?.id || "feed"}: ${msg.error}`,
                                      )
                                    : undefined,
                            );
                        },
                    );
                });
            });
        });

        describe("XMPP", () => {
            const actorId = "jimmy@prosody/SockethubExample";
            const actorObject = {
                id: actorId,
                type: "person",
                name: "Jimmy Userson",
            };

            describe("Credentials", () => {
                it("fires an empty callback", (done) => {
                    sc.socket.emit(
                        "credentials",
                        {
                            actor: {
                                id: actorId,
                                type: "person",
                            },
                            context: "xmpp",
                            type: "credentials",
                            object: {
                                type: "credentials",
                                password: "passw0rd",
                                resource: "SockethubExample",
                                userAddress: "jimmy@prosody",
                            },
                        },
                        done,
                    );
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
                it("is successful", (done) => {
                    sc.socket.emit(
                        "message",
                        {
                            type: "connect",
                            actor: actorId,
                            context: "xmpp",
                        },
                        (msg) => {
                            if (msg?.error) {
                                done(new Error(msg.error));
                            } else {
                                expect(msg).to.eql({
                                    type: "connect",
                                    actor: actorObject,
                                    context: "xmpp",
                                });
                                done();
                            }
                        },
                    );
                });
            });
            describe("Join", () => {
                it("should be successful", (done) => {
                    sc.socket.emit(
                        "message",
                        {
                            type: "join",
                            actor: actorId,
                            context: "xmpp",
                            target: {
                                type: "room",
                                id: "test@prosody",
                            },
                        },
                        (msg) => {
                            expect(msg).to.eql({
                                type: "join",
                                actor: actorObject,
                                context: "xmpp",
                                target: {
                                    id: "test@prosody",
                                    type: "room",
                                },
                            });
                            done();
                        },
                    );
                });
            });
            describe("Send", () => {
                it("should be successful", (done) => {
                    sc.socket.emit(
                        "message",
                        {
                            type: "send",
                            actor: actorId,
                            context: "xmpp",
                            object: {
                                type: "message",
                                content: "Hello, world!",
                            },
                            target: {
                                type: "room",
                                id: "test@prosody",
                            },
                        },
                        (msg) => {
                            expect(msg).to.eql({
                                type: "send",
                                actor: actorObject,
                                context: "xmpp",
                                object: {
                                    type: "message",
                                    content: "Hello, world!",
                                },
                                target: {
                                    id: "test@prosody",
                                    type: "room",
                                },
                            });
                            done();
                        },
                    );
                });
            });
        });

        describe("Incoming Message queue", () => {
            it("should be empty", () => {
                // console.log(
                //     `*** MESSAGE QUEUE, length: ${incomingMessages.length} ***`,
                // );
                expect(incomingMessages.length).to.be.below(2);
                if (incomingMessages.length === 1) {
                    expect(incomingMessages).to.eql([
                        {
                            context: "xmpp",
                            type: "message",
                            actor: { id: "test@prosody", type: "room" },
                            error: '<error type="cancel"><service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>',
                            target: {
                                id: "jimmy@prosody/SockethubExample",
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
