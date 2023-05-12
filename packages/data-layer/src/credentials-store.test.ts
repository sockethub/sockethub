import { expect } from "chai";
import * as sinon from "sinon";

import { CredentialsStore } from "./index";

describe("CredentialsStore", () => {
    let credentialsStore,
        MockSecureStore,
        MockStoreGet,
        MockStoreSave,
        MockObjectHash;
    beforeEach(() => {
        MockStoreGet = sinon
            .stub().returns("credential foo");
        MockStoreSave = sinon.stub();
        MockObjectHash = sinon.stub();
        MockSecureStore = sinon.stub().returns({
            get: MockStoreGet,
            save: MockStoreSave,
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
        );
    });

    it("returns a valid CredentialsStore object", () => {
        sinon.assert.calledOnce(MockSecureStore);
        sinon.assert.calledWith(MockSecureStore, {
            namespace: "foo",
            secret: "a secret must be 32 chars and th",
            redis: { url: "redis config" },
        });
        expect(typeof credentialsStore).to.equal("object");
        expect(credentialsStore.uid).to.equal(
            `sockethub:data-layer:credentials-store:a parent id:a session id`,
        );
        expect(typeof credentialsStore.get).to.equal("function");
        expect(typeof credentialsStore.save).to.equal("function");
    });

    describe("get", () => {
        it("handles correct params", async () => {
            const res = await credentialsStore.get("an actor");
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
            expect(res).to.equal("credential foo");
        });

        it("handles no credentials found", async () => {
            MockStoreGet.returns(undefined);
            const res = await credentialsStore.get("an non-existent actor");
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an non-existent actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
            expect(res).to.be.undefined;
        });

        it("handles an unexpected error", async () => {
            MockStoreGet.returns(undefined);
            expect(await credentialsStore.get("a problem actor")).to.be.undefined;
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "a problem actor");
            sinon.assert.notCalled(MockObjectHash);
            sinon.assert.notCalled(MockStoreSave);
        });

        it("validates credentialsHash when provided", async () => {
            MockObjectHash.returns("a credentialHash string");
            MockStoreGet.returns({
                object: "a credential",
            });
            const res = await credentialsStore.get(
                "an actor",
                "a credentialHash string",
            );
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.calledOnce(MockObjectHash);
            sinon.assert.calledWith(MockObjectHash, "a credential");
            sinon.assert.notCalled(MockStoreSave);
            expect(res).to.eql({ object: "a credential" });
        });

        it("invalidates credentialsHash when provided", async () => {
            MockObjectHash.returns("the original credentialHash string");
            MockStoreGet.returns({
                object: "a credential",
            });
            expect(await credentialsStore.get(
                "an actor",
                "a different credentialHash string",
            )).to.be.undefined;
            sinon.assert.calledOnce(MockStoreGet);
            sinon.assert.calledWith(MockStoreGet, "an actor");
            sinon.assert.calledOnce(MockObjectHash);
            sinon.assert.calledWith(MockObjectHash, "a credential");
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
