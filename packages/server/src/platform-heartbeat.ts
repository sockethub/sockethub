/**
 * Parent-side liveness check for a platform child. The child sends a
 * `heartbeat` IPC message on an interval; if none arrives within `timeoutMs`
 * while the child is still connected, `onTimeout` is called with the silence
 * so far. It is called on every tick past the timeout, so the caller decides
 * whether to act once.
 */

import type { ChildProcess } from "node:child_process";
import type { MessageFromPlatform } from "./platform-ipc.js";

export interface HeartbeatOptions {
    intervalMs: number;
    timeoutMs: number;
    onTimeout: (elapsedMs: number) => void;
}

/** Returns a function that stops watching. No-op when disabled by config. */
export function watchHeartbeat(
    child: ChildProcess,
    { intervalMs, timeoutMs, onTimeout }: HeartbeatOptions,
): () => void {
    if (
        !Number.isFinite(intervalMs) ||
        intervalMs <= 0 ||
        !Number.isFinite(timeoutMs) ||
        timeoutMs <= 0 ||
        !child?.on
    ) {
        return () => {};
    }
    let lastSeen = Date.now();
    const listener = (message: MessageFromPlatform) => {
        if (Array.isArray(message) && message[0] === "heartbeat") {
            lastSeen = Date.now();
        }
    };
    child.on("message", listener);
    const timer = setInterval(() => {
        if (!child.connected) {
            return;
        }
        const elapsed = Date.now() - lastSeen;
        if (elapsed > timeoutMs) {
            onTimeout(elapsed);
        }
    }, intervalMs);
    return () => {
        clearInterval(timer);
        child.removeListener("message", listener);
    };
}
