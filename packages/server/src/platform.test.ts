import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as sinon from "sinon";
import { crypto } from "@sockethub/util/crypto";
import type {
    ActivityStream,
    CredentialsObject,
    PlatformCallback,
    PlatformInterface,
} from "@sockethub/schemas";
import type { JobDataDecrypted } from "@sockethub/data-layer";
import {
    assertAcceptedCredentials,
    derivePlatformCredentialsSecret,
    migrateRenamedActorCredentials,
    renameActorCredentialsInStore,
    storeActorCredentials,
} from "./platform-credentials.js";
import { mergePackageConfig } from "./platform.js";

/**
 * Tests for platform.ts credential handling logic
 *
 * Since platform.ts runs as a separate process and uses process.argv,
 * we test the core credential handling behavior by simulating the
 * getJobHandler logic.
 */
describe("platform.ts credential handling", () => {
    describe("credentials secret derivation", () => {
        it("derives the same secret format used for credential storage", () => {
            const secret = derivePlatformCredentialsSecret(
                "parent-secret",
                "session-secret",
            );

            expect(secret.length).toBe(32);
            expect(secret).toBe(
                crypto.deriveSecret("parent-secret", "session-secret"),
            );
        });

        it("stores renamed credentials under the new platform-scoped actor", async () => {
            const saved: Array<{ key: string; creds: CredentialsObject }> = [];
            const renamed: CredentialsObject = {
                type: "credentials",
                "@context": [],
                actor: {
                    id: "alice_away@irc.example.org",
                    type: "person",
                    name: "alice_away",
                },
                object: {
                    type: "credentials",
                    nick: "alice_away",
                    password: "hunter2",
                },
            };
            await storeActorCredentials(
                {
                    save: (key, creds) => {
                        saved.push({ key, creds });
                        return Promise.resolve(1);
                    },
                },
                "irc",
                renamed,
            );
            expect(saved).toEqual([
                { key: "irc:alice_away@irc.example.org", creds: renamed },
            ]);
        });

        it("migrates renamed credentials for every peer session writer", async () => {
            const renamed: CredentialsObject = {
                type: "credentials",
                "@context": [],
                actor: {
                    id: "alice_away@irc.example.org",
                    type: "person",
                    name: "alice_away",
                },
                object: {
                    type: "credentials",
                    nick: "alice_away",
                    password: "hunter2",
                },
            };
            const saved: string[] = [];
            await migrateRenamedActorCredentials(
                "irc",
                "alice@irc.example.org",
                renamed,
                [
                    {
                        sessionId: "s2",
                        renameActorCredentials: async () => {
                            saved.push("s2");
                            return "migrated";
                        },
                    },
                ],
            );
            expect(saved).toEqual(["s2"]);
        });

        it("skips peer migration when the previous actor was never stored", async () => {
            const renamed: CredentialsObject = {
                type: "credentials",
                "@context": [],
                actor: {
                    id: "alice_away@irc.example.org",
                    type: "person",
                    name: "alice_away",
                },
                object: {
                    type: "credentials",
                    nick: "alice_away",
                    password: "hunter2",
                },
            };
            const store = {
                get: async (key: string) => {
                    if (key === "irc:alice@irc.example.org") {
                        throw new Error(
                            "credentials not found for irc:alice@irc.example.org",
                        );
                    }
                    throw new Error(`unexpected get ${key}`);
                },
                save: async () => 1,
            };
            const result = await renameActorCredentialsInStore(
                store,
                "irc",
                "alice@irc.example.org",
                renamed,
            );
            expect(result).toEqual("skipped");
        });

        it("refuses to overwrite a different account at the new actor id", async () => {
            const renamed: CredentialsObject = {
                type: "credentials",
                "@context": [],
                actor: {
                    id: "bob@irc.example.org",
                    type: "person",
                    name: "bob",
                },
                object: {
                    type: "credentials",
                    nick: "bob",
                    password: "alice-secret",
                },
            };
            const store = {
                get: async (key: string) => {
                    if (key === "irc:alice@irc.example.org") {
                        return {
                            type: "credentials",
                            "@context": [],
                            actor: {
                                id: "alice@irc.example.org",
                                type: "person",
                            },
                            object: {
                                type: "credentials",
                                nick: "alice",
                                password: "alice-secret",
                            },
                        };
                    }
                    if (key === "irc:bob@irc.example.org") {
                        return {
                            type: "credentials",
                            "@context": [],
                            actor: {
                                id: "bob@irc.example.org",
                                type: "person",
                            },
                            object: {
                                type: "credentials",
                                nick: "bob",
                                password: "bob-secret",
                            },
                        };
                    }
                    throw new Error(`credentials not found for ${key}`);
                },
                save: async () => 1,
                objectHash: crypto.objectHash,
            };
            await expect(
                renameActorCredentialsInStore(
                    store,
                    "irc",
                    "alice@irc.example.org",
                    renamed,
                ),
            ).rejects.toThrow(
                "cannot rename alice@irc.example.org to bob@irc.example.org",
            );
        });

        it("refuses to overwrite another account in the submitting session", async () => {
            const renamed: CredentialsObject = {
                type: "credentials",
                "@context": [],
                actor: {
                    id: "bob@irc.example.org",
                    type: "person",
                    name: "bob",
                },
                object: {
                    type: "credentials",
                    nick: "bob",
                    password: "alice-secret",
                },
            };
            const saved: string[] = [];
            const store = {
                get: async (key: string) => {
                    if (key === "irc:alice@irc.example.org") {
                        return {
                            type: "credentials" as const,
                            "@context": [],
                            actor: {
                                id: "alice@irc.example.org",
                                type: "person",
                            },
                            object: {
                                type: "credentials" as const,
                                nick: "alice",
                                password: "alice-secret",
                            },
                        };
                    }
                    if (key === "irc:bob@irc.example.org") {
                        return {
                            type: "credentials" as const,
                            "@context": [],
                            actor: {
                                id: "bob@irc.example.org",
                                type: "person",
                            },
                            object: {
                                type: "credentials" as const,
                                nick: "bob",
                                password: "bob-secret",
                            },
                        };
                    }
                    throw new Error(`credentials not found for ${key}`);
                },
                save: async (key: string) => {
                    saved.push(key);
                    return 1;
                },
                objectHash: crypto.objectHash,
            };
            await expect(
                renameActorCredentialsInStore(
                    store,
                    "irc",
                    "alice@irc.example.org",
                    renamed,
                ),
            ).rejects.toThrow(
                "cannot rename alice@irc.example.org to bob@irc.example.org",
            );
            expect(saved).toEqual([]);
        });

        it("stores renamed credentials when the new actor id is free", async () => {
            const renamed: CredentialsObject = {
                type: "credentials",
                "@context": [],
                actor: {
                    id: "alice_away@irc.example.org",
                    type: "person",
                    name: "alice_away",
                },
                object: {
                    type: "credentials",
                    nick: "alice_away",
                    password: "hunter2",
                },
            };
            const saved: Array<{ key: string; creds: CredentialsObject }> = [];
            const store = {
                get: async (key: string) => {
                    if (key === "irc:alice@irc.example.org") {
                        return {
                            type: "credentials" as const,
                            "@context": [],
                            actor: {
                                id: "alice@irc.example.org",
                                type: "person",
                            },
                            object: {
                                type: "credentials" as const,
                                nick: "alice",
                                password: "hunter2",
                            },
                        };
                    }
                    throw new Error(`credentials not found for ${key}`);
                },
                save: async (key: string, creds: CredentialsObject) => {
                    saved.push({ key, creds });
                    return 1;
                },
            };
            const result = await renameActorCredentialsInStore(
                store,
                "irc",
                "alice@irc.example.org",
                renamed,
            );
            expect(result).toEqual("migrated");
            expect(saved).toEqual([
                { key: "irc:alice_away@irc.example.org", creds: renamed },
            ]);
        });

        it("does not write when a rename is only being checked", async () => {
            const renamed: CredentialsObject = {
                type: "credentials",
                "@context": [],
                actor: {
                    id: "alice_away@irc.example.org",
                    type: "person",
                    name: "alice_away",
                },
                object: {
                    type: "credentials",
                    nick: "alice_away",
                    password: "hunter2",
                },
            };
            const saved: Array<string> = [];
            const store = {
                get: async (key: string) => {
                    if (key === "irc:alice@irc.example.org") {
                        return {
                            type: "credentials" as const,
                            "@context": [],
                            actor: {
                                id: "alice@irc.example.org",
                                type: "person",
                            },
                            object: {
                                type: "credentials" as const,
                                nick: "alice",
                                password: "hunter2",
                            },
                        };
                    }
                    throw new Error(`credentials not found for ${key}`);
                },
                save: async (key: string) => {
                    saved.push(key);
                    return 1;
                },
            };
            const result = await renameActorCredentialsInStore(
                store,
                "irc",
                "alice@irc.example.org",
                renamed,
                { dryRun: true },
            );
            expect(result).toEqual("migrated");
            expect(saved).toEqual([]);
        });

    });

    describe("assertAcceptedCredentials", () => {
        /** A session's stored IRC credential object for `nick`. */
        const stored = (nick: string): CredentialsObject => ({
            type: "credentials",
            "@context": [],
            actor: { id: `${nick}@irc.example.org`, type: "person" },
            object: { type: "credentials", nick, password: "hunter2" },
        });
        const originalHash = crypto.objectHash(stored("alice").object);
        const renamedHash = crypto.objectHash(stored("alice_away").object);

        it("accepts any object before the first successful call", () => {
            expect(() =>
                assertAcceptedCredentials(
                    stored("alice"),
                    undefined,
                    new Set(),
                    "irc:alice@irc.example.org",
                ),
            ).not.toThrow();
        });

        it("accepts the object matching the current hash", () => {
            expect(() =>
                assertAcceptedCredentials(
                    stored("alice_away"),
                    renamedHash,
                    new Set([originalHash]),
                    "irc:alice_away@irc.example.org",
                ),
            ).not.toThrow();
        });

        it("accepts the pre-rename object a reconnecting client replays", () => {
            // The worker rewrote the nick in its copy; the client still holds
            // the object it originally sent, now keyed under the new actor.
            expect(() =>
                assertAcceptedCredentials(
                    stored("alice"),
                    renamedHash,
                    new Set([originalHash, renamedHash]),
                    "irc:alice_away@irc.example.org",
                ),
            ).not.toThrow();
        });

        it("rejects a different secret for the same actor", () => {
            const other = stored("alice_away");
            other.object.password = "not-hunter2";
            expect(() =>
                assertAcceptedCredentials(
                    other,
                    renamedHash,
                    new Set([originalHash, renamedHash]),
                    "irc:alice_away@irc.example.org",
                ),
            ).toThrow("invalid credentials for irc:alice_away@irc.example.org");
        });
    });
    let sandbox: sinon.SinonSandbox;
    let mockPlatform: Partial<PlatformInterface>;
    let mockCredentialStore: any;
    let mockJob: JobDataDecrypted;
    let validCredentials: CredentialsObject;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        validCredentials = {
            type: "credentials",
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld",
            ],
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
                "@context": [
                    "https://www.w3.org/ns/activitystreams",
                    "https://sockethub.org/ns/context/v1.jsonld",
                    "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld",
                ],
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

    describe("Initialization state checking", () => {
        it("should use isInitialized() method instead of config.initialized property", async () => {
            // Mock platform with isInitialized() method
            const mockPlatformWithMethod = {
                config: {
                    persist: true,
                    requireCredentials: ["connect"],
                },
                credentialsHash: undefined,
                isInitialized: sandbox.stub().returns(true),
                connect: sandbox.stub(),
            };

            const credentials = await mockCredentialStore.get(
                mockJob.msg.actor.id,
                mockPlatformWithMethod.credentialsHash,
            );

            // Simulate the error handling that checks initialization state
            const simulateCredentialsError = (platform: any) => {
                const err = new Error("invalid credentials");

                // This is the pattern from platform.ts line 280
                if (platform.isInitialized()) {
                    // Platform already running - reject job only
                    return "job-rejected";
                } else {
                    // Platform not initialized - terminate platform
                    return "platform-terminated";
                }
            };

            // When initialized, should reject job only
            mockPlatformWithMethod.isInitialized.returns(true);
            expect(simulateCredentialsError(mockPlatformWithMethod)).toBe("job-rejected");
            sinon.assert.calledOnce(mockPlatformWithMethod.isInitialized);

            // When not initialized, should terminate platform
            mockPlatformWithMethod.isInitialized.returns(false);
            expect(simulateCredentialsError(mockPlatformWithMethod)).toBe("platform-terminated");
            sinon.assert.calledTwice(mockPlatformWithMethod.isInitialized);
        });

        it("should handle credentials error on initialized platform without terminating", async () => {
            // Setup: Platform is initialized
            const initializedPlatform = {
                config: {
                    persist: true,
                    requireCredentials: ["connect"],
                },
                credentialsHash: crypto.objectHash(validCredentials.object),
                isInitialized: sandbox.stub().returns(true),
                connect: sandbox.stub(),
            };

            const credentials = await mockCredentialStore.get(
                mockJob.msg.actor.id,
                initializedPlatform.credentialsHash,
            );

            let errorPropagated = false;
            let platformTerminated = false;

            const doneCallback: PlatformCallback = (err, result) => {
                if (err) errorPropagated = true;
            };

            const wrappedCallback: PlatformCallback = (err, result) => {
                if (!err) {
                    initializedPlatform.credentialsHash = crypto.objectHash(
                        credentials.object,
                    );
                }

                // Simulate platform.ts error handling logic
                if (err && initializedPlatform.config.persist) {
                    if (initializedPlatform.isInitialized()) {
                        // Just propagate error, don't terminate
                        doneCallback(err, null);
                    } else {
                        // Would terminate platform
                        platformTerminated = true;
                    }
                } else {
                    doneCallback(err, result);
                }
            };

            // Simulate credentials error
            (initializedPlatform.connect as sinon.SinonStub).callsFake(
                (_msg, _creds, callback) => {
                    callback(new Error("invalid credentials"), null);
                },
            );

            initializedPlatform.connect(mockJob.msg, credentials, wrappedCallback);

            // Verify: error propagated but platform not terminated
            expect(errorPropagated).toBeTrue();
            expect(platformTerminated).toBeFalse();
            sinon.assert.calledOnce(initializedPlatform.isInitialized);
        });

        it("should terminate platform on credentials error when not initialized", async () => {
            // Setup: Platform is NOT initialized
            const uninitializedPlatform = {
                config: {
                    persist: true,
                    requireCredentials: ["connect"],
                },
                credentialsHash: undefined,
                isInitialized: sandbox.stub().returns(false),
                connect: sandbox.stub(),
            };

            const credentials = await mockCredentialStore.get(
                mockJob.msg.actor.id,
                uninitializedPlatform.credentialsHash,
            );

            let errorPropagated = false;
            let platformTerminated = false;

            const doneCallback: PlatformCallback = (err, result) => {
                if (err) errorPropagated = true;
            };

            const wrappedCallback: PlatformCallback = (err, result) => {
                if (!err) {
                    uninitializedPlatform.credentialsHash = crypto.objectHash(
                        credentials.object,
                    );
                }

                // Simulate platform.ts error handling logic
                if (err && uninitializedPlatform.config.persist) {
                    if (uninitializedPlatform.isInitialized()) {
                        doneCallback(err, null);
                    } else {
                        // Terminate platform process
                        platformTerminated = true;
                    }
                } else {
                    doneCallback(err, result);
                }
            };

            // Simulate credentials error during initialization
            (uninitializedPlatform.connect as sinon.SinonStub).callsFake(
                (_msg, _creds, callback) => {
                    callback(new Error("invalid credentials"), null);
                },
            );

            uninitializedPlatform.connect(mockJob.msg, credentials, wrappedCallback);

            // Verify: platform terminated
            expect(platformTerminated).toBeTrue();
            expect(errorPropagated).toBeFalse();
            sinon.assert.calledOnce(uninitializedPlatform.isInitialized);
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

describe("mergePackageConfig", () => {
    const base = { persist: false, connectTimeoutMs: 5000 };

    it("returns the base config unchanged when no override is given", () => {
        expect(mergePackageConfig(base, undefined)).toEqual(base);
        expect(mergePackageConfig(base, "")).toEqual(base);
    });

    it("overlays file values onto the platform defaults", () => {
        expect(
            mergePackageConfig(base, JSON.stringify({ connectTimeoutMs: 9000 })),
        ).toEqual({ persist: false, connectTimeoutMs: 9000 });
    });

    it("keeps defaults for keys the override does not set", () => {
        expect(
            mergePackageConfig(base, JSON.stringify({ connectTimeoutMs: 1 })),
        ).toMatchObject({ persist: false });
    });

    it("throws on malformed JSON", () => {
        expect(() => mergePackageConfig(base, "{not json")).toThrow();
    });

    it("throws when the override is not a JSON object", () => {
        expect(() => mergePackageConfig(base, "5")).toThrow(
            /must be a JSON object/,
        );
        expect(() => mergePackageConfig(base, "[1,2]")).toThrow(
            /must be a JSON object/,
        );
    });
});
