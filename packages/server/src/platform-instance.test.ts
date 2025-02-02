import {expect, describe, it, beforeEach, afterEach} from "bun:test";
import * as sinon from "sinon";
import { __dirname } from "./util.js";
const FORK_PATH = __dirname + "/platform.js";

import PlatformInstance, { platformInstances } from "./platform-instance.js";

describe("PlatformInstance", () => {
    let pi, sandbox, forkFake, socketMock, getSocketFake;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        socketMock = {
            emit: sandbox.spy(),
        };
        getSocketFake = sinon.fake.resolves(socketMock);
        forkFake = sandbox.fake();
    });

    function getTestPlatformInstanceClass() {
        class TestPlatformInstance extends PlatformInstance {
            createQueue() {
                this.JobQueue = sandbox.stub().returns({
                    shutdown: sandbox.stub(),
                    on: sandbox.stub(),
                    getJob: sandbox.stub(),
                    initResultEvents: sandbox.stub(),
                });
            }

            initProcess(parentId, name, id, env) {
                this.process = forkFake(FORK_PATH, [parentId, name, id], env);
            }

            createGetSocket() {
                this.getSocket = getSocketFake;
            }
        }
        return TestPlatformInstance;
    }

    afterEach(() => {
        sinon.restore();
    });

    describe("private instance per-actor", () => {
        it("is set as non-global when an actor is provided", async () => {
            const TestPlatformInstance = getTestPlatformInstanceClass();
            const pi = new TestPlatformInstance({
                identifier: "id",
                platform: "name",
                parentId: "parentId",
                actor: "actor string",
            });
            expect(pi.global).toEqual(false);
            sandbox.assert.calledWith(forkFake, FORK_PATH, [
                "parentId",
                "name",
                "id",
            ]);
            await pi.shutdown();
        });
    });

    describe("PlatformInstance objects", () => {
        beforeEach(() => {
            const TestPlatformInstance = getTestPlatformInstanceClass();
            pi = new TestPlatformInstance({
                identifier: "platform identifier",
                platform: "a platform name",
                parentId: "the parentId",
            });
            platformInstances.set(pi.id, pi);

            pi.process = {
                on: sandbox.spy(),
                removeListener: sandbox.spy(),
                removeAllListeners: sandbox.spy(),
                unref: sandbox.spy(),
                kill: sandbox.spy(),
            };
        });

        afterEach(async () => {
            await pi.shutdown();
        });

        it("has expected properties", () => {
            const TestPlatformInstance = getTestPlatformInstanceClass();
            expect(typeof TestPlatformInstance).toEqual("function");
        });

        it("should have a platformInstances Map", () => {
            expect(platformInstances instanceof Map).toEqual(true);
        });

        it("has certain accessible properties", () => {
            expect(pi.id).toEqual("platform identifier");
            expect(pi.name).toEqual("a platform name");
            expect(pi.parentId).toEqual("the parentId");
            expect(pi.flaggedForTermination).toEqual(false);
            expect(pi.global).toEqual(true);
            expect(
                forkFake.calledWith(FORK_PATH, [
                    "the parentId",
                    "a platform name",
                    "platform identifier",
                ]),
            ).toEqual(true);
        });

        describe("registerSession", () => {
            beforeEach(() => {
                pi.callbackFunction = sandbox.fake();
            });

            it("adds a close and message handler when a session is registered", () => {
                pi.registerSession("my session id");
                expect(pi.callbackFunction.callCount).toEqual(2);
                sandbox.assert.calledWith(
                    pi.callbackFunction,
                    "close",
                    "my session id",
                );
                sandbox.assert.calledWith(
                    pi.callbackFunction,
                    "message",
                    "my session id",
                );
                expect(pi.sessions.has("my session id")).toEqual(true);
            });

            it("is able to generate failure reports", () => {
                pi.registerSession("my session id");
                expect(pi.sessions.has("my session id")).toEqual(true);
                pi.reportError("my session id", "an error message");
                pi.sendToClient = sandbox.stub();
                pi.shutdown = sandbox.stub();
                expect(pi.sessions.size).toEqual(0);
            });
        });

        it("initializes the job queue", () => {
            expect(pi.queue).toBeUndefined();
            pi.initQueue("a secret");
            expect(pi.queue).toBeDefined()
        });

        it("cleans up its references when shutdown", async () => {
            pi.initQueue("a secret");
            expect(pi.queue).toBeDefined()
            expect(platformInstances.has("platform identifier")).toBeTrue();
            await pi.shutdown();
            expect(pi.queue).toBeUndefined()
            expect(platformInstances.has("platform identifier")).toBeFalse();
        });

        it("updates its identifier when changed", () => {
            pi.updateIdentifier("foo bar");
            expect(pi.id).toEqual("foo bar");
            expect(platformInstances.has("platform identifier")).toBeFalse();
            expect(platformInstances.has("foo bar")).toBeTrue();
        });

        it("sends messages to client using socket session id", async () => {
            await pi.sendToClient("my session id", {
                foo: "this is a message object",
                sessionSecret: "private data",
            });
            expect(getSocketFake.callCount).toEqual(1);
            sandbox.assert.calledOnce(getSocketFake);
            sandbox.assert.calledWith(getSocketFake, "my session id");
            sandbox.assert.calledOnce(socketMock.emit);
            sandbox.assert.calledWith(socketMock.emit, "message", {
                foo: "this is a message object",
                context: "a platform name",
            });
        });

        it("broadcasts to peers", async () => {
            pi.sessions.add("other peer");
            pi.sessions.add("another peer");
            await pi.broadcastToSharedPeers("myself", { foo: "bar" });
            expect(getSocketFake.callCount).toEqual(2);
            sandbox.assert.calledWith(getSocketFake, "other peer");
        });

        describe("handleJobResult", () => {
            beforeEach(() => {
                pi.sendToClient = sandbox.fake();
                pi.broadcastToSharedPeers = sandbox.fake();
                pi.config = { persist: false };
            });

            it("broadcasts to peers when handling a completed job", async () => {
                pi.sessions.add("other peer");
                await pi.handleJobResult(
                    "completed",
                    { msg: { foo: "bar" } },
                    undefined,
                );
                expect(pi.sendToClient.callCount).toEqual(1);
                expect(pi.broadcastToSharedPeers.callCount).toEqual(1);
            });

            it("appends completed result message when present", async () => {
                await pi.handleJobResult(
                    "completed",
                    { sessionId: "a session id", msg: { foo: "bar" } },
                    "a good result message",
                );
                expect(pi.broadcastToSharedPeers.callCount).toEqual(1);
                sandbox.assert.calledWith(pi.sendToClient, "a session id", {
                    foo: "bar",
                });
            });

            it("appends failed result message when present", async () => {
                await pi.handleJobResult(
                    "failed",
                    { sessionId: "a session id", msg: { foo: "bar" } },
                    "a bad result message",
                );
                expect(pi.broadcastToSharedPeers.callCount).toEqual(1);
                sandbox.assert.calledWith(pi.sendToClient, "a session id", {
                    foo: "bar",
                    error: "a bad result message",
                });
            });
        });

        describe("callbackFunction", () => {
            beforeEach(() => {
                pi.reportError = sandbox.fake();
                pi.sendToClient = sandbox.fake();
                pi.updateIdentifier = sandbox.fake();
            });

            it("close events from platform thread are reported", () => {
                const close = pi.callbackFunction("close", "my session id");
                close("error msg");
                sandbox.assert.calledWith(
                    pi.reportError,
                    "my session id",
                    "Error: session thread closed unexpectedly: error msg",
                );
            });

            it("message events from platform thread are route based on command: error", () => {
                const message = pi.callbackFunction("message", "my session id");
                message(["error", "error message"]);
                sandbox.assert.calledWith(
                    pi.reportError,
                    "my session id",
                    "error message",
                );
            });

            it("message events from platform thread are route based on command: updateActor", () => {
                const message = pi.callbackFunction("message", "my session id");
                message(["updateActor", undefined, { foo: "bar" }]);
                sandbox.assert.calledWith(pi.updateIdentifier, { foo: "bar" });
            });

            it("message events from platform thread are route based on command: else", () => {
                const message = pi.callbackFunction("message", "my session id");
                message(["blah", { foo: "bar" }]);
                sandbox.assert.calledWith(pi.sendToClient, "my session id", {
                    foo: "bar",
                });
            });
        });
    });
});
