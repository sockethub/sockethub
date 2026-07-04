import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as sinon from "sinon";
import {
    addPlatformContext,
    addPlatformSchema,
    buildCanonicalContext,
    INTERNAL_PLATFORM_CONTEXT_URL,
} from "@sockethub/schemas";

// A platform context with an outbound `responses` schema (only allows
// type "collection"), used to exercise enforced outbound validation.
const RESPONSES_CTX =
    "https://sockethub.org/ns/context/platform/respplat/v1.jsonld";
addPlatformSchema(
    { required: ["type"], properties: { type: { enum: ["collection"] } } },
    "respplat/responses",
);
addPlatformContext("respplat", RESPONSES_CTX);
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
        // getSocket is a synchronous lookup that returns the socket or
        // undefined when no socket is connected for the session.
        getSocketFake = sinon.fake.returns(socketMock);
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
        test("is set as non-global when an actor is provided", async () => {
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

        test("has expected properties", () => {
            const TestPlatformInstance = getTestPlatformInstanceClass();
            expect(typeof TestPlatformInstance).toEqual("function");
        });

        test("should have a platformInstances Map", () => {
            expect(platformInstances instanceof Map).toEqual(true);
        });

        test("has certain accessible properties", () => {
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
            test("tracks the session without adding process listeners", () => {
                pi.registerSession("my session id");
                expect(pi.sessions.has("my session id")).toEqual(true);
                // sessions no longer register per-session process listeners
                sandbox.assert.notCalled(pi.process.on);
            });

            test("is able to generate failure reports", async () => {
                pi.registerSession("my session id");
                expect(pi.sessions.has("my session id")).toEqual(true);
                pi.sendToClient = sandbox.stub();
                pi.shutdown = sandbox.stub();
                await pi.broadcastFatalError("an error message");
                sandbox.assert.calledWith(
                    pi.sendToClient,
                    "my session id",
                    sinon.match({ error: "an error message" }),
                );
                expect(pi.sessions.size).toEqual(0);
            });
        });

        test("initializes the job queue", () => {
            expect(pi.queue).toBeUndefined();
            pi.initQueue("a secret");
            expect(pi.queue).toBeDefined();
        });

        test("cleans up its references when shutdown", async () => {
            pi.initQueue("a secret");
            expect(pi.queue).toBeDefined();
            expect(platformInstances.has("platform identifier")).toBeTrue();
            await pi.shutdown();
            expect(pi.queue).toBeUndefined();
            expect(platformInstances.has("platform identifier")).toBeFalse();
        });

        test("updates its identifier when changed", () => {
            pi.updateIdentifier("foo bar");
            expect(pi.id).toEqual("foo bar");
            expect(platformInstances.has("platform identifier")).toBeFalse();
            expect(platformInstances.has("foo bar")).toBeTrue();
        });

        test("sends messages to client using socket session id", async () => {
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
                "@context": buildCanonicalContext(
                    INTERNAL_PLATFORM_CONTEXT_URL,
                ),
            });
        });

        test("injects platform-specific @context when contextUrl is set", async () => {
            const testContextUrl =
                "https://sockethub.org/ns/context/platform/dummy/v1.jsonld";
            pi.contextUrl = testContextUrl;
            await pi.sendToClient("my session id", {
                type: "echo",
                actor: { id: "test@dummy", type: "person" },
            });
            sandbox.assert.calledOnce(socketMock.emit);
            const emittedMsg = socketMock.emit.firstCall.args[1];
            expect(emittedMsg["@context"]).toEqual(
                buildCanonicalContext(testContextUrl),
            );
        });

        test("strips legacy context field from outbound payloads", async () => {
            await pi.sendToClient("my session id", {
                type: "echo",
                context: "dummy",
                actor: { id: "test@dummy", type: "person" },
            });
            const emittedMsg = socketMock.emit.firstCall.args[1];
            expect(emittedMsg.context).toBeUndefined();
            expect(emittedMsg["@context"]).toBeDefined();
        });

        test("broadcasts to peers", async () => {
            pi.sessions.add("other peer");
            pi.sessions.add("another peer");
            await pi.broadcastToSharedPeers("myself", { foo: "bar" });
            expect(getSocketFake.callCount).toEqual(2);
            sandbox.assert.calledWith(getSocketFake, "other peer");
        });

        test("skips delivery (no emit, no error) when the socket is not connected", () => {
            // Simulate a disconnected session in the janitor grace window.
            getSocketFake = sinon.fake.returns(undefined);
            pi.getSocket = getSocketFake;
            const errorSpy = sandbox.spy(pi.log, "error");

            pi.sendToClient("disconnected session", { foo: "bar" });

            sandbox.assert.calledOnce(getSocketFake);
            sandbox.assert.notCalled(socketMock.emit);
            sandbox.assert.notCalled(errorSpy);
        });

        test("broadcastToSharedPeers delivers only to connected peers", async () => {
            // "live peer" is connected; "stale peer" is not (returns undefined).
            const liveSocket = { emit: sandbox.spy() };
            getSocketFake = sinon.fake((id) =>
                id === "live peer" ? liveSocket : undefined,
            );
            pi.getSocket = getSocketFake;
            const errorSpy = sandbox.spy(pi.log, "error");

            pi.sessions.add("live peer");
            pi.sessions.add("stale peer");
            await pi.broadcastToSharedPeers("myself", {
                type: "message",
                actor: { id: "actor@dummy", type: "person" },
            });

            sandbox.assert.calledOnce(liveSocket.emit);
            sandbox.assert.notCalled(errorSpy);
        });

        test("drops (no emit) an outbound message that violates the responses schema", () => {
            pi.contextUrl = RESPONSES_CTX;
            const errorSpy = sandbox.spy(pi.log, "error");
            pi.sendToClient("my session id", {
                type: "page", // not allowed by respplat responses schema
                actor: { id: "a@b", type: "feed" },
            });
            sandbox.assert.calledOnce(errorSpy);
            sandbox.assert.notCalled(socketMock.emit); // enforced: dropped
        });

        test("delivers an outbound message that matches the responses schema", () => {
            pi.contextUrl = RESPONSES_CTX;
            const errorSpy = sandbox.spy(pi.log, "error");
            pi.sendToClient("my session id", {
                type: "collection",
                actor: { id: "a@b", type: "feed" },
            });
            sandbox.assert.notCalled(errorSpy);
            sandbox.assert.calledOnce(socketMock.emit);
        });

        test("exempts error envelopes from responses-schema validation", () => {
            pi.contextUrl = RESPONSES_CTX;
            const errorSpy = sandbox.spy(pi.log, "error");
            // `error` is not in respplat's responses enum, but error envelopes
            // are exempt and must still be delivered.
            pi.sendToClient("my session id", {
                type: "error",
                actor: { id: "a@b", type: "service" },
                error: "boom",
            });
            sandbox.assert.notCalled(errorSpy);
            sandbox.assert.calledOnce(socketMock.emit);
        });

        test("injects a valid actor on actorless errors (global platform)", () => {
            // pi is constructed without an `actor` (global), so the fallback is
            // the platform name — never an undefined id.
            pi.sendToClient("my session id", { type: "error", error: "boom" });
            sandbox.assert.calledOnce(socketMock.emit);
            expect(socketMock.emit.firstCall.args[1].actor).toEqual({
                id: "a platform name",
                type: "service",
            });
        });

        test("exempts failure notifications (request echo + error) from validation", () => {
            pi.contextUrl = RESPONSES_CTX;
            const errorSpy = sandbox.spy(pi.log, "error");
            // A failed job echoes the original request (an inbound type, not in
            // the responses enum) plus an `error` field; it must still deliver.
            pi.sendToClient("my session id", {
                type: "fetch", // inbound type, not a respplat response type
                actor: { id: "a@b", type: "feed" },
                error: "job failed",
            });
            sandbox.assert.notCalled(errorSpy);
            sandbox.assert.calledOnce(socketMock.emit);
        });

        test("broadcastFatalError emits a valid service actor for a global platform", async () => {
            pi.sessions.add("my session id");
            await pi.broadcastFatalError("boom");
            sandbox.assert.calledOnce(socketMock.emit);
            const emitted = socketMock.emit.firstCall.args[1];
            expect(emitted.type).toEqual("error");
            expect(emitted.actor).toEqual({
                id: "a platform name",
                type: "service",
            });
            expect(emitted.error).toEqual("boom");
        });

        describe("handleJobResult", () => {
            beforeEach(() => {
                pi.sendToClient = sandbox.fake();
                pi.broadcastToSharedPeers = sandbox.fake();
                pi.config = { persist: false };
            });

            test("broadcasts to peers when handling a completed job", async () => {
                pi.sessions.add("other peer");
                await pi.handleJobResult(
                    "completed",
                    { msg: { foo: "bar" } },
                    undefined,
                );
                expect(pi.sendToClient.callCount).toEqual(1);
                expect(pi.broadcastToSharedPeers.callCount).toEqual(1);
            });

            test("appends completed result message when present", async () => {
                await pi.handleJobResult(
                    "completed",
                    { sessionId: "a session id", msg: { foo: "bar" } },
                    "a good result message",
                );
                expect(pi.broadcastToSharedPeers.callCount).toEqual(1);
                sandbox.assert.calledWith(pi.sendToClient, "a session id", {
                    foo: "bar",
                    "@context": buildCanonicalContext(
                        INTERNAL_PLATFORM_CONTEXT_URL,
                    ),
                });
            });

            test("appends failed result message when present", async () => {
                await pi.handleJobResult(
                    "failed",
                    { sessionId: "a session id", msg: { foo: "bar" } },
                    "a bad result message",
                );
                expect(pi.broadcastToSharedPeers.callCount).toEqual(1);
                sandbox.assert.calledWith(pi.sendToClient, "a session id", {
                    foo: "bar",
                    error: "a bad result message",
                    "@context": buildCanonicalContext(
                        INTERNAL_PLATFORM_CONTEXT_URL,
                    ),
                });
            });
        });

        describe("process event handlers", () => {
            beforeEach(() => {
                pi.broadcastFatalError = sandbox.fake();
                pi.sendToClient = sandbox.fake();
                pi.updateIdentifier = sandbox.fake();
            });

            test("unexpected close events are reported, regardless of process.connected", async () => {
                // `connected` is already false by the time `close` fires in real
                // usage (see the comment on handleProcessClose); the handler must
                // rely on flaggedForTermination alone, not on `connected`.
                pi.process.connected = false;
                pi.flaggedForTermination = false;
                pi.shutdown = sandbox.stub();

                await pi.handleProcessClose("error msg");
                sandbox.assert.calledWith(
                    pi.broadcastFatalError,
                    "Error: session thread closed unexpectedly: error msg",
                );
                sandbox.assert.called(pi.shutdown);
            });

            test("close events skip error reporting when flagged for termination", async () => {
                pi.process.connected = false;
                pi.flaggedForTermination = true;
                pi.shutdown = sandbox.stub();

                await pi.handleProcessClose("error msg");

                // Should NOT attempt to report error
                sandbox.assert.notCalled(pi.broadcastFatalError);
                // Should still shut down to clean up instance state
                sandbox.assert.called(pi.shutdown);
            });

            test("message events from platform thread are routed based on command: error", async () => {
                await pi.handleProcessMessage(["error", "error message"]);
                sandbox.assert.calledWith(
                    pi.broadcastFatalError,
                    "error message",
                );
            });

            test("message events from platform thread are routed based on command: updateActor", async () => {
                await pi.handleProcessMessage([
                    "updateActor",
                    undefined,
                    { foo: "bar" },
                ]);
                sandbox.assert.calledWith(pi.updateIdentifier, { foo: "bar" });
            });

            test("message events from platform thread are delivered to every registered session", async () => {
                pi.sessions.add("session one");
                pi.sessions.add("session two");
                await pi.handleProcessMessage(["blah", { foo: "bar" }]);
                sandbox.assert.calledWith(pi.sendToClient, "session one", {
                    foo: "bar",
                });
                sandbox.assert.calledWith(pi.sendToClient, "session two", {
                    foo: "bar",
                });
            });
        });
    });

    describe("credential failure handling", () => {
        let queueMock: any;
        let processMock: any;

        beforeEach(() => {
            queueMock = {
                pause: sandbox.stub().resolves(),
                resume: sandbox.stub().resolves(),
                shutdown: sandbox.stub().resolves(),
                on: sandbox.stub(),
                getJob: sandbox.stub(),
                initResultEvents: sandbox.stub(),
            };

            processMock = {
                removeAllListeners: sandbox.stub(),
                unref: sandbox.stub(),
                kill: sandbox.stub(),
            };
        });

        describe("POSITIVE: Platform initialized - credential failure should NOT terminate", () => {
            test("should keep platform alive when credential job fails on initialized platform", async () => {
                const TestPlatformInstance = getTestPlatformInstanceClass();
                pi = new TestPlatformInstance({
                    identifier: "test-platform-id",
                    platform: "xmpp",
                    parentId: "test-parent",
                    actor: "testuser@localhost",
                });

                // Override queue with our mock
                pi.queue = queueMock;
                pi.process = processMock;

                // Setup: Platform is already initialized
                pi.config = {
                    persist: true,
                    requireCredentials: ["connect"],
                };
                pi["initialized"] = true; // Set private property for test
                pi.flaggedForTermination = false;

                const job = {
                    sessionId: "session123",
                    msg: {
                        type: "connect",
                        actor: { id: "testuser@localhost", type: "person" },
                    },
                    title: "xmpp-1",
                    sessionSecret: "secret",
                };

                const errorResult = "credentials mismatch for testuser@localhost";

                pi.sendToClient = sandbox.stub();

                // Simulate job failure
                await pi.handleJobResult("failed", job, errorResult);

                // ASSERTIONS
                // 1. Platform should NOT be flagged for termination
                expect(pi.flaggedForTermination).toBe(false);

                // 2. Queue should NOT be paused
                sinon.assert.notCalled(queueMock.pause);

                // 3. Platform should remain initialized
                expect(pi.isInitialized()).toBe(true);

                // 4. Error should still be sent to client
                sinon.assert.called(pi.sendToClient);
            });

            test("should allow subsequent jobs after non-fatal credential error", async () => {
                const TestPlatformInstance = getTestPlatformInstanceClass();
                pi = new TestPlatformInstance({
                    identifier: "test-platform-id",
                    platform: "xmpp",
                    parentId: "test-parent",
                    actor: "testuser@localhost",
                });

                pi.queue = queueMock;
                pi.process = processMock;

                pi.config = {
                    persist: true,
                    requireCredentials: ["connect"],
                };
                pi["initialized"] = true; // Set private property for test
                pi.flaggedForTermination = false;
                pi.sendToClient = sandbox.stub();

                const failedJob = {
                    sessionId: "session123",
                    msg: {
                        type: "connect",
                        actor: { id: "testuser@localhost", type: "person" },
                    },
                    title: "xmpp-1",
                    sessionSecret: "secret",
                };

                // First job fails with credential error
                await pi.handleJobResult("failed", failedJob, "credential error");

                // Platform should still be operational
                expect(pi.flaggedForTermination).toBe(false);
                expect(pi.isInitialized()).toBe(true);

                // Second job succeeds
                const successJob = {
                    sessionId: "session456",
                    msg: {
                        type: "send",
                        actor: { id: "testuser@localhost", type: "person" },
                    },
                    title: "xmpp-2",
                    sessionSecret: "secret",
                };

                await pi.handleJobResult("completed", successJob, undefined);

                // Platform should still be alive
                expect(pi.flaggedForTermination).toBe(false);
                expect(pi.isInitialized()).toBe(true);
            });
        });

        describe("NEGATIVE: Platform NOT initialized - credential failure SHOULD terminate", () => {
            test("should terminate platform when credential job fails on uninitialized platform", async () => {
                const TestPlatformInstance = getTestPlatformInstanceClass();
                pi = new TestPlatformInstance({
                    identifier: "test-platform-id",
                    platform: "xmpp",
                    parentId: "test-parent",
                    actor: "testuser@localhost",
                });

                pi.queue = queueMock;
                pi.process = processMock;

                // Setup: Platform is NOT initialized
                pi.config = {
                    persist: true,
                    initialized: false,
                    requireCredentials: ["connect"],
                };
                pi.flaggedForTermination = false;
                pi.sendToClient = sandbox.stub();

                const job = {
                    sessionId: "session123",
                    msg: {
                        type: "connect",
                        actor: { id: "testuser@localhost", type: "person" },
                    },
                    title: "xmpp-1",
                    sessionSecret: "secret",
                };

                const errorResult = "invalid credentials for testuser@localhost";

                // Simulate job failure on uninitialized platform
                await pi.handleJobResult("failed", job, errorResult);

                // ASSERTIONS
                // 1. Platform SHOULD be flagged for termination
                expect(pi.flaggedForTermination).toBe(true);

                // 2. Queue SHOULD be paused
                sinon.assert.calledOnce(queueMock.pause);

                // 3. Platform should remain uninitialized
                expect(pi.isInitialized()).toBe(false);

                // 4. Error should still be sent to client
                sinon.assert.called(pi.sendToClient);
            });

            test("should pause queue when credential initialization fails", async () => {
                const TestPlatformInstance = getTestPlatformInstanceClass();
                pi = new TestPlatformInstance({
                    identifier: "test-platform-id",
                    platform: "xmpp",
                    parentId: "test-parent",
                    actor: "testuser@localhost",
                });

                pi.queue = queueMock;
                pi.process = processMock;

                pi.config = {
                    persist: true,
                    initialized: false,
                    requireCredentials: ["connect"],
                };
                pi.sendToClient = sandbox.stub();

                const job = {
                    sessionId: "session123",
                    msg: {
                        type: "connect",
                        actor: { id: "testuser@localhost", type: "person" },
                    },
                    title: "xmpp-1",
                    sessionSecret: "secret",
                };

                await pi.handleJobResult("failed", job, "connection failed");

                // Queue must be paused
                sinon.assert.calledOnce(queueMock.pause);
            });
        });
    });
});
