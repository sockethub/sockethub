import { EventEmitter } from "node:events";
import { describe, expect, it } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { watchHeartbeat } from "./platform-heartbeat.js";

function fakeChild(): ChildProcess & EventEmitter {
    const child = new EventEmitter() as ChildProcess & EventEmitter;
    Object.defineProperty(child, "connected", { value: true, writable: true });
    return child;
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("watchHeartbeat", () => {
    it("calls onTimeout once the child has been silent past the timeout", async () => {
        const child = fakeChild();
        const timeouts: number[] = [];
        const stop = watchHeartbeat(child, {
            intervalMs: 10,
            timeoutMs: 25,
            onTimeout: (elapsed) => timeouts.push(elapsed),
        });
        child.emit("message", ["heartbeat", {}]);
        await tick(20);
        expect(timeouts).toEqual([]);
        await tick(40);
        expect(timeouts.length).toBeGreaterThan(0);
        expect(timeouts[0]).toBeGreaterThan(25);
        stop();
        const seen = timeouts.length;
        await tick(30);
        expect(timeouts.length).toBe(seen);
        expect(child.listenerCount("message")).toBe(0);
    });

    it("stays quiet while heartbeats keep arriving or the child is disconnected", async () => {
        const child = fakeChild();
        let fired = 0;
        const stop = watchHeartbeat(child, {
            intervalMs: 5,
            timeoutMs: 20,
            onTimeout: () => fired++,
        });
        for (let i = 0; i < 6; i++) {
            child.emit("message", ["heartbeat", {}]);
            await tick(8);
        }
        expect(fired).toBe(0);
        (child as { connected: boolean }).connected = false;
        await tick(40);
        expect(fired).toBe(0);
        stop();
    });

    it("is a no-op when disabled by config", () => {
        const child = fakeChild();
        const stop = watchHeartbeat(child, {
            intervalMs: 0,
            timeoutMs: 1000,
            onTimeout: () => {},
        });
        expect(child.listenerCount("message")).toBe(0);
        stop();
    });
});
