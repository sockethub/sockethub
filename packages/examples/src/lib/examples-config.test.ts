import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;

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

function response(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe("examples config", () => {
    it("derives example IDs from scoped platform package names", async () => {
        const { platformId } = await import("./examples-config");

        expect(platformId("@sockethub/platform-feeds")).toBe("feeds");
        expect(platformId("platform-irc")).toBe("irc");
    });

    it("rejects non-OK responses", async () => {
        globalThis.fetch = vi
            .fn()
            .mockResolvedValue(response({}, 503)) as unknown as typeof fetch;
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
        const { loadExamplesConfig } = await import("./examples-config");

        await expect(loadExamplesConfig()).rejects.toThrow(
            "failed to load runtime config: 503",
        );
        expect(errorLog).toHaveBeenCalledWith(
            "failed to load examples config",
            expect.any(Error),
        );
    });

    it("rejects malformed examples configuration", async () => {
        globalThis.fetch = vi
            .fn()
            .mockResolvedValue(
                response({
                    ...validConfig,
                    platforms: [null],
                }),
            ) as unknown as typeof fetch;
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { loadExamplesConfig } = await import("./examples-config");

        await expect(loadExamplesConfig()).rejects.toThrow(
            "invalid examples config",
        );
    });

    it("propagates rejected requests without caching the failure", async () => {
        const networkError = new Error("network unavailable");
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(networkError)
            .mockResolvedValueOnce(response(validConfig));
        globalThis.fetch = fetchMock as unknown as typeof fetch;
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { loadExamplesConfig } = await import("./examples-config");

        await expect(loadExamplesConfig()).rejects.toBe(networkError);
        await expect(loadExamplesConfig()).resolves.toEqual(validConfig);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
