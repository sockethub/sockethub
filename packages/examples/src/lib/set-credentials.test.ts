import { EventEmitter } from "node:events";
import type SockethubClient from "@sockethub/client";
import type { CredentialsObject } from "@sockethub/schemas";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setCredentials } from "./set-credentials";

const credentials: CredentialsObject = {
    "@context": ["https://sockethub.org/ns/context/platform/messenger/v1.jsonld"],
    type: "credentials",
    actor: { id: "123", type: "person" },
    object: { type: "credentials", token: "test-token", apiVersion: "v22.0" },
};

function fixture() {
    const events = new EventEmitter();
    const socket = Object.assign(events, { connected: true });
    return { events, socket: socket as unknown as SockethubClient["socket"] };
}

afterEach(() => vi.restoreAllMocks());

describe("credential acknowledgement", () => {
    it("settles success and server errors and removes the listener", async () => {
        for (const error of [undefined, "Rejected credentials"]) {
            const { events, socket } = fixture();
            events.on("credentials", (_credentials, ack) => ack({ error }));
            const result = setCredentials(socket, credentials);
            if (error) await expect(result).rejects.toThrow(error);
            else await expect(result).resolves.toBeUndefined();
            expect(events.listenerCount("disconnect")).toBe(0);
        }
    });

    it("rejects on disconnect and ignores a late acknowledgement", async () => {
        const { events, socket } = fixture();
        let acknowledge: () => void = () => {};
        events.on("credentials", (_credentials, ack) => { acknowledge = ack; });
        const result = setCredentials(socket, credentials);
        events.emit("disconnect");
        await expect(result).rejects.toThrow("Disconnected before credentials");
        acknowledge();
        expect(events.listenerCount("disconnect")).toBe(0);
    });

    it("times out and clears the timer and listener", async () => {
        let deadline = () => {};
        vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
            deadline = callback;
            return 123;
        }) as unknown as typeof setTimeout);
        const clear = vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => {});
        const { events, socket } = fixture();
        const result = setCredentials(socket, credentials);
        deadline();
        await expect(result).rejects.toThrow("acknowledgement timed out");
        expect(events.listenerCount("disconnect")).toBe(0);
        expect(clear).toHaveBeenCalledWith(123);
    });

    it("clears the deadline after a successful acknowledgement", async () => {
        const clear = vi.spyOn(globalThis, "clearTimeout");
        const { events, socket } = fixture();
        events.on("credentials", (_credentials, ack) => ack());
        await setCredentials(socket, credentials);
        expect(clear).toHaveBeenCalledTimes(1);
    });

    it("handles a synchronous emit failure", async () => {
        const { events, socket } = fixture();
        events.on("credentials", () => { throw new Error("Emit failed"); });
        await expect(setCredentials(socket, credentials)).rejects.toThrow("Emit failed");
        expect(events.listenerCount("disconnect")).toBe(0);
    });

    it("does not submit credentials while disconnected", async () => {
        const { socket } = fixture();
        socket.connected = false;
        await expect(setCredentials(socket, credentials)).rejects.toThrow("Sockethub is disconnected");
    });
});
