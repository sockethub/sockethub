import type { ASManager } from "@sockethub/activity-streams";
import { expect } from "chai";
import EventEmitter from "eventemitter3";
import { createSandbox, restore } from "sinon";

import SockethubClient from "./sockethub-client";

describe("SockethubClient bad initialization", () => {
    it("no socket.io instance", () => {
        class TestSockethubClient extends SockethubClient {
            initActivityStreams() {
                this.ActivityStreams = {} as ASManager;
            }
        }
        expect(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            new TestSockethubClient();
        }).to.throw("SockethubClient requires a socket.io instance");
    });
});

describe("SockethubClient", () => {
    let asInstance: any, socket: any, sc: any, sandbox: any;

    beforeEach(() => {
        sandbox = sandbox = createSandbox();
        socket = new EventEmitter();
        socket.connected = false;
        socket.__instance = "socketio"; // used to uniquely identify the object we're passing in
        sandbox.spy(socket, "on");
        sandbox.spy(socket, "emit");
        asInstance = new EventEmitter();
        sandbox.spy(asInstance, "on");
        sandbox.spy(asInstance, "emit");
        asInstance.Stream = sandbox.stub().callsFake((stream: any) => {
            if (!stream || typeof stream !== "object") {
                return stream;
            }
            const next = { ...stream };
            if (typeof next.actor === "string") {
                next.actor = { id: next.actor };
            }
            if (typeof next.target === "string") {
                next.target = { id: next.target };
            }
            if (typeof next.object === "string") {
                next.object = { content: next.object };
            }
            return next;
        });
        asInstance.Object = {
            create: sandbox.stub(),
        };
        class TestSockethubClient extends SockethubClient {
            initActivityStreams() {
                this.ActivityStreams = asInstance as ASManager;
            }
        }
        sc = new TestSockethubClient(socket);
        sandbox.spy(sc.socket, "on");
        sandbox.spy(sc.socket, "emit");
        sandbox.spy(sc.socket, "_emit");
    });

    afterEach(() => {
        restore();
    });

    it("contains the ActivityStreams property", () => {
        expect(asInstance).to.be.eql(sc.ActivityStreams);
        expect(typeof asInstance.Stream).to.equal("function");
        expect(typeof sc.ActivityStreams.Object.create).to.equal("function");
    });

    it("contains the socket property", () => {
        expect(sc.socket instanceof EventEmitter).to.be.true;
        // the object we passed in should not be the publicly available one
        expect(sc.socket.__instance).to.not.equal("socketio");
        expect(sc.debug).to.be.true;
        expect(sc.socket.connected).to.be.false;
    });

    it("registers listeners for ActivityStream events", () => {
        expect(asInstance.on.callCount).to.equal(1);
        expect(asInstance.on.calledWithMatch("activity-object-create")).to.be
            .true;
    });

    it("registers a listeners for socket events", () => {
        expect(socket.on.callCount).to.equal(6);
        expect(socket.on.calledWithMatch("activity-object")).to.be.true;
        expect(socket.on.calledWithMatch("connect")).to.be.true;
        expect(socket.on.calledWithMatch("connect_error")).to.be.true;
        expect(socket.on.calledWithMatch("disconnect")).to.be.true;
        expect(socket.on.calledWithMatch("message")).to.be.true;
        expect(socket.on.calledWithMatch("schemas")).to.be.true;
    });

    describe("contextFor", () => {
        it("throws before schema registry is loaded", () => {
            expect(() => sc.contextFor("xmpp")).to.throw(
                "Schema registry not loaded yet",
            );
        });

        it("throws when platform is missing", () => {
            expect(() => sc.contextFor("")).to.throw(
                "requires a non-empty platform string",
            );
        });

        it("uses server-provided contexts and platform context URL", () => {
            socket.emit("schemas", {
                contexts: {
                    as: "https://example.com/as2",
                    sockethub: "https://example.com/sh",
                },
                platforms: [
                    {
                        id: "xmpp",
                        contextUrl:
                            "https://example.com/context/platform/xmpp/v9.jsonld",
                        contextVersion: "9",
                        schemaVersion: "9",
                        types: ["connect", "send"],
                        schemas: {
                            messages: {},
                            credentials: {},
                        },
                    },
                ],
            });

            expect(sc.contextFor("xmpp")).to.eql([
                "https://example.com/as2",
                "https://example.com/sh",
                "https://example.com/context/platform/xmpp/v9.jsonld",
            ]);
        });

        it("throws for unknown platform when registry is loaded", () => {
            socket.emit("schemas", {
                contexts: {
                    as: "https://example.com/as2",
                    sockethub: "https://example.com/sh",
                },
                platforms: [
                    {
                        id: "xmpp",
                        contextUrl:
                            "https://example.com/context/platform/xmpp/v9.jsonld",
                        contextVersion: "9",
                        schemaVersion: "9",
                        types: ["connect"],
                        schemas: {
                            messages: {},
                            credentials: {},
                        },
                    },
                ],
            });

            expect(() => sc.contextFor("irc")).to.throw(
                "unknown platform 'irc'",
            );
        });
    });

    describe("event handling", () => {
        it("activity-object", (done) => {
            socket.emit("activity-object", { foo: "bar" });
            setTimeout(() => {
                sandbox.assert.calledWith(asInstance.Object.create, {
                    foo: "bar",
                });
                done();
            }, 0);
        });

        it("activity-object-create", (done) => {
            asInstance.emit("activity-object-create", { foo: "bar" });
            setTimeout(() => {
                expect(socket.emit.callCount).to.equal(1);
                expect(
                    socket.emit.calledWithMatch("activity-object", {
                        foo: "bar",
                    }),
                ).to.be.true;
                done();
            }, 0);
        });

        it("connect", (done) => {
            expect(sc.socket.connected).to.be.false;
            socket.io = {};
            socket.on("schemas", (ack: any) => {
                if (typeof ack === "function") {
                    ack({
                        contexts: {
                            as: "https://example.com/as2",
                            sockethub: "https://example.com/sh",
                        },
                        platforms: [],
                    });
                }
            });
            sc.socket.on("connect", () => {
                expect(sc.socket.connected).to.be.true;
                expect(sc.socket._emit.callCount).to.be.greaterThanOrEqual(1);
                expect(sc.socket._emit.calledWithMatch("connect"));
                expect(socket.emit.calledWithMatch("schemas")).to.be.true;
                done();
            });
            socket.emit("connect");
        });

        it("disconnect", (done) => {
            sc.socket.connected = true;
            sc.socket.on("disconnect", () => {
                expect(sc.socket.connected).to.be.false;
                expect(sc.socket._emit.callCount).to.equal(1);
                expect(sc.socket._emit.calledWithMatch("disconnect"));
                done();
            });
            socket.emit("disconnect");
        });

        it("connect_error", (done) => {
            sc.socket.on("connect_error", () => {
                expect(sc.socket._emit.callCount).to.equal(1);
                expect(sc.socket._emit.calledWithMatch("connect_error"));
                done();
            });
            socket.emit("connect_error");
        });

        it("schemas", (done) => {
            sc.socket.on("schemas", (registry: any) => {
                expect(registry.contexts).to.eql({
                    as: "https://example.com/as2",
                    sockethub: "https://example.com/sh",
                });
                expect(registry.platforms).to.be.an("array");
                expect(registry.platforms[0]?.id).to.equal("xmpp");
                done();
            });
            socket.emit("schemas", {
                contexts: {
                    as: "https://example.com/as2",
                    sockethub: "https://example.com/sh",
                },
                platforms: [
                    {
                        id: "xmpp",
                        contextUrl:
                            "https://example.com/context/platform/xmpp/v9.jsonld",
                        contextVersion: "9",
                        schemaVersion: "9",
                        types: ["connect"],
                        schemas: {
                            messages: {},
                            credentials: {},
                        },
                    },
                ],
            });
        });

        it("message", (done) => {
            sc.socket.on("message", () => {
                expect(sc.socket._emit.callCount).to.equal(1);
                expect(sc.socket._emit.calledWithMatch("message"));
                done();
            });
            socket.emit("message");
        });
    });

    describe("event emitting", () => {
        it("message (no actor)", () => {
            sc._socket.connected = true;
            const callback = () => {
            };
            expect(() => {
                sc.socket.emit("message", { foo: "bar" }, callback);
            }).to.throw("actor property not present");
        });

        it("message", (done) => {
            sc.socket.connected = true;
            const callback = () => {};
            socket.once("message", (data: any, cb: any) => {
                expect(data).to.be.eql({ actor: { id: "bar" }, type: "bar" });
                expect(cb).to.be.eql(callback);
                done();
            });
            sc.socket.emit("message", { actor: "bar", type: "bar" }, callback);
        });

        it("message (join)", (done) => {
            sc.socket.connected = true;
            const callback = () => {};
            socket.once("message", (data: any, cb: any) => {
                expect(data).to.be.eql({ actor: { id: "bar" }, type: "join" });
                expect(cb).to.be.eql(callback);
                done();
            });
            sc.socket.emit("message", { actor: "bar", type: "join" }, callback);
        });

        it("message (leave)", (done) => {
            sc.socket.connected = true;
            const callback = () => {};
            socket.once("message", (data: any, cb: any) => {
                expect(data).to.be.eql({ actor: { id: "bar" }, type: "leave" });
                expect(cb).to.be.eql(callback);
                done();
            });
            sc.socket.emit(
                "message",
                { actor: "bar", type: "leave" },
                callback,
            );
        });

        it("message (connect)", (done) => {
            sc.socket.connected = true;
            const callback = () => {};
            socket.once("message", (data: any, cb: any) => {
                expect(data).to.be.eql({
                    actor: { id: "bar" },
                    type: "connect",
                });
                expect(cb).to.be.eql(callback);
                done();
            });
            sc.socket.emit(
                "message",
                { actor: "bar", type: "connect" },
                callback,
            );
        });

        it("message (disconnect)", (done) => {
            sc.socket.connected = true;
            const callback = () => {};
            socket.once("message", (data: any, cb: any) => {
                expect(data).to.be.eql({
                    actor: { id: "bar" },
                    type: "disconnect",
                });
                expect(cb).to.be.eql(callback);
                done();
            });
            sc.socket.emit(
                "message",
                { actor: "bar", type: "disconnect" },
                callback,
            );
        });

        it("message (offline)", (done) => {
            sc.socket.connected = false;
            const callback = () => {};
            socket.once("message", (data: any, cb: any) => {
                expect(data).to.be.eql({ actor: { id: "bar" } });
                expect(cb).to.be.eql(callback);
                done();
            });
            sc.socket.emit("message", { actor: "bar" }, callback);
        });

        it("activity-object", (done) => {
            sc.socket.connected = true;
            const callback = () => {};
            socket.once("activity-object", (data: any, cb: any) => {
                expect(data).to.be.eql({ actor: "bar" });
                expect(cb).to.be.eql(callback);
                done();
            });
            sc.socket.emit("activity-object", { actor: "bar" }, callback);
        });

        it("credentials", (done) => {
            sc.socket.connected = true;
            const callback = () => {};
            socket.once("credentials", (data: any, cb: any) => {
                expect(data).to.be.eql({ actor: { id: "bar", type: "person" } });
                expect(cb).to.be.eql(callback);
                done();
            });
            sc.socket.emit("credentials", { actor: "bar" }, callback);
        });
    });

    describe("replay functionality", () => {
        it("replays map values, not [key, val] pairs", (done) => {
            // Directly populate the activity-object map to test replay
            const testObj = { id: "test1", type: "like", content: "test" };
            sc.events["activity-object"].set("test1", testObj);

            // Reset socket spy and trigger replay
            socket.emit.resetHistory();
            socket.emit("connect");

            setTimeout(() => {
                const replayCalls = socket.emit.getCalls().filter(call => call.args[0] === "activity-object");

                expect(replayCalls).to.have.length(1);
                expect(replayCalls[0].args[1]).to.deep.equal(testObj);
                expect(Array.isArray(replayCalls[0].args[1])).to.be.false;

                done();
            }, 0);
        });

        it("does not call ActivityStreams.Stream() on activity-objects", (done) => {
            // Store an activity-object directly
            const activityObject = {
                id: "test-actor@example.com",
                type: "person",
                name: "Test Actor",
            };
            sc.events["activity-object"].set(activityObject.id, activityObject);

            // Reset spies
            socket.emit.resetHistory();
            asInstance.Stream.resetHistory();

            // Trigger reconnect which calls replay
            socket.emit("connect");

            setTimeout(() => {
                // Stream() should NOT be called for activity-objects
                const streamCalls = asInstance.Stream.getCalls();
                const activityObjectStreamCalls = streamCalls.filter(
                    (call: any) => call.args[0]?.id === "test-actor@example.com",
                );
                expect(activityObjectStreamCalls).to.have.length(0);

                // But the activity-object should still be emitted
                const replayCalls = socket.emit
                    .getCalls()
                    .filter((call: any) => call.args[0] === "activity-object");
                expect(replayCalls).to.have.length(1);
                expect(replayCalls[0].args[1]).to.deep.equal(activityObject);

                done();
            }, 0);
        });

        it("calls ActivityStreams.Stream() on credentials during replay", (done) => {
            // Store credentials
            const credentials = {
                actor: { id: "user@example.com", type: "person" },
                object: { type: "credentials", password: "secret" },
            };
            sc.events.credentials.set(credentials.actor.id, credentials);

            // Reset spies
            socket.emit.resetHistory();
            asInstance.Stream.resetHistory();

            // Trigger reconnect
            socket.emit("connect");

            setTimeout(() => {
                // Stream() SHOULD be called for credentials
                expect(asInstance.Stream.called).to.be.true;

                // Credentials should be emitted
                const replayCalls = socket.emit
                    .getCalls()
                    .filter((call: any) => call.args[0] === "credentials");
                expect(replayCalls).to.have.length(1);

                done();
            }, 0);
        });
    });

    describe("clearCredentials", () => {
        it("clears stored credentials", () => {
            // Store some credentials
            sc.socket.emit("credentials", {
                actor: { id: "user@example.com" },
                object: { type: "credentials", username: "user", password: "pass" },
            });

            // Verify credentials are stored
            expect(sc.events.credentials.size).to.equal(1);

            // Clear credentials
            sc.clearCredentials();

            // Verify credentials are cleared
            expect(sc.events.credentials.size).to.equal(0);
        });

        it("prevents credential replay after clearing", (done) => {
            // Store credentials
            sc.socket.emit("credentials", {
                actor: { id: "user@example.com" },
                object: { type: "credentials", username: "user", password: "pass" },
            });

            // Clear credentials
            sc.clearCredentials();

            // Trigger reconnect
            let replayAttempts = 0;
            socket.on("credentials", () => {
                replayAttempts++;
            });

            socket.emit("connect");

            setTimeout(() => {
                // No credentials should have been replayed
                expect(replayAttempts).to.equal(0);
                done();
            }, 10);
        });
    });
});
