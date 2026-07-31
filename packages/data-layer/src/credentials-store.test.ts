import { beforeEach, describe, expect, it } from "bun:test";
import * as sinon from "sinon";

import type { Logger } from "@sockethub/schemas";

import {
    CredentialsMismatchError,
    CredentialsNotShareableError,
    CredentialsStore,
    purgeCredentialsStoreKeys,
} from "./credentials-store";

const mockLogger: Logger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
};

describe("CredentialsStore", () => {
    let credentialsStore,
        TestCredentialsStore,
        MockSecureStore,
        MockStoreGet,
        MockStoreSave,
        MockStoreDeleteAll,
        MockObjectHash;
    beforeEach(() => {
        MockStoreGet = sinon.stub().returns({
            object: { password: "credential foo" },
        });
        MockStoreSave = sinon.stub();
        MockStoreDeleteAll = sinon.stub().resolves(1);
        MockObjectHash = sinon.stub();
        MockSecureStore = sinon.stub().returns({
            get: MockStoreGet,
            save: MockStoreSave,
            deleteAll: MockStoreDeleteAll,
            isConnected: true,
            connect: sinon.stub().resolves(),
        });
        TestCredentialsStore = class extends CredentialsStore {
            initCrypto() {
                this.objectHash = MockObjectHash;
            }
            initSecureStore(secret, redisConfig, ttlMs) {
                this.store = MockSecureStore({
                    namespace: "foo",
                    secret: secret,
                    redis: redisConfig,
                    ...(ttlMs ? { ttl: ttlMs } : {}),
                });
            }
        };
        credentialsStore = new TestCredentialsStore(
            "a parent id",
            "a session id",
            "a secret must be 32 chars and th",
            { url: "redis config" },
        );
    });

    it("returns a valid CredentialsStore object", () => {
        sinon.assert.calledOnce(MockSecureStore);
        sinon.assert.calledWith(MockSecureStore, {
            namespace: "foo",
            secret: "a secret must be 32 chars and th",
            redis: {
                url: "redis config",
                connectionName:
                    "data-layer:credentials-store:a parent id:a session id",
            },
        });
        expect(typeof credentialsStore).toEqual("object");
        expect(credentialsStore.uid).toEqual(
            `sockethub:a parent id:data-layer:credentials-store:a session id`,
        );
        expect(typeof credentialsStore.get).toEqual("function");
        expect(typeof credentialsStore.save).toEqual("function");
    });

    describe("get", () => {
        it("handles correct params", async () => {
            const res = await credentialsStore.get("an actor");
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
            expect(res).toEqual({ object: { password: "credential foo" } });
        });

        it("handles no credentials found", async () => {
            MockStoreGet.returns(undefined);
            expect(async () => {
                await credentialsStore.get("a non-existent actor");
            }).toThrow("credentials not found for a non-existent actor");
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "a non-existent actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
        });

        it("handles an unexpected error", async () => {
            MockStoreGet.returns(undefined);
            try {
                await credentialsStore.get("a problem actor");
                expect(false).toEqual(true);
            } catch (err) {
                expect(err.toString()).toEqual(
                    "Error: credentials not found for a problem actor",
                );
            }
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "a problem actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
        });

        it("validates credentialsHash when provided", async () => {
            MockObjectHash.returns("a credentialsHash string");
            MockStoreGet.returns({
                object: { password: "a credential" },
            });
            const res = await credentialsStore.get(
                "an actor",
                "a credentialsHash string",
            );
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.calledOnce(MockObjectHash);
            sinon.assert.calledWith(MockObjectHash, {
                password: "a credential",
            });
            sinon.assert.notCalled(MockStoreSave);
            expect(res).toEqual({ object: { password: "a credential" } });
        });

        it("invalidates credentialsHash when provided", async () => {
            MockObjectHash.returns("the original credentialsHash string");
            MockStoreGet.returns({
                object: { password: "a credential" },
            });
            try {
                expect(
                    await credentialsStore.get(
                        "an actor",
                        "a different credentialsHash string",
                    ),
                ).toBeUndefined();
                expect(false).toEqual(true);
            } catch (err) {
                expect(err.toString()).toEqual(
                    "Error: invalid credentials for an actor",
                );
                expect(err).toBeInstanceOf(CredentialsMismatchError);
            }
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.calledOnce(MockObjectHash);
            sinon.assert.calledWith(MockObjectHash, {
                password: "a credential",
            });
            sinon.assert.notCalled(MockStoreSave);
        });

        it("allows credentials without password when no hash is provided", async () => {
            MockStoreGet.returns({
                object: { type: "credentials", token: "a credential" },
            });
            const res = await credentialsStore.get("an actor");
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
            expect(res).toEqual({
                object: { type: "credentials", token: "a credential" },
            });
        });

        it("allows token credentials for session-share validation", async () => {
            MockStoreGet.returns({
                object: { type: "credentials", token: "a credential" },
            });
            const res = await credentialsStore.get("an actor", undefined, {
                validateSessionShare: true,
            });
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
            expect(res).toEqual({
                object: { type: "credentials", token: "a credential" },
            });
        });

        it("allows password credentials for session-share validation", async () => {
            MockStoreGet.returns({
                object: { type: "credentials", password: "a credential" },
            });
            const res = await credentialsStore.get("an actor", undefined, {
                validateSessionShare: true,
            });
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
            expect(res).toEqual({
                object: { type: "credentials", password: "a credential" },
            });
        });

        it("rejects credentials without password or token for session-share validation", async () => {
            MockStoreGet.returns({
                object: { type: "credentials" },
            });
            try {
                await credentialsStore.get("an actor", undefined, {
                    validateSessionShare: true,
                });
                expect(false).toEqual(true);
            } catch (err) {
                expect(err.toString()).toEqual("Error: username already in use");
                expect(err).toBeInstanceOf(CredentialsNotShareableError);
            }
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
        });

        it("rejects array credentials objects", async () => {
            MockStoreGet.returns({
                object: ["token", "a credential"],
            });
            try {
                await credentialsStore.get("an actor");
                expect(false).toEqual(true);
            } catch (err) {
                expect(err.toString()).toEqual(
                    "Error: invalid credentials for an actor",
                );
                expect(err).toBeInstanceOf(CredentialsMismatchError);
            }
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
        });

        it("rejects empty credentials objects", async () => {
            MockStoreGet.returns({
                object: {},
            });
            try {
                await credentialsStore.get("an actor");
                expect(false).toEqual(true);
            } catch (err) {
                expect(err.toString()).toEqual(
                    "Error: invalid credentials for an actor",
                );
                expect(err).toBeInstanceOf(CredentialsMismatchError);
            }
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
        });

        it("rejects null credentials objects", async () => {
            MockStoreGet.returns({
                object: null,
            });
            try {
                await credentialsStore.get("an actor");
                expect(false).toEqual(true);
            } catch (err) {
                expect(err.toString()).toEqual(
                    "Error: invalid credentials for an actor",
                );
                expect(err).toBeInstanceOf(CredentialsMismatchError);
            }
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
        });

        it("rejects missing credentials objects", async () => {
            MockStoreGet.returns({});
            try {
                await credentialsStore.get("an actor");
                expect(false).toEqual(true);
            } catch (err) {
                expect(err.toString()).toEqual(
                    "Error: invalid credentials for an actor",
                );
                expect(err).toBeInstanceOf(CredentialsMismatchError);
            }
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
        });
    });

    describe("save", () => {
        it("handles success", async () => {
            const creds = { foo: "bar" };
            await credentialsStore.save("an actor", creds);
            sinon.assert.calledOnce(MockStoreSave);
            sinon.assert.calledWith(MockStoreSave, "an actor", creds);
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreGet);
        });

        it("handles failure", async () => {
            const creds = { foo: "bar" };
            MockStoreSave.returns(undefined);
            await credentialsStore.save("an actor", creds);
            sinon.assert.calledOnce(MockStoreSave);
            sinon.assert.calledWith(MockStoreSave, "an actor", creds);
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreGet);
        });
    });

    describe("ttl", () => {
        it("passes ttlMs through to the secure store config", () => {
            MockSecureStore.resetHistory();
            new TestCredentialsStore(
                "a parent id",
                "a session id",
                "a secret must be 32 chars and th",
                { url: "redis config" },
                { ttlMs: 604800000 },
            );
            sinon.assert.calledOnce(MockSecureStore);
            expect(MockSecureStore.firstCall.args[0].ttl).toEqual(604800000);
        });

        it("omits ttl from the secure store config when not set", () => {
            expect(
                "ttl" in MockSecureStore.firstCall.args[0],
            ).toEqual(false);
        });
    });

    describe("teardown", () => {
        it("deletes the session's credential namespace", async () => {
            await credentialsStore.teardown();
            sinon.assert.calledOnce(MockStoreDeleteAll);
        });

        it("connects first when the store is not connected", async () => {
            credentialsStore.store.isConnected = false;
            await credentialsStore.teardown();
            sinon.assert.calledOnce(credentialsStore.store.connect);
            sinon.assert.calledOnce(MockStoreDeleteAll);
        });

        it("swallows errors so cleanup never throws", async () => {
            MockStoreDeleteAll.rejects(new Error("redis down"));
            await credentialsStore.teardown();
            sinon.assert.calledOnce(MockStoreDeleteAll);
        });
    });
});

describe("purgeCredentialsStoreKeys", () => {
    function fakeClient(scanPages, delStub) {
        let call = 0;
        return {
            scan: sinon.stub().callsFake(async () => {
                const page = scanPages[call];
                call += 1;
                return page;
            }),
            del: delStub,
        };
    }

    it("scans and deletes only this parentId's keys", async () => {
        const delStub = sinon.stub().resolves(1);
        const client = fakeClient(
            [["0", ["sockethub:pid:data-layer:credentials-store:a", "sockethub:pid:data-layer:credentials-store:b"]]],
            delStub,
        );
        const removed = await purgeCredentialsStoreKeys(
            client as never,
            "pid",
        );
        expect(removed).toEqual(2);
        sinon.assert.calledOnce(client.scan);
        expect(client.scan.firstCall.args).toEqual([
            "0",
            "MATCH",
            "sockethub:pid:data-layer:credentials-store:*",
            "COUNT",
            100,
        ]);
        // Per-key deletion (multi-key DEL is cluster-unsafe)
        sinon.assert.calledTwice(delStub);
        sinon.assert.calledWith(
            delStub,
            "sockethub:pid:data-layer:credentials-store:a",
        );
        sinon.assert.calledWith(
            delStub,
            "sockethub:pid:data-layer:credentials-store:b",
        );
    });

    it("follows the scan cursor across pages and skips empty pages", async () => {
        const delStub = sinon.stub().resolves(1);
        const client = fakeClient(
            [
                ["17", []],
                ["0", ["sockethub:pid:data-layer:credentials-store:a"]],
            ],
            delStub,
        );
        const removed = await purgeCredentialsStoreKeys(
            client as never,
            "pid",
        );
        expect(removed).toEqual(1);
        expect(client.scan.callCount).toEqual(2);
        sinon.assert.calledOnce(delStub);
    });

    it("escapes redis glob characters in the parentId", async () => {
        // randToken's charset includes `*`; unescaped it would make the MATCH
        // pattern match (and delete) other instances' keys.
        const delStub = sinon.stub().resolves(0);
        const client = fakeClient([["0", []]], delStub);
        await purgeCredentialsStoreKeys(client as never, "a*b?c[d]e\\f");
        expect(client.scan.firstCall.args[2]).toEqual(
            "sockethub:a\\*b\\?c\\[d\\]e\\\\f:data-layer:credentials-store:*",
        );
        sinon.assert.notCalled(delStub);
    });
});
