import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as sinon from "sinon";

import config from "./config.js";
import PlatformInstance, { platformInstances } from "./platform-instance.js";
import ProcessManager from "./process-manager.js";

describe("ProcessManager", () => {
    let sandbox: sinon.SinonSandbox;
    let maxPlatformInstances: number;
    let manager: ProcessManager;

    function fakePlatforms(persist: boolean) {
        const platforms = new Map();
        platforms.set("fakeplatform", {
            config: { persist },
            contextUrl: "https://sockethub.org/ns/context/platform/fakeplatform/v1.jsonld",
        });
        return platforms;
    }

    // Marks the instance's forked child process as alive (isProcessAlive
    // sends signal 0 to this pid; the test runner's own pid always exists)
    // or dead (falsy pid short-circuits isProcessAlive to false).
    function setAlive(pi: PlatformInstance, alive: boolean) {
        pi.process = {
            ...pi.process,
            pid: alive ? process.pid : undefined,
            exitCode: null,
        } as never;
    }

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        platformInstances.clear();
        maxPlatformInstances = 0;

        sandbox
            .stub(PlatformInstance.prototype, "createQueue")
            .callsFake(function (this: PlatformInstance) {
                this.JobQueue = sandbox.stub().returns({
                    shutdown: sandbox.stub().resolves(),
                    disconnect: sandbox.stub().resolves(),
                    on: sandbox.stub(),
                }) as never;
            });
        sandbox
            .stub(PlatformInstance.prototype, "initProcess")
            .callsFake(function (this: PlatformInstance) {
                this.process = {
                    pid: process.pid,
                    exitCode: null,
                    on: sandbox.spy(),
                    removeListener: sandbox.spy(),
                    removeAllListeners: sandbox.spy(),
                    unref: sandbox.spy(),
                    kill: sandbox.spy(),
                    send: sandbox.spy(),
                } as never;
            });
        sandbox
            .stub(PlatformInstance.prototype, "createGetSocket")
            .callsFake(function (this: PlatformInstance) {
                this.getSocket = sandbox.stub() as never;
            });

        const realGet = config.get;
        sandbox.stub(config, "get").callsFake((key: string) => {
            if (key === "limits:maxPlatformInstances") {
                return maxPlatformInstances;
            }
            return realGet(key);
        });

        manager = new ProcessManager(
            "parent id",
            "parent secret 1",
            "parent secret 2",
            { version: "0.0.0", platforms: fakePlatforms(true) },
        );
    });

    afterEach(() => {
        sandbox.restore();
        platformInstances.clear();
    });

    test("disabled cap (0) allows unbounded instance creation", () => {
        maxPlatformInstances = 0;
        for (let i = 0; i < 5; i++) {
            expect(() =>
                manager.get("fakeplatform", `actor-${i}`),
            ).not.toThrow();
        }
        expect(platformInstances.size).toEqual(5);
    });

    test("blocks a new actor once the cap is reached", () => {
        maxPlatformInstances = 1;
        manager.get("fakeplatform", "actor-a");
        expect(() => manager.get("fakeplatform", "actor-b")).toThrow(
            /platform instance limit reached/,
        );
        expect(platformInstances.size).toEqual(1);
    });

    test("always allows reusing a live instance regardless of the cap", () => {
        maxPlatformInstances = 1;
        const first = manager.get("fakeplatform", "actor-a");
        setAlive(first, true);
        const second = manager.get("fakeplatform", "actor-a");
        expect(second).toBe(first);
        expect(platformInstances.size).toEqual(1);
    });

    test("allows the same actor to replace its own dead instance at the cap", () => {
        maxPlatformInstances = 1;
        const first = manager.get("fakeplatform", "actor-a");
        setAlive(first, false);
        expect(() =>
            manager.get("fakeplatform", "actor-a"),
        ).not.toThrow();
        expect(platformInstances.size).toEqual(1);
    });

    test("marks a dead instance as replaced before shutting it down", () => {
        const first = manager.get("fakeplatform", "actor-a");
        setAlive(first, false);
        const markReplaced = sandbox.spy(first, "markReplaced");
        const shutdown = sandbox.stub(first, "shutdown").resolves();
        const second = manager.get("fakeplatform", "actor-a");
        expect(second).not.toBe(first);
        sinon.assert.calledOnce(markReplaced);
        sinon.assert.calledOnce(shutdown);
        expect(markReplaced.calledBefore(shutdown)).toEqual(true);
    });

    test("the dead instance's async teardown does not evict the replacement from the map", async () => {
        const first = manager.get("fakeplatform", "actor-a");
        setAlive(first, false);
        const second = manager.get("fakeplatform", "actor-a");
        expect(second).not.toBe(first);
        // ensureProcess fires the old instance's shutdown without awaiting
        // it; let it finish, then verify the replacement still owns the slot
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(platformInstances.get(second.id)).toBe(second);
    });

    test("does not shut down a live instance when reusing it", () => {
        const first = manager.get("fakeplatform", "actor-a");
        setAlive(first, true);
        const markReplaced = sandbox.spy(first, "markReplaced");
        const shutdown = sandbox.stub(first, "shutdown").resolves();
        const second = manager.get("fakeplatform", "actor-a");
        expect(second).toBe(first);
        sinon.assert.notCalled(markReplaced);
        sinon.assert.notCalled(shutdown);
    });
});
