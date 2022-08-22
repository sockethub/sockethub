import { expect } from 'chai';
import * as sinon from 'sinon';

import storeCredentials from "./store-credentials";

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
      saveSuccessFake: any, sessionLogStub: any;

  beforeEach(() => {
    storeSuccess = {
      save: async (id: any, creds: any) => {
        return {};
      }
    };
    storeError = {
      save: async (id: any, creds: any) => {
        throw new Error('some error');
      }
    };
    saveSuccessFake = sinon.replace(storeSuccess, 'save', sinon.fake(storeSuccess.save));
    saveErrorFake = sinon.replace(storeError, 'save', sinon.fake(storeError.save));
    sessionLogStub = sinon.stub();
  });

  afterEach(() => {
    sinon.reset();
  });

  it('returns a middleware handler', () => {
    const sc = storeCredentials(storeSuccess, sessionLogStub);
    expect(typeof sc).to.equal('function');
    expect(saveSuccessFake.callCount).to.equal(0);
    expect(sessionLogStub.callCount).to.equal(0);
  });

  it('successfully store credentials', () => {
    const sc = storeCredentials(storeSuccess, sessionLogStub);
    sc(creds, (err: any) => {
      expect(saveSuccessFake.callCount).to.equal(1);
      expect(saveSuccessFake.firstArg).to.equal(creds.actor.id);
      expect(err).to.be.undefined;
    });
  });

  it('handle error while storing credentials', () => {
    const sc = storeCredentials(storeError, sessionLogStub);
    sc(creds, (err: any) => {
      expect(saveErrorFake.callCount).to.equal(1);
      expect(saveErrorFake.firstArg).to.equal(creds.actor.id);
      expect(err).to.eql('some error');
    });
  });
});
