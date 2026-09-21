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

    it("accepts the HTTP actions endpoint", () => {
        expect(
            validateExamplesConfig({
                ...validConfig,
                httpActions: { enabled: true, path: "/sockethub-http" },
            }),
        ).toBeTrue();
    });

    it("rejects an HTTP actions entry without a path", () => {
        expect(
            validateExamplesConfig({
                ...validConfig,
                httpActions: { enabled: true },
            }),
        ).toBeFalse();
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
