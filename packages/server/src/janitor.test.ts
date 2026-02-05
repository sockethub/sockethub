import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as sinon from "sinon";

import { Janitor } from "./janitor.js";

const sockets = [
    { id: "socket foo", emit: () => {} },
    { id: "socket bar", emit: () => {} },
];

function getPlatformInstanceFake() {
    return {
        flaggedForTermination: false,
        config: {
            persist: true,
            requireCredentials: ["foo", "bar"],
        },
        global: false,
        isInitialized: sinon.stub().returns(false),
        shutdown: sinon.stub(),
        process: {
            removeListener: sinon.stub(),
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

describe("Janitor", () => {
    let sandbox, fetchSocketsFake, janitor;

    beforeEach((done) => {
        sandbox = sinon.createSandbox();
        fetchSocketsFake = sandbox.stub().returns(sockets);

        janitor = new Janitor();
        janitor.getSockets = fetchSocketsFake;
        expect(janitor.cycleInterval).not.toEqual(cycleInterval);
        janitor.cycleInterval = cycleInterval;
        expect(janitor.cycleInterval).toEqual(cycleInterval);
        janitor.start();
        setTimeout(() => {
            expect(janitor.cycleCount).toEqual(1);
            done();
        }, cycleInterval);
    });

    afterEach((done) => {
        sandbox.reset();
        janitor.stop();
        setTimeout(() => {
            done();
        }, janitor.cycleInterval * 2);
    });

    it("runs cycle at every cycleInterval", (done) => {
        const currCycleCount = janitor.cycleCount;
        expect(currCycleCount).not.toEqual(0);
        setTimeout(() => {
            expect(janitor.cycleCount).toEqual(currCycleCount + 1);
            setTimeout(() => {
                expect(janitor.cycleCount).toEqual(currCycleCount + 2);
                done();
            }, cycleInterval);
        }, cycleInterval);
    });

    describe("removeSessionCallbacks", () => {
        it("removes session listeners and callbacks for a given platform", () => {
            const pi = getPlatformInstanceFake();
            const barMessage = pi.sessionCallbacks.message.get("session bar");
            const barClose = pi.sessionCallbacks.close.get("session bar");
            pi.flaggedForTermination = true;
            janitor.removeSessionCallbacks(pi, "session foo");
            sinon.assert.calledTwice(pi.process.removeListener);
            expect(
                pi.sessionCallbacks.message.get("session foo"),
            ).toBeUndefined();
            expect(pi.sessionCallbacks.message.get("session bar")).toEqual(
                barMessage,
            );
            expect(
                pi.sessionCallbacks.close.get("session foo"),
            ).toBeUndefined();
            expect(pi.sessionCallbacks.close.get("session bar")).toEqual(
                barClose,
            );
        });
    });

    describe("removeStaleSocketSessions", () => {
        it("doesnt do anything if the socket is active and stop is not flagged", async () => {
            const pi = getPlatformInstanceFake();
            janitor.removeSessionCallbacks = sinon.stub();
            janitor.socketExists = sinon.stub().returns(true);
            expect(janitor.stopTriggered).toBeFalse();
            await janitor.removeStaleSocketSessions(pi);
            sinon.assert.notCalled(janitor.removeSessionCallbacks);
        });

        it("removes session if the socket is active and stop is flagged", async () => {
            const pi = getPlatformInstanceFake();
            janitor.removeSessionCallbacks = sinon.stub();
            janitor.socketExists = sinon.stub().returns(true);
            janitor.stop();
            expect(janitor.stopTriggered).toBeTrue();
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
            expect(janitor.stopTriggered).toBeFalse();
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
            pi.isInitialized.returns(false);
            janitor.removeStaleSocketSessions = sandbox.stub();
            janitor.removeStalePlatformInstance = sandbox.stub();
            await janitor.performStaleCheck(pi);
            sinon.assert.calledOnce(janitor.removeStaleSocketSessions);
            sinon.assert.calledOnce(janitor.removeStalePlatformInstance);
            expect(pi.flaggedForTermination).toBeTrue();
        });

        it("flags for termination when there are not sockets", async () => {
            const pi = getPlatformInstanceFake();
            pi.sessions = new Set();
            pi.flaggedForTermination = false;
            pi.isInitialized.returns(true);
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
            expect(pi.flaggedForTermination).toBeFalse();
            await janitor.removeStalePlatformInstance(pi);
            sinon.assert.notCalled(pi.shutdown);
            expect(pi.flaggedForTermination).toBeTrue();
        });

        it("removes flagged stale platform", async () => {
            const pi = getPlatformInstanceFake();
            pi.flaggedForTermination = true;
            await janitor.removeStalePlatformInstance(pi);
            sinon.assert.calledOnce(pi.shutdown);
        });
    });

    it("closes all connections when stop() is called", (done) => {
        const prevCycle = janitor.cycleCount;
        janitor.stop();
        setTimeout(() => {
            expect(janitor.cycleCount).toEqual(prevCycle);
            setTimeout(() => {
                expect(janitor.cycleCount).toEqual(prevCycle);
                setTimeout(() => {
                    expect(janitor.cycleCount).toEqual(prevCycle);
                    done();
                }, cycleInterval);
            }, cycleInterval);
        }, cycleInterval);
    });
});
