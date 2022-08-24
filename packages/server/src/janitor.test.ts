import proxyquire from 'proxyquire';
import { expect } from 'chai';
import * as sinon from 'sinon';

let sockets = [
  { id: 'socket foo', emit: () => {} },
  { id: 'socket bar', emit: () => {} }
]

proxyquire.noPreserveCache();
proxyquire.noCallThru();

function getPlatformInstanceFake() {
  return {
    flaggedForTermination: false,
    destroy: sinon.stub(),
    process: {
      removeListener: sinon.stub()
    },
    sessions: new Set(['session foo', 'session bar']),
    sessionCallbacks: {
      'close': (() => new Map([
        ['session foo', function sessionFooClose() {}],
        ['session bar', function sessionBarClose() {}]
      ]))(),
      'message': (() => new Map([
        ['session foo', function sessionFooMessage() {}],
        ['session bar', function sessionBarMessage() {}]
      ]))()
    }
  }
}

const cycleInterval = 10;

describe('Janitor', () => {
  let sandbox, fetchSocketsFake, janitor;

  beforeEach((done) => {
    sandbox = sinon.createSandbox();
    fetchSocketsFake = sandbox.stub().returns(sockets);
    const janitorMod = proxyquire('./janitor', {
      listener: {
        io: {
          fetchSockets: fetchSocketsFake
        }
      }
    });
    janitor = janitorMod.default;
    janitor.getSockets = fetchSocketsFake;
    expect(janitor.cycleInterval).to.not.equal(cycleInterval);
    janitor.cycleInterval = cycleInterval;
    expect(janitor.cycleInterval).to.equal(cycleInterval);
    janitor.start();
    setTimeout(() => {
      expect(janitor.cycleCount).to.equal(1);
      done();
    }, cycleInterval)
  });

  afterEach((done) => {
    sandbox.reset();
    janitor.stop();
    setTimeout(() => {
      done();
    }, janitor.cycleInterval * 2)
  });

  it('runs cycle at every cycleInterval', (done) => {
    const currCycleCount = janitor.cycleCount;
    expect(currCycleCount).to.not.equal(0);
    setTimeout(() => {
      expect(janitor.cycleCount).to.equal(currCycleCount + 1);
      setTimeout(() => {
        expect(janitor.cycleCount).to.equal(currCycleCount + 2);
        done();
      }, cycleInterval);
    }, cycleInterval);
  });

  describe('removeSessionCallbacks', () => {
    it('removes session listeners and callbacks for a given platform', () => {
      const pi = getPlatformInstanceFake();
      const barMessage = pi.sessionCallbacks.message.get('session bar');
      const barClose = pi.sessionCallbacks.close.get('session bar');
      pi.flaggedForTermination = true;
      janitor.removeSessionCallbacks(pi, 'session foo');
      sinon.assert.calledTwice(pi.process.removeListener);
      expect(pi.sessionCallbacks.message.get('session foo')).to.be.undefined;
      expect(pi.sessionCallbacks.message.get('session bar')).to.equal(barMessage);
      expect(pi.sessionCallbacks.close.get('session foo')).to.be.undefined;
      expect(pi.sessionCallbacks.close.get('session bar')).to.equal(barClose);
    });
  });

  describe('removeStaleSocketSessions', () => {
    it('doesnt do anything if the socket is active and stop is not flagged', async () => {
      const pi = getPlatformInstanceFake();
      janitor.removeSessionCallbacks = sinon.stub();
      janitor.socketExists = sinon.stub().returns(true);
      expect(janitor.stopTriggered).to.be.false;
      await janitor.removeStaleSocketSessions(pi);
      sinon.assert.notCalled(janitor.removeSessionCallbacks);
    });

    it('removes session if the socket is active and stop is flagged', async () => {
      const pi = getPlatformInstanceFake();
      janitor.removeSessionCallbacks = sinon.stub();
      janitor.socketExists = sinon.stub().returns(true);
      janitor.stop();
      expect(janitor.stopTriggered).to.be.true;
      await janitor.removeStaleSocketSessions(pi);
      sinon.assert.calledTwice(janitor.removeSessionCallbacks);
      sinon.assert.calledWith(janitor.removeSessionCallbacks, pi, 'session foo');
      sinon.assert.calledWith(janitor.removeSessionCallbacks, pi, 'session bar');
    });

    it('removes session if the socket is inactive', async () => {
      const pi = getPlatformInstanceFake();
      janitor.removeSessionCallbacks = sinon.stub();
      janitor.socketExists = sinon.stub().onFirstCall().returns(false).onSecondCall().returns(true);
      expect(janitor.stopTriggered).to.be.false;
      await janitor.removeStaleSocketSessions(pi);
      sinon.assert.calledOnce(janitor.removeSessionCallbacks);
      sinon.assert.calledWith(janitor.removeSessionCallbacks, pi, 'session foo');
    });
  });

  describe('removeStalePlatformInstance', () => {
    it('flags stale platform', async () => {
      const pi = getPlatformInstanceFake();
      expect(pi.flaggedForTermination).to.be.false;
      await janitor.removeStalePlatformInstance(pi);
      sinon.assert.notCalled(pi.destroy);
      expect(pi.flaggedForTermination).to.be.true;
    });

    it('removes flagged stale platform', async () => {
      const pi = getPlatformInstanceFake();
      pi.flaggedForTermination = true;
      await janitor.removeStalePlatformInstance(pi);
      sinon.assert.calledOnce(pi.destroy);
    });
  });

  it('closes all connections when stop() is called', (done) => {
    const prevCycle = janitor.cycleCount;
    janitor.stop();
    setTimeout(() => {
      expect(janitor.cycleCount).to.equal(prevCycle);
      setTimeout(() => {
        expect(janitor.cycleCount).to.equal(prevCycle);
        setTimeout(() => {
          expect(janitor.cycleCount).to.equal(prevCycle);
          done();
        }, cycleInterval)
      }, cycleInterval)
    }, cycleInterval);
  });
})