import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as sinon from "sinon";

import config from "./config.js";
import {
    beginCredentialScope,
    resetConnectionScopes,
} from "./connection-scope.js";
import listener from "./listener.js";
import PlatformInstance, { platformInstances } from "./platform-instance.js";
import ProcessManager from "./process-manager.js";

describe("ProcessManager", () => {
    let sandbox: sinon.SinonSandbox;
    let maxPlatformInstances: number;
    let maxInstancesPerSession: number;
    let maxInstancesPerIp: number;
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
        maxInstancesPerSession = 0;
        maxInstancesPerIp = 0;

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
            if (key === "limits:maxInstancesPerSession") return maxInstancesPerSession;
            if (key === "limits:maxInstancesPerIp") return maxInstancesPerIp;
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
        resetConnectionScopes();
    });

    // Stands in for the credentials event: registers what a session submitted
    // for an actor, which is what the instance key is derived from.
    function submitCredentials(
        sessionId: string,
        actor: string,
        object: Record<string, unknown>,
    ) {
        beginCredentialScope(sessionId, "fakeplatform", actor).resolve({
            "@context": [],
            type: "credentials",
            actor: { id: actor, type: "person" },
            object: { type: "credentials", ...object },
        } as never);
    }

    it("disabled cap (0) allows unbounded instance creation", async () => {
        maxPlatformInstances = 0;
        for (let i = 0; i < 5; i++) {
            await manager.get("fakeplatform", `actor-${i}`, "session-a");
        }
        expect(platformInstances.size).toEqual(5);
    });

    it("blocks a new actor once the cap is reached", async () => {
        maxPlatformInstances = 1;
        await manager.get("fakeplatform", "actor-a", "session-a");
        await expect(manager.get("fakeplatform", "actor-b", "session-a")).rejects.toThrow(
            /platform instance limit reached/,
        );
        expect(platformInstances.size).toEqual(1);
    });

    it("always allows reusing a live instance regardless of the cap", async () => {
        maxPlatformInstances = 1;
        const first = await manager.get("fakeplatform", "actor-a", "session-a");
        setAlive(first, true);
        const second = await manager.get("fakeplatform", "actor-a", "session-a");
        expect(second).toBe(first);
        expect(platformInstances.size).toEqual(1);
    });

    it("allows the same actor to replace its own dead instance at the cap", async () => {
        maxPlatformInstances = 1;
        const first = await manager.get("fakeplatform", "actor-a", "session-a");
        setAlive(first, false);
        await manager.get("fakeplatform", "actor-a", "session-a");
        expect(platformInstances.size).toEqual(1);
    });

    it("marks a dead instance as replaced before shutting it down", async () => {
        const first = await manager.get("fakeplatform", "actor-a", "session-a");
        setAlive(first, false);
        const markReplaced = sandbox.spy(first, "markReplaced");
        const shutdown = sandbox.stub(first, "shutdown").resolves();
        const second = await manager.get("fakeplatform", "actor-a", "session-a");
        expect(second).not.toBe(first);
        sinon.assert.calledOnce(markReplaced);
        sinon.assert.calledOnce(shutdown);
        expect(markReplaced.calledBefore(shutdown)).toEqual(true);
    });

    it("the dead instance's teardown does not evict the replacement from the map", async () => {
        const first = await manager.get("fakeplatform", "actor-a", "session-a");
        setAlive(first, false);
        const second = await manager.get("fakeplatform", "actor-a", "session-a");
        expect(second).not.toBe(first);
        expect(platformInstances.get(second.id)).toBe(second);
    });

    it("replacement inherits the dead instance queue id", async () => {
        const first = await manager.get("fakeplatform", "actor-a", "session-a");
        const queueId = first.queueId;
        setAlive(first, false);
        const second = await manager.get("fakeplatform", "actor-a", "session-a");
        expect(second).not.toBe(first);
        expect(second.queueId).toEqual(queueId);
    });

    it("does not shut down a live instance when reusing it", async () => {
        const first = await manager.get("fakeplatform", "actor-a", "session-a");
        setAlive(first, true);
        const markReplaced = sandbox.spy(first, "markReplaced");
        const shutdown = sandbox.stub(first, "shutdown").resolves();
        const second = await manager.get("fakeplatform", "actor-a", "session-a");
        expect(second).toBe(first);
        sinon.assert.notCalled(markReplaced);
        sinon.assert.notCalled(shutdown);
    });

    it("waits for the dead instance's in-flight teardown before creating the replacement", async () => {
        const first = await manager.get("fakeplatform", "actor-a", "session-a");
        setAlive(first, false);
        let releaseTeardown: () => void;
        const teardown = new Promise<void>((resolve) => {
            releaseTeardown = resolve;
        });
        sandbox.stub(first, "shutdown").returns(teardown);
        let second: PlatformInstance | undefined;
        const pending = manager.get("fakeplatform", "actor-a", "session-a").then((pi) => {
            second = pi;
            return pi;
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        // The replacement (and its queue, which shares the dead instance's
        // Redis queue name) must not exist while the old teardown — which
        // may be obliterating that queue — is still running; jobs added to
        // the replacement's queue in that window would be destroyed.
        expect(second).toBeUndefined();
        releaseTeardown();
        const replacement = await pending;
        expect(replacement).not.toBe(first);
        expect(platformInstances.get(replacement.id)).toBe(replacement);
    });

    it("concurrent requests for the same dead instance produce a single replacement", async () => {
        const first = await manager.get("fakeplatform", "actor-a", "session-a");
        setAlive(first, false);
        const [a, b] = await Promise.all([
            manager.get("fakeplatform", "actor-a", "session-a"),
            manager.get("fakeplatform", "actor-a", "session-a"),
        ]);
        expect(a).toBe(b);
        expect(platformInstances.size).toEqual(1);
    });

    it("rechecks capacity after a dead worker finishes teardown", async () => {
        maxPlatformInstances = 1;
        const first = await manager.get("fakeplatform", "a", "a");
        setAlive(first, false);
        let release: () => void = () => {};
        const teardown = new Promise<void>((resolve) => { release = resolve; });
        sandbox.stub(first, "shutdown").callsFake(async () => {
            platformInstances.delete(first.id);
            await teardown;
        });
        const replacement = manager.get("fakeplatform", "a", "a");
        await new Promise((resolve) => setTimeout(resolve, 0));
        await manager.get("fakeplatform", "b", "b");
        release();
        await expect(replacement).rejects.toThrow("platform instance limit reached");
        expect(platformInstances.size).toBe(1);
    });

    it("bounds concurrent actor churn per session while admitting another client", async () => {
        maxPlatformInstances = 3;
        maxInstancesPerSession = 1;
        const results = await Promise.allSettled([
            manager.get("fakeplatform", "a", "attacker"),
            manager.get("fakeplatform", "b", "attacker"),
        ]);
        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
        await manager.get("fakeplatform", "c", "victim");
        expect(platformInstances.size).toBe(2);
    });

    it("bounds multiple sockets and HTTP sessions at one IP", async () => {
        maxInstancesPerIp = 1;
        const first = await manager.get("fakeplatform", "a", undefined, "10.0.0.1", "http-a");
        await expect(manager.get("fakeplatform", "b", "socket-b", "10.0.0.1")).rejects.toThrow("per-address");
        await expect(manager.get("fakeplatform", "c", undefined, "10.0.0.1", "http-c")).rejects.toThrow("per-address");
        await manager.get("fakeplatform", "d", "socket-d", "10.0.0.2");
        await first.shutdown();
        await manager.get("fakeplatform", "e", "socket-e", "10.0.0.1");
    });

    it("charges shared instances to each attached session and IP", async () => {
        maxInstancesPerSession = 1;
        maxInstancesPerIp = 1;
        for (const session of ["a", "b"]) {
            submitCredentials(session, "shared", { password: "shared" });
        }
        const shared = await manager.get("fakeplatform", "shared", "a", "10.0.0.1");
        await manager.get("fakeplatform", "shared", "b", "10.0.0.2");
        await expect(manager.get("fakeplatform", "other", "b", "10.0.0.2")).rejects.toThrow("per-session");
        await expect(manager.get("fakeplatform", "other", "c", "10.0.0.2")).rejects.toThrow("per-address");
        expect(await manager.get("fakeplatform", "shared", "b", "10.0.0.2")).toBe(shared);
    });

    it("checks owner limits before joining an existing shared instance", async () => {
        maxInstancesPerSession = 1;
        await manager.get("fakeplatform", "own", "b");
        for (const session of ["a", "b"]) submitCredentials(session, "shared", { password: "shared" });
        const shared = await manager.get("fakeplatform", "shared", "a");
        await expect(manager.get("fakeplatform", "shared", "b")).rejects.toThrow("per-session");
        expect(shared.sessions.has("b")).toBe(false);
    });

    it("starts and restarts stateless workers at the persistent cap", async () => {
        maxPlatformInstances = 1;
        const stateless = new ProcessManager("parent", "secret1", "secret2", {
            version: "0.0.0", platforms: fakePlatforms(false),
        });
        const first = await stateless.get("fakeplatform", "feed");
        await manager.get("fakeplatform", "a", "a");
        setAlive(first, false);
        const second = await stateless.get("fakeplatform", "feed");
        expect(second).not.toBe(first);
        expect(platformInstances.size).toBe(2);
    });

    describe("connection scope", () => {
        const originalIo = (listener as unknown as { io: unknown }).io;
        afterEach(() => {
            (listener as unknown as { io: unknown }).io = originalIo;
        });

        it("a different session with different credentials gets its own instance", async () => {
            submitCredentials("session-a", "actor-a", { password: "correct" });
            submitCredentials("session-b", "actor-a", { password: "guessed" });

            const mine = await manager.get(
                "fakeplatform",
                "actor-a",
                "session-a",
            );
            const theirs = await manager.get(
                "fakeplatform",
                "actor-a",
                "session-b",
            );

            expect(theirs).not.toBe(mine);
            expect(platformInstances.size).toEqual(2);
        });

        it("a session with matching credentials shares the instance", async () => {
            submitCredentials("session-a", "actor-a", { password: "shared" });
            submitCredentials("session-b", "actor-a", { password: "shared" });

            const first = await manager.get(
                "fakeplatform",
                "actor-a",
                "session-a",
            );
            const second = await manager.get(
                "fakeplatform",
                "actor-a",
                "session-b",
            );

            expect(second).toBe(first);
            expect(platformInstances.size).toEqual(1);
        });

        it("knowing the actor id alone reaches nothing", async () => {
            submitCredentials("session-a", "actor-a", { password: "correct" });
            const mine = await manager.get(
                "fakeplatform",
                "actor-a",
                "session-a",
            );

            // No credentials submitted: an actor id is all this session has.
            const probe = await manager.get(
                "fakeplatform",
                "actor-a",
                "session-b",
            );

            expect(probe).not.toBe(mine);
        });

        it("two anonymous sessions on one actor stay separate", async () => {
            const first = await manager.get(
                "fakeplatform",
                "actor-a",
                "session-a",
                "10.0.0.1",
            );
            const second = await manager.get(
                "fakeplatform",
                "actor-a",
                "session-b",
                "10.0.0.2",
            );

            expect(second).not.toBe(first);
        });

        it("an anonymous refresh from the same ip reuses the instance", async () => {
            // socket-1 is connected for the first call, then goes away.
            (listener as unknown as { io: unknown }).io = {
                sockets: { sockets: new Map([["socket-1", {}]]) },
            };
            const first = await manager.get(
                "fakeplatform",
                "actor-a",
                "socket-1",
                "127.0.0.1",
            );
            // socket-1 has gone away; the refreshed page arrives as socket-2.
            (listener as unknown as { io: unknown }).io = {
                sockets: { sockets: new Map([["socket-2", {}]]) },
            };
            const second = await manager.get(
                "fakeplatform",
                "actor-a",
                "socket-2",
                "127.0.0.1",
            );
            expect(second).toBe(first);
            expect(platformInstances.size).toEqual(1);
        });

        it("a credentials failure fails the action", async () => {
            const handle = beginCredentialScope(
                "session-a",
                "fakeplatform",
                "actor-a",
            );
            const pending = manager.get(
                "fakeplatform",
                "actor-a",
                "session-a",
            );
            handle.reject(new Error("credentials store unavailable"));

            await expect(pending).rejects.toThrow(
                "credentials store unavailable",
            );
            expect(platformInstances.size).toEqual(0);
        });
    });
});
