import "https://deno.land/x/deno_mocha/global.ts";
import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { assertSpyCallArg, assertSpyCalls, spy } from "jsr:@std/testing/mock";
import sinon from "npm:sinon";
import { Janitor } from "./janitor.ts";

const sockets = [
  { id: "socket foo", emit: () => {} },
  { id: "socket bar", emit: () => {} },
];

function getPlatformInstanceFake() {
  return {
    flaggedForTermination: false,
    initialized: false,
    global: false,
    shutdown: sinon.spy(),
    process: {
      removeListener: sinon.spy(),
    },
    sessions: new Set(["session foo", "session bar"]),
    sessionCallbacks: {
      close: (() =>
        new Map([
          ["session foo", function sessionFooClose() {}],
          ["session bar", function sessionBarClose() {}],
        ]))(),
      message: (() =>
        new Map([
          ["session foo", function sessionFooMessage() {}],
          ["session bar", function sessionBarMessage() {}],
        ]))(),
    },
  };
}

const cycleInterval = 10;

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Janitor", () => {
  let sandbox: sinon.Sandbox, fetchSocketsFake, janitor: Janitor;

  beforeEach(async () => {
    await timeout(3000);

    sandbox = sinon.createSandbox();
    fetchSocketsFake = sandbox.stub().returns(sockets);

    janitor = new Janitor();
    janitor.getSockets = fetchSocketsFake;

    assertNotEquals(janitor.cycleInterval, cycleInterval);
    janitor.cycleInterval = cycleInterval;
    assertEquals(janitor.cycleInterval, cycleInterval);
    janitor.start();

    await timeout(cycleInterval);
    assertEquals(janitor.cycleCount, 1);
  });

  afterEach(async () => {
    sandbox.reset();
    await timeout(janitor.cycleInterval * 2);
    janitor.stop();
  });

  it("runs cycle at every cycleInterval", async () => {
    const currCycleCount = janitor.cycleCount;
    assertNotEquals(currCycleCount, 0);
    await timeout(cycleInterval);
    assertEquals(janitor.cycleCount, currCycleCount + 1);
    await timeout(cycleInterval);
    assertEquals(janitor.cycleCount, currCycleCount + 2);
  });

  describe("removeSessionCallbacks", () => {
    it("removes session listeners and callbacks for a given platform", () => {
      const pi = getPlatformInstanceFake();
      const barMessage = pi.sessionCallbacks.message.get("session bar");
      const barClose = pi.sessionCallbacks.close.get("session bar");
      pi.flaggedForTermination = true;
      janitor.removeSessionCallbacks(pi, "session foo");
      sinon.assert.calledTwice(pi.process.removeListener);
      assertEquals(pi.sessionCallbacks.message.get("session foo"), undefined);
      assertEquals(pi.sessionCallbacks.message.get("session bar"), barMessage);
      assertEquals(pi.sessionCallbacks.close.get("session foo"), undefined);
      assertEquals(pi.sessionCallbacks.close.get("session bar"), barClose);
    });
  });

  describe("removeStaleSocketSessions", () => {
    it("doesnt do anything if the socket is active and stop is not flagged", async () => {
      const pi = getPlatformInstanceFake();
      janitor.removeSessionCallbacks = sinon.stub();
      janitor.socketExists = sinon.stub().returns(true);
      assertEquals(janitor.stopTriggered, false);
      await janitor.removeStaleSocketSessions(pi);
      sinon.assert.notCalled(janitor.removeSessionCallbacks);
    });

    it("removes session if the socket is active and stop is flagged", async () => {
      const pi = getPlatformInstanceFake();
      janitor.removeSessionCallbacks = sinon.stub();
      janitor.socketExists = sinon.stub().returns(true);
      janitor.stop();
      assertEquals(janitor.stopTriggered, true);
      await janitor.removeStaleSocketSessions(pi);
      sinon.assert.calledTwice(janitor.removeSessionCallbacks);
      sinon.assert.calledWith(
        janitor.removeSessionCallbacks,
        pi,
        "session foo",
      );
      sinon.assert.calledWith(
        janitor.removeSessionCallbacks,
        pi,
        "session bar",
      );
    });

    it("removes session if the socket is inactive", async () => {
      const pi = getPlatformInstanceFake();
      janitor.removeSessionCallbacks = sinon.stub();
      janitor.socketExists = sinon
        .stub()
        .onFirstCall()
        .returns(false)
        .onSecondCall()
        .returns(true);
      assertEquals(janitor.stopTriggered, false);
      await janitor.removeStaleSocketSessions(pi);
      sinon.assert.calledOnce(janitor.removeSessionCallbacks);
      sinon.assert.calledWith(
        janitor.removeSessionCallbacks,
        pi,
        "session foo",
      );
    });
  });

  describe("performStaleCheck", () => {
    it("removes flagged and uninitialized platform instances", async () => {
      const pi = getPlatformInstanceFake();
      pi.flaggedForTermination = true;
      pi.initialized = false;
      janitor.removeStaleSocketSessions = sandbox.stub();
      janitor.removeStalePlatformInstance = sandbox.stub();
      await janitor.performStaleCheck(pi);
      sinon.assert.calledOnce(janitor.removeStaleSocketSessions);
      sinon.assert.calledOnce(janitor.removeStalePlatformInstance);
      assertEquals(pi.flaggedForTermination, true);
    });

    it("flags for termination when there are not sockets", async () => {
      const pi = getPlatformInstanceFake();
      pi.sessions = new Set();
      pi.flaggedForTermination = false;
      pi.initialized = true;
      janitor.removeStaleSocketSessions = sandbox.stub();
      janitor.removeStalePlatformInstance = sandbox.stub();
      await janitor.performStaleCheck(pi);
      sinon.assert.calledOnce(janitor.removeStaleSocketSessions);
      sinon.assert.calledOnce(janitor.removeStalePlatformInstance);
    });
  });

  describe("removeStalePlatformInstance", () => {
    it("flags stale platform", async () => {
      const pi = getPlatformInstanceFake();
      assertEquals(pi.flaggedForTermination, false);
      await janitor.removeStalePlatformInstance(pi);
      sinon.assert.notCalled(pi.shutdown);
      assertEquals(pi.flaggedForTermination, true);
    });

    it("removes flagged stale platform", async () => {
      const pi = getPlatformInstanceFake();
      pi.flaggedForTermination = true;
      await janitor.removeStalePlatformInstance(pi);
      sinon.assert.calledOnce(pi.shutdown);
    });
  });

  it("closes all connections when stop() is called", async () => {
    const prevCycle = janitor.cycleCount;
    janitor.stop();
    await timeout(cycleInterval);
    assertEquals(janitor.cycleCount, prevCycle);
    await timeout(cycleInterval);
    assertEquals(janitor.cycleCount, prevCycle);
    await timeout(cycleInterval);
    assertEquals(janitor.cycleCount, prevCycle);
  });
});
