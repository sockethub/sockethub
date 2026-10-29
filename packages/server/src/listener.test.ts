import { expect, it, spyOn } from "bun:test";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import debug from "debug";
import { io } from "socket.io-client";
import config from "./config.js";
import listener from "./listener.js";

it("disables Socket.IO payload debug logging even under wildcard settings", async () => {
    const namespaces = debug.disable();
    const getConfig = config.get.bind(config);
    const get = spyOn(config, "get").mockImplementation((key: string) =>
        key === "sockethub:port" ? 0 : getConfig(key),
    );
    debug.enable("*");
    try {
        listener.start();
        expect(debug.enabled("socket.io:socket")).toBeFalse();
        expect(debug.enabled("socket.io-parser")).toBeFalse();
        expect(debug.enabled("engine:ws")).toBeFalse();
        expect(debug.enabled("engine:polling")).toBeFalse();
        expect(debug.enabled("engine:socket")).toBeFalse();
        expect(debug.enabled("engine")).toBeFalse();
        expect(debug.enabled("socket.io:server")).toBeTrue();
        expect(debug.enabled("sockethub:server")).toBeTrue();
    } finally {
        await new Promise<void>((resolve) => listener.io.close(() => resolve()));
        get.mockRestore();
        debug.enable(namespaces);
    }
});

it("excludes payload loggers before separate debug copies load at startup", () => {
    const entry = new URL("./index.ts", import.meta.url).href;
    const child = spawnSync(process.execPath, ["-e", `
        await import(${JSON.stringify(entry)});
        const { createRequire } = await import("node:module");
        const { default: assert } = await import("node:assert/strict");
        const require = createRequire(${JSON.stringify(entry)});
        for (const dependency of ["socket.io", "socket.io-parser", "engine.io"]) {
            require(dependency);
            const dependencyRequire = createRequire(require.resolve(dependency));
            const debug = dependencyRequire("debug");
            for (const namespace of ["socket.io:socket", "socket.io-parser", "engine:ws", "engine:polling", "engine:socket", "engine"]) {
                assert.equal(debug.enabled(namespace), false, dependency + ": " + namespace);
            }
            assert.equal(debug.enabled("socket.io:server"), true);
        }
    `], { env: { ...process.env, DEBUG: "*" }, encoding: "utf8", timeout: 10000 });
    expect(child.error).toBeUndefined();
    expect(child.status, child.stderr).toBe(0);
});

it("enforces the origin allow-list on polling and WebSocket handshakes", async () => {
    const getConfig = config.get.bind(config);
    const get = spyOn(config, "get").mockImplementation((key: string) => {
        if (key === "sockethub:port") return 0;
        if (key === "sockethub:host") return "127.0.0.1";
        if (key === "sockethub:cors:origin") return "https://App.Example/";
        return getConfig(key);
    });
    try {
        listener.start();
        if (!listener.http.listening) {
            await new Promise<void>((resolve) => listener.http.once("listening", resolve));
        }
        const { port } = listener.http.address() as AddressInfo;
        for (const transport of ["polling", "websocket"]) {
            for (const origin of ["https://app.example", "https://evil.example", "null", "not a url", "", undefined]) {
                const socket = io(`http://127.0.0.1:${port}`, {
                    path: getConfig("sockethub:path") as string,
                    transports: [transport],
                    extraHeaders: origin === undefined ? {} : { Origin: origin },
                    reconnection: false,
                    timeout: 2000,
                    autoConnect: false,
                });
                try {
                    const connected = await new Promise<boolean>((resolve) => {
                        socket.once("connect", () => resolve(true));
                        socket.once("connect_error", () => resolve(false));
                        socket.connect();
                    });
                    expect(connected, `${transport}: ${String(origin)}`).toBe(
                        origin === undefined || origin === "https://app.example",
                    );
                } finally {
                    socket.disconnect();
                }
            }
        }
    } finally {
        await new Promise<void>((resolve) => listener.io.close(() => resolve()));
        get.mockRestore();
    }
});
