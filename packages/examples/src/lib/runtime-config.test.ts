import { afterEach, describe, expect, it, vi } from "vitest";

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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("runtime config", () => {
    it("derives example IDs from scoped platform package names", async () => {
        const { platformId } = await import("./runtime-config");

        expect(platformId("@sockethub/platform-feeds")).toBe("feeds");
        expect(platformId("platform-irc")).toBe("irc");
    });

    it("rejects non-OK responses", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({}, 503)));
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
        const { loadRuntimeConfig } = await import("./runtime-config");

        await expect(loadRuntimeConfig()).rejects.toThrow(
            "failed to load runtime config: 503",
        );
        expect(errorLog).toHaveBeenCalledWith(
            "failed to load runtime config",
            expect.any(Error),
        );
    });

    it("propagates rejected requests without caching the failure", async () => {
        const networkError = new Error("network unavailable");
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(networkError)
            .mockResolvedValueOnce(response(validConfig));
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { loadRuntimeConfig } = await import("./runtime-config");

        await expect(loadRuntimeConfig()).rejects.toBe(networkError);
        await expect(loadRuntimeConfig()).resolves.toEqual(validConfig);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("rejects malformed runtime configuration", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                response({
                    ...validConfig,
                    platforms: [null],
                }),
            ),
        );
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { loadRuntimeConfig } = await import("./runtime-config");

        await expect(loadRuntimeConfig()).rejects.toThrow(
            "invalid runtime config",
        );
    });
});
