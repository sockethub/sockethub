import { expect } from 'chai';
import * as sinon from 'sinon';

import storeCredentialsWrapper from "./store-credentials";

const creds = {
  "id":"blah",
  "type":"credentials",
  "context":"dummy",
  "actor":{
    "id":"dood@irc.freenode.net",
    "type":"person",
    "name":"dood"
  },
  "target":{
    "id":"irc.freenode.net/service",
    "type":"person",
    "name":"service"
  },
  "object":{
    "type":"credentials"
  }
};

describe('Middleware: storeCredentials', () => {
  let storeSuccess: any, storeError: any, saveErrorFake: any,
      saveSuccessFake: any;

  beforeEach(() => {
    storeSuccess = {
      save: async (id: any, creds: any) => {
        return;
      }
    };
    storeError = {
      save: async (id: any, creds: any) => {
        throw new Error('some error');
      }
    };
    saveSuccessFake = sinon.replace(storeSuccess, 'save', sinon.fake(storeSuccess.save));
    saveErrorFake = sinon.replace(storeError, 'save', sinon.fake(storeError.save));
  });

  afterEach(() => {
    sinon.reset();
  });

  it('returns a middleware handler', () => {
    const sc = storeCredentialsWrapper(storeSuccess);
    expect(typeof sc).to.equal('function');
    expect(saveSuccessFake.callCount).to.equal(0);
  });

  it('successfully store credentials', async () => {
    const sc = storeCredentialsWrapper(storeSuccess);
    await sc(creds);
    expect(saveSuccessFake.callCount).to.equal(1);
    expect(saveSuccessFake.firstArg).to.equal(creds.actor.id);
  });

  it('handle error while storing credentials', async () => {
    const sc = storeCredentialsWrapper(storeError);
    try {
      await sc(creds);
    } catch (err) {
      expect(saveErrorFake.callCount).to.equal(1);
      expect(saveErrorFake.firstArg).to.equal(creds.actor.id);
      expect(err.toString()).to.eql('Error: some error');
    }
  });
});