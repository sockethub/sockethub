import { expect, it, spyOn } from "bun:test";
import debug from "debug";
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
        expect(debug.enabled("socket.io:server")).toBeTrue();
        expect(debug.enabled("sockethub:server")).toBeTrue();
    } finally {
        await new Promise<void>((resolve) => listener.io.close(() => resolve()));
        get.mockRestore();
        debug.enable(namespaces);
    }
});
