import proxyquire from 'proxyquire';
import { expect } from 'chai';
import * as sinon from 'sinon';

proxyquire.noPreserveCache();
proxyquire.noCallThru();

const FORK_PATH = __dirname + '/platform.js';

describe("PlatformInstance", () => {
  let pi, sandbox, forkFake, socketMock, getSocketFake, PlatformInstance, platformInstances;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    forkFake = sandbox.fake();
    socketMock = {
      emit: sandbox.spy()
    };
    getSocketFake = sinon.fake.resolves(socketMock);

    const PlatformInstanceMod = proxyquire('./platform-instance', {
      'bull': sandbox.stub().returns({
        on: sandbox.stub()
      }),
      './store': {
        redisConfig: {
          createClient: () => {}
        }
      },
      'child_process': {
        fork: forkFake,
        ChildProcess: sandbox.stub()
      },
      './serve': {
        'io': {
          'in': sandbox.stub().returns({
            fetchSockets: () => {
              return [socketMock];
            }
          })
        },
        getSocket: getSocketFake
      }
    });
    PlatformInstance = PlatformInstanceMod.default;
    platformInstances = PlatformInstanceMod.platformInstances;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('private instance per-actor', () => {
    it("is set as non-global when an actor is provided", () => {
      const pi = new PlatformInstance({
        identifier: 'id',
        platform: 'name',
        parentId: 'parentId',
        actor: 'actor string'
      });
      expect(pi.global).to.be.equal(false);
      sandbox.assert.calledWith(forkFake, FORK_PATH, ['parentId', 'name', 'id']);
      pi.destroy();
    });
  });

  describe('PlatformInstance objects', () => {
    beforeEach(() => {
      pi = new PlatformInstance({
        identifier: 'platform identifier',
        platform: 'a platform name',
        parentId: 'the parentId'
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

    afterEach(() => {
      pi.destroy();
    });

    it('has expected properties', () => {
      expect(typeof PlatformInstance).to.be.equal('function');
    });

    it('should have a platformInstances Map', () => {
      expect(platformInstances instanceof Map).to.be.equal(true);
    });

    it("has certain accessible properties", () => {
      expect(pi.id).to.be.equal('platform identifier');
      expect(pi.name).to.be.equal('a platform name');
      expect(pi.parentId).to.be.equal('the parentId');
      expect(pi.flaggedForTermination).to.be.equal(false);
      expect(pi.global).to.be.equal(true);
      expect(forkFake.calledWith(FORK_PATH, [
        'the parentId', 'a platform name', 'platform identifier'
      ])).to.be.ok;
    });

    describe('registerSession', () => {
      beforeEach(() => {
        pi.callbackFunction = sandbox.fake();
      });

      it('adds a close and message handler when a session is registered', () => {
        pi.registerSession('my session id');
        expect(pi.callbackFunction.callCount).to.equal(2);
        sandbox.assert.calledWith(pi.callbackFunction, 'close', 'my session id');
        sandbox.assert.calledWith(pi.callbackFunction, 'message', 'my session id');
        expect(pi.sessions.has('my session id')).to.be.equal(true);
      });

      it('is able to generate failure reports', () => {
        pi.registerSession('my session id');
        expect(pi.sessions.has('my session id')).to.be.equal(true);
        pi.reportError('my session id', 'an error message');
        pi.sendToClient = sandbox.stub();
        pi.destroy = sandbox.stub();
        expect(pi.sessions.size).to.be.equal(0);
      });

    });


    it('initializes the job queue', () => {
      expect(pi.queue).to.be.undefined;
      pi.initQueue('a secret');
      expect(pi.queue).to.be.ok;
    });

    it("cleans up its references when destroyed", async () => {
      pi.initQueue('a secret');
      expect(pi.queue).to.be.ok;
      expect(platformInstances.has('platform identifier')).to.be.true;
      await pi.destroy();
      expect(pi.queue).not.to.be.ok;
      expect(platformInstances.has('platform identifier')).to.be.false;
    });

    it("updates its identifier when changed", () => {
      pi.updateIdentifier('foo bar');
      expect(pi.id).to.be.equal('foo bar');
      expect(platformInstances.has('platform identifier')).to.be.false;
      expect(platformInstances.has('foo bar')).to.be.true;
    });

    it('sends messages to client using socket session id', async () => {
      await pi.sendToClient('my session id', 'message',
        {foo: 'this is a message object', sessionSecret: 'private data'});
      expect(getSocketFake.callCount).to.equal(1);
      sandbox.assert.calledOnce(getSocketFake);
      sandbox.assert.calledWith(getSocketFake, 'my session id');
      sandbox.assert.calledOnce(socketMock.emit);
      sandbox.assert.calledWith(
        socketMock.emit, 'message', {foo:'this is a message object', context: 'a platform name'});
    });

    it('broadcasts to peers', async () => {
      pi.sessions.add('other peer');
      pi.sessions.add('another peer');
      await pi.broadcastToSharedPeers('myself', {foo: 'bar'});
      expect(getSocketFake.callCount).to.equal(2);
      sandbox.assert.calledWith(getSocketFake, 'other peer');
    });

    describe('handleJobResult', () => {
      beforeEach(() => {
        pi.sendToClient = sandbox.fake();
        pi.broadcastToSharedPeers = sandbox.fake();
      });

      it('broadcasts to peers when handling a completed job', async () => {
        pi.sessions.add('other peer');
        await pi.handleJobResult('completed', {msg: {foo: 'bar'}},
          undefined);
        expect(pi.sendToClient.callCount).to.equal(1);
        expect(pi.broadcastToSharedPeers.callCount).to.equal(1);
      });

      it('appends completed result message when present', async () => {
        await pi.handleJobResult('completed', {msg: {foo: 'bar'}},
          'a good result message');
        expect(pi.broadcastToSharedPeers.callCount).to.equal(1);
        sandbox.assert.calledWith(pi.sendToClient, undefined, 'completed',
          {foo: 'bar', object: {'@type': 'result', content: 'a good result message'}});
      });

      it('appends failed result message when present', async () => {
        await pi.handleJobResult('failed', {msg: {foo: 'bar'}},
          'a bad result message');
        expect(pi.broadcastToSharedPeers.callCount).to.equal(1);
        sandbox.assert.calledWith(pi.sendToClient, undefined, 'failed',
          {foo: 'bar', object: {'@type': 'error', content: 'a bad result message'}});
      });
    });

    describe('callbackFunction', () => {
      beforeEach(() => {
        pi.reportError = sandbox.fake();
        pi.sendToClient = sandbox.fake();
        pi.updateIdentifier = sandbox.fake();
      });

      it('close events from platform thread are reported', () => {
        const close = pi.callbackFunction('close', 'my session id');
        close('error msg');
        sandbox.assert.calledWith(pi.reportError,
          'my session id', 'Error: session thread closed unexpectedly: error msg');
      });

      it('message events from platform thread are route based on command: error', () => {
        const message = pi.callbackFunction('message', 'my session id');
        message(['error', 'error message']);
        sandbox.assert.calledWith(pi.reportError, 'my session id', 'error message');
      });

      it('message events from platform thread are route based on command: updateActor', () => {
        const message = pi.callbackFunction('message', 'my session id');
        message(['updateActor', undefined, {foo: 'bar'}]);
        sandbox.assert.calledWith(pi.updateIdentifier, {foo:'bar'});
      });

      it('message events from platform thread are route based on command: else', () => {
        const message = pi.callbackFunction('message', 'my session id');
        message(['blah', {foo: 'bar'}]);
        sandbox.assert.calledWith(pi.sendToClient,
          'my session id', 'message', {foo:'bar'});
      });
    });
  });
});
