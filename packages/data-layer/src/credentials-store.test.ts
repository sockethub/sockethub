// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import proxyquire from "proxyquire";
import { expect } from "chai";
import * as sinon from "sinon";
import CredentialsStore from "./credentials-store";

proxyquire.noPreserveCache();
proxyquire.noCallThru();

describe("CredentialsStore", () => {
  let credentialsStore: CredentialsStore,
    MockSecureStore,
    MockStoreGet,
    MockStoreSave,
    MockObjectHash;
  beforeEach(() => {
    MockStoreGet = sinon.stub().callsArgWith(1, undefined, "credential foo");
    MockStoreSave = sinon.stub().callsArgWith(2, undefined);
    MockObjectHash = sinon.stub();
    MockSecureStore = sinon.stub().returns({
      get: MockStoreGet,
      save: MockStoreSave,
    });
    const StoreMod = proxyquire("./credentials-store", {
      "secure-store-redis": MockSecureStore,
      "@sockethub/crypto": {
        objectHash: MockObjectHash,
      },
    });
    const CredentialsStore = StoreMod.default;
    credentialsStore = new CredentialsStore(
      "a parent id",
      "a session id",
      "a secret",
      "redis config"
    );
  });

  it("returns a valid CredentialsStore object", () => {
    sinon.assert.calledOnce(MockSecureStore);
    sinon.assert.calledWith(MockSecureStore, {
      namespace:
        "sockethub:data-layer:credentials-store:a parent id:a session id",
      secret: "a secret",
      redis: "redis config",
    });
    expect(typeof credentialsStore).to.equal("object");
    expect(credentialsStore.uid).to.equal(
      `sockethub:data-layer:credentials-store:a parent id:a session id`
    );
    expect(typeof credentialsStore.get).to.equal("function");
    expect(typeof credentialsStore.save).to.equal("function");
  });

  describe("get", () => {
    it("handles correct params", async () => {
      let res = await credentialsStore.get("an actor");
      sinon.assert.calledOnce(MockStoreGet);
      sinon.assert.calledWith(MockStoreGet, "an actor");
      sinon.assert.notCalled(MockObjectHash);
      sinon.assert.notCalled(MockStoreSave);
      expect(res).to.equal("credential foo");
    });

    it("handles no credentials found", async () => {
      MockStoreGet.callsArgWith(1, undefined, undefined);
      let res = await credentialsStore.get("an non-existent actor");
      sinon.assert.calledOnce(MockStoreGet);
      sinon.assert.calledWith(MockStoreGet, "an non-existent actor");
      sinon.assert.notCalled(MockObjectHash);
      sinon.assert.notCalled(MockStoreSave);
      expect(res).to.be.undefined;
    });

    it("handles an unexpected error", async () => {
      MockStoreGet.callsArgWith(1, "sumting bad happen", undefined);
      let res;
      try {
        res = await credentialsStore.get("a problem actor");
        throw new Error("should not reach this spot");
      } catch (err) {
        expect(err).to.equal("credentials sumting bad happen");
      }
      sinon.assert.calledOnce(MockStoreGet);
      sinon.assert.calledWith(MockStoreGet, "a problem actor");
      sinon.assert.notCalled(MockObjectHash);
      sinon.assert.notCalled(MockStoreSave);
      expect(res).to.be.undefined;
    });

    it("validates credentialsHash when provided", async () => {
      MockObjectHash.returns("a credentialHash string");
      MockStoreGet.callsArgWith(1, undefined, {
        object: "a credential",
      });
      let res = await credentialsStore.get(
        "an actor",
        "a credentialHash string"
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
      MockStoreGet.callsArgWith(1, undefined, {
        object: "a credential",
      });
      let res;
      try {
        res = await credentialsStore.get(
          "an actor",
          "a different credentialHash string"
        );
        throw new Error("should not reach this spot");
      } catch (err) {
        expect(err).to.equal(
          "provided credentials do not match existing platform instance for actor an actor"
        );
      }
      sinon.assert.calledOnce(MockStoreGet);
      sinon.assert.calledWith(MockStoreGet, "an actor");
      sinon.assert.calledOnce(MockObjectHash);
      sinon.assert.calledWith(MockObjectHash, "a credential");
      sinon.assert.notCalled(MockStoreSave);
      expect(res).to.be.undefined;
    });
  });

  describe("save", () => {
    it("handles success", (done) => {
      const creds = { foo: "bar" };
      credentialsStore.save("an actor", creds, (err) => {
        sinon.assert.calledOnce(MockStoreSave);
        sinon.assert.calledWith(MockStoreSave, "an actor", creds);
        sinon.assert.notCalled(MockObjectHash);
        sinon.assert.notCalled(MockStoreGet);
        expect(err).to.be.undefined;
        done();
      });
    });

    it("handles failure", (done) => {
      const creds = { foo: "bar" };
      MockStoreSave.callsArgWith(2, "an error");
      credentialsStore.save("an actor", creds, (err) => {
        sinon.assert.calledOnce(MockStoreSave);
        sinon.assert.calledWith(MockStoreSave, "an actor", creds);
        sinon.assert.notCalled(MockObjectHash);
        sinon.assert.notCalled(MockStoreGet);
        expect(err).to.equal("an error");
        done();
      });
    });
  });
});
