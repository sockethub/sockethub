import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as sinon from "sinon";

import { Janitor } from "./janitor.js";

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
        sessionIps: new Map([
            ["session foo", "127.0.0.1"],
            ["session bar", "127.0.0.1"],
        ]),
    };
}

const cycleInterval = 10;

describe("Janitor", () => {
    let sandbox, janitor;

    beforeEach((done) => {
        sandbox = sinon.createSandbox();

        janitor = new Janitor();
        // The live cycle reads socket.io's connected-socket map; stub it so the
        // janitor can be tested without standing up a socket.io server.
        janitor.connectedSocketIds = sandbox.stub().returns(new Map());
        expect(janitor.cycleInterval).not.toEqual(cycleInterval);
        janitor.cycleInterval = cycleInterval;
        expect(janitor.cycleInterval).toEqual(cycleInterval);
        janitor.start();
        setTimeout(() => {
            // The janitor has started and is cycling. Assert progress rather
            // than an exact count — cycle timing against real timers is not
            // deterministic to a single tick.
            expect(janitor.cycleCount).toBeGreaterThanOrEqual(1);
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

    test("runs cycle at every cycleInterval", (done) => {
        const currCycleCount = janitor.cycleCount;
        expect(currCycleCount).not.toEqual(0);
        setTimeout(() => {
            const afterOne = janitor.cycleCount;
            expect(afterOne).toBeGreaterThan(currCycleCount);
            setTimeout(() => {
                expect(janitor.cycleCount).toBeGreaterThan(afterOne);
                done();
            }, cycleInterval);
        }, cycleInterval);
    });

    describe("socketExists", () => {
        test("reflects membership in the live connected-socket map", () => {
            janitor.connectedSocketIds = sandbox
                .stub()
                .returns(new Map([["live session", {}]]));
            expect(janitor.socketExists("live session")).toBeTrue();
            expect(janitor.socketExists("gone session")).toBeFalse();
        });
    });

    describe("removeStaleSocketSessions", () => {
        test("doesnt do anything if the socket is active and stop is not flagged", async () => {
            const pi = getPlatformInstanceFake();
            janitor.socketExists = sinon.stub().returns(true);
            expect(janitor.stopTriggered).toBeFalse();
            await janitor.removeStaleSocketSessions(pi);
            expect(pi.sessions.has("session foo")).toBeTrue();
            expect(pi.sessions.has("session bar")).toBeTrue();
        });

        test("removes session if the socket is active and stop is flagged", async () => {
            const pi = getPlatformInstanceFake();
            janitor.socketExists = sinon.stub().returns(true);
            janitor.stop();
            expect(janitor.stopTriggered).toBeTrue();
            await janitor.removeStaleSocketSessions(pi);
            expect(pi.sessions.size).toEqual(0);
            expect(pi.sessionIps.size).toEqual(0);
        });

        test("removes session if the socket is inactive", async () => {
            const pi = getPlatformInstanceFake();
            janitor.socketExists = sinon
                .stub()
                .onFirstCall()
                .returns(false)
                .onSecondCall()
                .returns(true);
            expect(janitor.stopTriggered).toBeFalse();
            await janitor.removeStaleSocketSessions(pi);
            expect(pi.sessions.has("session foo")).toBeFalse();
            expect(pi.sessions.has("session bar")).toBeTrue();
        });
    });

    describe("performStaleCheck", () => {
        test("removes flagged and uninitialized platform instances", async () => {
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

        test("flags for termination when there are not sockets", async () => {
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
        test("flags stale platform", async () => {
            const pi = getPlatformInstanceFake();
            expect(pi.flaggedForTermination).toBeFalse();
            await janitor.removeStalePlatformInstance(pi);
            sinon.assert.notCalled(pi.shutdown);
            expect(pi.flaggedForTermination).toBeTrue();
        });

        test("removes flagged stale platform", async () => {
            const pi = getPlatformInstanceFake();
            pi.flaggedForTermination = true;
            await janitor.removeStalePlatformInstance(pi);
            sinon.assert.calledOnce(pi.shutdown);
        });
    });

    test("closes all connections when stop() is called", (done) => {
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
