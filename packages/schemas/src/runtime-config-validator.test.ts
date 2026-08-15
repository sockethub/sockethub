import { describe, expect, it } from "bun:test";
import { validateRuntimeConfig } from "./runtime-config.js";

const validConfig = {
    sockethub: { port: 10550, host: "localhost", path: "/sockethub" },
    public: {
        protocol: "http",
        host: "localhost",
        port: 10550,
        path: "/",
    },
    platforms: ["@sockethub/platform-feeds"],
};

describe("validateRuntimeConfig", () => {
    it("accepts a valid runtime config", () => {
        expect(validateRuntimeConfig(validConfig)).toBeTrue();
    });

    for (const port of [-1, 0, 1.5, 65536]) {
        it(`rejects invalid port ${port}`, () => {
            expect(
                validateRuntimeConfig({
                    ...validConfig,
                    sockethub: { ...validConfig.sockethub, port },
                }),
            ).toBeFalse();
        });
    }
});
