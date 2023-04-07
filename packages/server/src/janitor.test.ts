import proxyquire from 'proxyquire';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox } from "sinon";
import { JanitorInterface } from "./janitor";
import PlatformInstance, { SessionCallback } from "./platform-instance";
import { SocketInstance } from "./listener";
import { ChildProcess } from "child_process";

proxyquire.noPreserveCache();
proxyquire.noCallThru();

let sockets = [
  { id: 'socket foo', emit: () => {} },
  { id: 'socket bar', emit: () => {} }
]

// define private functions as public for testing
interface JanitorTestInterface extends JanitorInterface {
  stopTriggered: boolean;
  sockets: Array<SocketInstance>;
  removeSessionCallbacks(platformInstance: PlatformInstance, sessionId: string): void;
  removeStalePlatformInstance(platformInstance: PlatformInstance): Promise<void>;
  removeStaleSocketSessions(
    platformInstance: PlatformInstance
  ): void;
  socketExists(sessionId: string): boolean;
  delay(ms: number): Promise<void>
  getSockets(): Promise<Array<SocketInstance>>;
  performStaleCheck(platformInstance: PlatformInstance): Promise<void>;
}

interface PlatformInstanceFake extends PlatformInstance {
  sessions: Set<string>;
}

const sessionCallback: SessionCallback = (e: object): Promise<void> => { return Promise.resolve() }

function getPlatformInstanceFake(): PlatformInstanceFake {
  return {
    flaggedForTermination: false,
    initialized: false,
    global: false,
    shutdown: sinon.stub(),
    // @ts-ignore
    process: {
      removeListener: sinon.stub()
    } as Partial<ChildProcess>,
    sessions: new Set(['session foo', 'session bar']),
    sessionCallbacks: {
      close: (() => new Map([
        ['session foo', sessionCallback],
        ['session bar', sessionCallback]
      ]))(),
      message: (() => new Map([
        ['session foo', sessionCallback],
        ['session bar', sessionCallback]
      ]))()
    }
  };
}

const cycleInterval = 10;

describe('Janitor', () => {
  let sandbox: SinonSandbox, fetchSocketsFake, janitor: JanitorTestInterface;

  beforeEach(function (done) {
    this.timeout(3000);
    sandbox = sinon.createSandbox();
    fetchSocketsFake = sandbox.stub().returns(sockets);
    const janitorMod = proxyquire('./janitor', {
      listener: {
        io: {
          fetchSockets: fetchSocketsFake
        }
      }
    });
    janitor = janitorMod.default as JanitorTestInterface;
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
      // @ts-ignore
      sinon.assert.calledTwice(pi.process.removeListener);
      expect(pi.sessionCallbacks.message.get('session foo')).to.be.undefined;
      expect(pi.sessionCallbacks.message.get('session bar')).to.equal(barMessage);
      expect(pi.sessionCallbacks.close.get('session foo')).to.be.undefined;
      expect(pi.sessionCallbacks.close.get('session bar')).to.equal(barClose);
    });
  });

  describe('removeStaleSocketSessions', () => {
    let pi: PlatformInstance;
    beforeEach(() => {
      pi = getPlatformInstanceFake();
      sinon.stub(janitor, 'removeSessionCallbacks');
    })
    it('doesnt do anything if the socket is active and stop is not flagged', async () => {
      sinon.stub(janitor, 'socketExists').returns(true);
      expect(janitor.stopTriggered).to.be.false;
      await janitor.removeStaleSocketSessions(pi);
      // @ts-ignore
      sinon.assert.notCalled(janitor.removeSessionCallbacks);
    });

    it('removes session if the socket is active and stop is flagged', async () => {
      sinon.stub(janitor, 'socketExists').returns(true);
      janitor.stop();
      expect(janitor.stopTriggered).to.be.true;
      await janitor.removeStaleSocketSessions(pi);
      // @ts-ignore
      sinon.assert.calledTwice(janitor.removeSessionCallbacks);
      // @ts-ignore
      sinon.assert.calledWith(janitor.removeSessionCallbacks, pi, 'session foo');
      // @ts-ignore
      sinon.assert.calledWith(janitor.removeSessionCallbacks, pi, 'session bar');
    });

    it('removes session if the socket is inactive', async () => {
      sinon.stub(janitor, 'socketExists').onFirstCall().returns(false).onSecondCall().returns(true);
      expect(janitor.stopTriggered).to.be.false;
      await janitor.removeStaleSocketSessions(pi);
      // @ts-ignore
      sinon.assert.calledOnce(janitor.removeSessionCallbacks);
      // @ts-ignore
      sinon.assert.calledWith(janitor.removeSessionCallbacks, pi, 'session foo');
    });
  });

  describe('performStaleCheck', () => {
    let pi: PlatformInstanceFake;
    beforeEach(() => {
      pi = getPlatformInstanceFake();
      sinon.stub(janitor, 'removeStaleSocketSessions');
      sinon.stub(janitor, 'removeStalePlatformInstance');
    })
    it('removes flagged and uninitialized platform instances', async () => {
      pi.flaggedForTermination = true;
      pi.initialized = false;
      await janitor.performStaleCheck(pi);
      // @ts-ignore
      sinon.assert.calledOnce(janitor.removeStaleSocketSessions);
      // @ts-ignore
      sinon.assert.calledOnce(janitor.removeStalePlatformInstance);
      expect(pi.flaggedForTermination).to.be.true;
    });

    it('flags for termination when there are not sockets', async () => {
      pi.sessions = new Set();
      pi.flaggedForTermination = false;
      pi.initialized = true;
      await janitor.performStaleCheck(pi);
      // @ts-ignore
      sinon.assert.calledOnce(janitor.removeStaleSocketSessions);
      // @ts-ignore
      sinon.assert.calledOnce(janitor.removeStalePlatformInstance);
    });
  });

  describe('removeStalePlatformInstance', () => {
    it('flags stale platform', async () => {
      const pi = getPlatformInstanceFake();
      expect(pi.flaggedForTermination).to.be.false;
      await janitor.removeStalePlatformInstance(pi);
      // @ts-ignore
      sinon.assert.notCalled(pi.shutdown);
      expect(pi.flaggedForTermination).to.be.true;
    });

    it('removes flagged stale platform', async () => {
      const pi = getPlatformInstanceFake();
      pi.flaggedForTermination = true;
      await janitor.removeStalePlatformInstance(pi);
      // @ts-ignore
      sinon.assert.calledOnce(pi.shutdown);
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
