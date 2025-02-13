import { describe, expect, it } from "bun:test";

import { Config } from "./config.js";

describe("config", () => {
    it("loads default values", () => {
        const config = new Config();
        expect(config).toHaveProperty("get");
        expect(config.get("sockethub:host")).toEqual("localhost");
    });

    it("host overrides from env", () => {
        const hostname = "a host string";
        process.env = { HOST: hostname };
        const config = new Config();
        expect(config).toHaveProperty("get");
        expect(config.get("sockethub:host")).toEqual(hostname);
    });

    it("defaults to redis config", () => {
        process.env = { REDIS_URL: "" };
        const config = new Config();
        expect(config).toHaveProperty("get");
        expect(config.get("redis")).toEqual({ url: "redis://127.0.0.1:6379" });
    });

    // it("redis url overridden by env var", () => {
    //     process.env = { REDIS_URL: "foobar83" };
    //     const config = new Config();
    //     expect(config).toHaveProperty("get");
    //     expect(config.get("redis")).toEqual({ url: "foobar83" });
    // });
});
