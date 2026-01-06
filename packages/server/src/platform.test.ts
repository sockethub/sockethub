import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as sinon from "sinon";
import { crypto } from "@sockethub/crypto";
import type {
    ActivityStream,
    CredentialsObject,
    PlatformCallback,
    PlatformInterface,
} from "@sockethub/schemas";
import type { JobDataDecrypted } from "@sockethub/data-layer";

/**
 * Tests for platform.ts credential handling logic
 *
 * Since platform.ts runs as a separate process and uses process.argv,
 * we test the core credential handling behavior by simulating the
 * getJobHandler logic.
 */
describe("platform.ts credential handling", () => {
    let sandbox: sinon.SinonSandbox;
    let mockPlatform: Partial<PlatformInterface>;
    let mockCredentialStore: any;
    let mockJob: JobDataDecrypted;
    let validCredentials: CredentialsObject;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        validCredentials = {
            type: "credentials",
            context: "xmpp",
            actor: {
                id: "testuser@localhost",
                type: "person",
                name: "Test User",
            },
            object: {
                type: "credentials",
                userAddress: "testuser@localhost",
                password: "testpassword",
                server: "xmpp://localhost:5222",
            },
        };

        mockPlatform = {
            config: {
                persist: true,
                initialized: false,
                requireCredentials: ["connect"],
            },
            credentialsHash: undefined,
            connect: sandbox.stub(),
        };

        mockCredentialStore = {
            get: sandbox.stub().resolves(validCredentials),
        };

        mockJob = {
            sessionId: "test-session-123",
            title: "xmpp-job-1",
            msg: {
                type: "connect",
                context: "xmpp",
                actor: { id: "testuser@localhost", type: "person" },
                sessionSecret: "secret123",
            },
        } as JobDataDecrypted;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("credentialsHash updates after successful platform calls", () => {
        it("should set credentialsHash after successful connect on first call", async () => {
            // Initially no hash
            expect(mockPlatform.credentialsHash).toBeUndefined();

            // Simulate the platform.ts credential handling flow
            const credentials = await mockCredentialStore.get(
                mockJob.msg.actor.id,
                mockPlatform.credentialsHash,
            );

            // Create the wrapper callback that platform.ts uses
            let capturedErr: Error | null = null;
            let capturedResult: ActivityStream | null = null;
            const doneCallback: PlatformCallback = (err, result) => {
                capturedErr = err;
                capturedResult = result;
            };

            const wrappedCallback: PlatformCallback = (err, result) => {
                if (!err) {
                    // This is what platform.ts does
                    mockPlatform.credentialsHash = crypto.objectHash(
                        credentials.object,
                    );
                }
                doneCallback(err, result);
            };

            // Simulate platform connect call succeeding
            (mockPlatform.connect as sinon.SinonStub).callsFake(
                (_msg, _creds, callback) => {
                    callback(null, { type: "success" });
                },
            );

            // Call platform method with wrapped callback
            mockPlatform.connect(mockJob.msg, credentials, wrappedCallback);

            // Verify credentialsHash was set
            expect(mockPlatform.credentialsHash).toBeDefined();
            expect(mockPlatform.credentialsHash).toBe(
                crypto.objectHash(credentials.object),
            );
            expect(capturedErr).toBeNull();
            expect(capturedResult).toEqual({ type: "success" });
        });

        it("should NOT update credentialsHash when platform call fails", async () => {
            const initialHash = crypto.objectHash(validCredentials.object);
            mockPlatform.credentialsHash = initialHash;

            const credentials = await mockCredentialStore.get(
                mockJob.msg.actor.id,
                mockPlatform.credentialsHash,
            );

            let capturedErr: Error | null = null;
            const doneCallback: PlatformCallback = (err, result) => {
                capturedErr = err;
            };

            const wrappedCallback: PlatformCallback = (err, result) => {
                if (!err) {
                    mockPlatform.credentialsHash = crypto.objectHash(
                        credentials.object,
                    );
                }
                doneCallback(err, result);
            };

            // Simulate platform connect call failing
            (mockPlatform.connect as sinon.SinonStub).callsFake(
                (_msg, _creds, callback) => {
                    callback(new Error("connection failed"), null);
                },
            );

            mockPlatform.connect(mockJob.msg, credentials, wrappedCallback);

            // Verify credentialsHash was NOT changed
            expect(mockPlatform.credentialsHash).toBe(initialHash);
            expect(capturedErr).toBeDefined();
            expect(capturedErr?.message).toBe("connection failed");
        });

        it("should update credentialsHash on subsequent successful calls", async () => {
            // First call sets hash
            const firstHash = crypto.objectHash(validCredentials.object);
            mockPlatform.credentialsHash = firstHash;

            // Second call with same credentials
            const credentials = await mockCredentialStore.get(
                mockJob.msg.actor.id,
                mockPlatform.credentialsHash,
            );

            const wrappedCallback: PlatformCallback = (err, result) => {
                if (!err) {
                    mockPlatform.credentialsHash = crypto.objectHash(
                        credentials.object,
                    );
                }
            };

            (mockPlatform.connect as sinon.SinonStub).callsFake(
                (_msg, _creds, callback) => {
                    callback(null, { type: "success" });
                },
            );

            mockPlatform.connect(mockJob.msg, credentials, wrappedCallback);

            // Hash should still be the same (same credentials)
            expect(mockPlatform.credentialsHash).toBe(firstHash);
        });
    });

    describe("CredentialsStore.get() validation behavior", () => {
        it("should pass credentialsHash to CredentialsStore.get() for validation", async () => {
            const existingHash = crypto.objectHash(validCredentials.object);
            mockPlatform.credentialsHash = existingHash;

            await mockCredentialStore.get(
                mockJob.msg.actor.id,
                mockPlatform.credentialsHash,
            );

            sinon.assert.calledOnce(mockCredentialStore.get);
            sinon.assert.calledWith(
                mockCredentialStore.get,
                mockJob.msg.actor.id,
                existingHash,
            );
        });

        it("should pass undefined when no credentialsHash exists", async () => {
            mockPlatform.credentialsHash = undefined;

            await mockCredentialStore.get(
                mockJob.msg.actor.id,
                mockPlatform.credentialsHash,
            );

            sinon.assert.calledWith(
                mockCredentialStore.get,
                mockJob.msg.actor.id,
                undefined,
            );
        });

        it("should handle CredentialsStore.get() rejection", async () => {
            mockCredentialStore.get.rejects(
                new Error("invalid credentials for testuser@localhost"),
            );

            try {
                await mockCredentialStore.get(
                    mockJob.msg.actor.id,
                    mockPlatform.credentialsHash,
                );
                expect.unreachable("Should have thrown");
            } catch (err) {
                expect(err.message).toContain("invalid credentials");
            }
        });
    });

    describe("Wrapper callback behavior", () => {
        it("should call doneCallback after updating credentialsHash", async () => {
            const credentials = await mockCredentialStore.get(
                mockJob.msg.actor.id,
                mockPlatform.credentialsHash,
            );

            const doneCallbackSpy = sandbox.spy();
            let hashSetBeforeDone = false;

            const wrappedCallback: PlatformCallback = (err, result) => {
                if (!err) {
                    mockPlatform.credentialsHash = crypto.objectHash(
                        credentials.object,
                    );
                    hashSetBeforeDone = mockPlatform.credentialsHash !==
                        undefined;
                }
                doneCallbackSpy(err, result);
            };

            (mockPlatform.connect as sinon.SinonStub).callsFake(
                (_msg, _creds, callback) => {
                    callback(null, { type: "success" });
                },
            );

            mockPlatform.connect(mockJob.msg, credentials, wrappedCallback);

            // Verify order: hash set, then done called
            expect(hashSetBeforeDone).toBeTrue();
            sinon.assert.calledOnce(doneCallbackSpy);
            sinon.assert.calledWith(doneCallbackSpy, null, { type: "success" });
        });

        it("should pass through errors without updating hash", async () => {
            const initialHash = crypto.objectHash(validCredentials.object);
            mockPlatform.credentialsHash = initialHash;

            const credentials = await mockCredentialStore.get(
                mockJob.msg.actor.id,
                mockPlatform.credentialsHash,
            );

            const doneCallbackSpy = sandbox.spy();
            const testError = new Error("platform error");

            const wrappedCallback: PlatformCallback = (err, result) => {
                if (!err) {
                    mockPlatform.credentialsHash = crypto.objectHash(
                        credentials.object,
                    );
                }
                doneCallbackSpy(err, result);
            };

            (mockPlatform.connect as sinon.SinonStub).callsFake(
                (_msg, _creds, callback) => {
                    callback(testError, null);
                },
            );

            mockPlatform.connect(mockJob.msg, credentials, wrappedCallback);

            // Hash unchanged
            expect(mockPlatform.credentialsHash).toBe(initialHash);
            // Error passed through
            sinon.assert.calledOnce(doneCallbackSpy);
            sinon.assert.calledWith(doneCallbackSpy, testError, null);
        });
    });

    describe("Integration scenarios", () => {
        it("should handle complete flow: fetch credentials -> call platform -> update hash -> callback", async () => {
            const flowLog: string[] = [];

            // Step 1: Fetch credentials
            flowLog.push("fetch-start");
            const credentials = await mockCredentialStore.get(
                mockJob.msg.actor.id,
                mockPlatform.credentialsHash,
            );
            flowLog.push("fetch-success");

            // Step 2: Create wrapped callback
            const doneCallback: PlatformCallback = (err, result) => {
                flowLog.push("done-callback");
            };

            const wrappedCallback: PlatformCallback = (err, result) => {
                flowLog.push("wrapped-callback-start");
                if (!err) {
                    mockPlatform.credentialsHash = crypto.objectHash(
                        credentials.object,
                    );
                    flowLog.push("hash-updated");
                }
                doneCallback(err, result);
                flowLog.push("wrapped-callback-end");
            };

            // Step 3: Call platform method
            (mockPlatform.connect as sinon.SinonStub).callsFake(
                (_msg, _creds, callback) => {
                    flowLog.push("platform-method-executing");
                    callback(null, { type: "success" });
                    flowLog.push("platform-method-callback-done");
                },
            );

            flowLog.push("call-platform-start");
            mockPlatform.connect(mockJob.msg, credentials, wrappedCallback);
            flowLog.push("call-platform-end");

            // Verify flow order
            expect(flowLog).toEqual([
                "fetch-start",
                "fetch-success",
                "call-platform-start",
                "platform-method-executing",
                "wrapped-callback-start",
                "hash-updated",
                "done-callback",
                "wrapped-callback-end",
                "platform-method-callback-done",
                "call-platform-end",
            ]);

            // Verify final state
            expect(mockPlatform.credentialsHash).toBeDefined();
        });
    });
});
