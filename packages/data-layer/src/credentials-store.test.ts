import { beforeEach, describe, expect, it } from "bun:test";
import * as sinon from "sinon";

import type { Logger } from "@sockethub/schemas";

import { CredentialsStore } from "./credentials-store";

const mockLogger: Logger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
};

describe("CredentialsStore", () => {
    let credentialsStore,
        MockSecureStore,
        MockStoreGet,
        MockStoreSave,
        MockObjectHash;
    beforeEach(() => {
        MockStoreGet = sinon.stub().returns({
            object: { password: "credential foo" },
        });
        MockStoreSave = sinon.stub();
        MockObjectHash = sinon.stub();
        MockSecureStore = sinon.stub().returns({
            get: MockStoreGet,
            save: MockStoreSave,
            isConnected: true,
            connect: sinon.stub().resolves(),
        });
        class TestCredentialsStore extends CredentialsStore {
            initCrypto() {
                this.objectHash = MockObjectHash;
            }
            initSecureStore(secret, redisConfig) {
                this.store = MockSecureStore({
                    namespace: "foo",
                    secret: secret,
                    redis: redisConfig,
                });
            }
        }
        credentialsStore = new TestCredentialsStore(
            "a parent id",
            "a session id",
            "a secret must be 32 chars and th",
            { url: "redis config" },
            mockLogger,
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
            }
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.calledOnce(MockObjectHash);
            sinon.assert.calledWith(MockObjectHash, {
                password: "a credential",
            });
            sinon.assert.notCalled(MockStoreSave);
        });

        it("rejects credentials objects without password", async () => {
            MockStoreGet.returns({
                object: { type: "credentials", token: "a credential" },
            });
            try {
                await credentialsStore.get("an actor");
                expect(false).toEqual(true);
            } catch (err) {
                expect(err.toString()).toEqual(
                    "Error: invalid credentials for an actor",
                );
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
});
