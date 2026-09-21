import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverApi, httpActionsEndpoint } from "./api-discovery";

const originalFetch = globalThis.fetch;

const baseConfig = {
    sockethub: { port: 10550, host: "localhost", path: "/sockethub" },
    public: { protocol: "http", host: "localhost", port: 10550, path: "/" },
};
const enabledConfig = {
    ...baseConfig,
    httpActions: { enabled: true, path: "/sockethub-http" },
};
const descriptor = {
    name: "sockethub",
    apiVersion: 5,
    platforms: [{ id: "metadata", apiVersion: 1 }],
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

describe("api discovery", () => {
    it("builds the endpoint from the public address and configured path", () => {
        expect(
            httpActionsEndpoint({
                ...baseConfig,
                httpActions: { enabled: true, path: "/custom/actions" },
            }),
        ).toBe("http://localhost:10550/custom/actions");
        expect(httpActionsEndpoint(baseConfig)).toBeUndefined();
    });

    it("returns the descriptor from the HTTP actions endpoint", async () => {
        const fetchMock = vi.fn().mockResolvedValue(response(descriptor));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        expect(await discoverApi(enabledConfig)).toEqual({
            state: "available",
            endpoint: "http://localhost:10550/sockethub-http",
            descriptor,
        });
        expect(fetchMock.mock.calls[0][0]).toBe(
            "http://localhost:10550/sockethub-http",
        );
    });

    it("is unavailable without fetching when HTTP actions are disabled", async () => {
        const fetchMock = vi.fn();
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const result = await discoverApi({
            ...baseConfig,
            httpActions: { enabled: false, path: "/sockethub-http" },
        });

        expect(result.state).toBe("unavailable");
        expect(result.endpoint).toBe("http://localhost:10550/sockethub-http");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("is unavailable when the endpoint is not advertised", async () => {
        expect((await discoverApi(baseConfig)).state).toBe("unavailable");
    });

    it("rejects descriptors whose API versions are not non-negative integers", async () => {
        for (const bad of [
            { ...descriptor, apiVersion: -1 },
            { ...descriptor, apiVersion: 1.5 },
            { ...descriptor, platforms: [{ id: "metadata", apiVersion: -1 }] },
            { ...descriptor, platforms: [{ id: "metadata", apiVersion: 0.5 }] },
        ]) {
            globalThis.fetch = vi
                .fn()
                .mockResolvedValue(response(bad)) as unknown as typeof fetch;
            expect((await discoverApi(enabledConfig)).state).toBe(
                "unavailable",
            );
        }
    });

    it("logs a network failure with the endpoint", async () => {
        const error = new Error("network down");
        globalThis.fetch = vi
            .fn()
            .mockRejectedValue(error) as unknown as typeof fetch;
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

        await discoverApi(enabledConfig);

        expect(errorLog).toHaveBeenCalledWith("API discovery failed", {
            endpoint: "http://localhost:10550/sockethub-http",
            error,
        });
    });

    it("is unavailable on an error status, a bad body, or a network failure", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        for (const mock of [
            vi.fn().mockResolvedValue(response({ error: "nope" }, 400)),
            vi.fn().mockResolvedValue(response({ name: "sockethub" })),
            vi.fn().mockRejectedValue(new Error("network down")),
        ]) {
            globalThis.fetch = mock as unknown as typeof fetch;
            const result = await discoverApi(enabledConfig);
            expect(result.state).toBe("unavailable");
            expect(
                result.state === "unavailable" && result.reason,
            ).toContain("Discovery failed");
        }
    });
});
