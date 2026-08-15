import { describe, expect, it } from "bun:test";
import { validateExamplesConfig } from "./examples-config.js";

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

describe("validateExamplesConfig", () => {
    it("accepts a valid examples config", () => {
        expect(validateExamplesConfig(validConfig)).toBeTrue();
    });

    for (const port of [-1, 0, 1.5, 65536]) {
        it(`rejects invalid port ${port}`, () => {
            expect(
                validateExamplesConfig({
                    ...validConfig,
                    sockethub: { ...validConfig.sockethub, port },
                }),
            ).toBeFalse();
        });
    }
});
