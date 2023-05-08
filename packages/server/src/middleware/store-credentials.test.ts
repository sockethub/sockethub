import { expect } from "chai";
import * as sinon from "sinon";

import storeCredentials from "./store-credentials";

const creds = {
  id: "blah",
  type: "credentials",
  context: "dummy",
  actor: {
    id: "dood@irc.freenode.net",
    type: "person",
    name: "dood",
  },
  target: {
    id: "irc.freenode.net/service",
    type: "person",
    name: "service",
  },
  object: {
    type: "credentials",
  },
};

describe("Middleware: storeCredentials", () => {
  let storeSuccess: any,
      storeError: any,
      saveErrorFake: any,
      saveSuccessFake: any;

  beforeEach(() => {
    storeSuccess = {
      save: (id: any, creds: any, cb: Function) => {
        cb();
      },
    };
    storeError = {
      save: (id: any, creds: any, cb: Function) => {
        cb("some error");
      },
    };
    saveSuccessFake = sinon.replace(
      storeSuccess,
      "save",
      sinon.fake(storeSuccess.save)
    );
    saveErrorFake = sinon.replace(
      storeError,
      "save",
      sinon.fake(storeError.save)
    );
  });

  afterEach(() => {
    sinon.reset();
  });

  it("returns a middleware handler", () => {
    const sc = storeCredentials(storeSuccess);
    expect(typeof sc).to.equal("function");
    expect(saveSuccessFake.callCount).to.equal(0);
  });

  it("successfully stores credentials", () => {
    const sc = storeCredentials(storeSuccess);
    sc(creds, (err: any) => {
      expect(saveSuccessFake.callCount).to.equal(1);
      expect(saveSuccessFake.firstArg).to.equal(creds.actor.id);
      expect(err).to.be.undefined;
    });
  });

  it("handle error while storing credentials", () => {
    const sc = storeCredentials(storeError);
    sc(creds, (err: any) => {
      expect(saveErrorFake.callCount).to.equal(1);
      expect(saveErrorFake.firstArg).to.equal(creds.actor.id);
      expect(err).to.eql("some error");
    });
  });
});
