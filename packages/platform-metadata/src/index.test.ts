import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Agent } from "undici";

// Capture the options passed to open-graph-scraper and control its outcome,
// so we can assert the platform injects a guarded dispatcher and reports
// errors robustly — without any network access.
let ogsOptions: Record<string, unknown> | undefined;
let ogsBehavior: () => Promise<{ result: Record<string, unknown> }> = () =>
    Promise.resolve({ result: {} });

mock.module("open-graph-scraper", () => ({
    default: (options: Record<string, unknown>) => {
        ogsOptions = options;
        return ogsBehavior();
    },
}));

const { default: Metadata } = await import("./index");

function makePlatform(config?: Record<string, unknown>) {
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake session
    const platform = new Metadata({ log: { debug() {} } } as any);
    if (config) {
        Object.assign(platform.config, config);
    }
    return platform;
}

function runFetch(
    platform: ReturnType<typeof makePlatform>,
): Promise<{ err: unknown; result: unknown }> {
    const job = {
        "@context": ["x"],
        type: "fetch",
        actor: { id: "https://example.com", type: "website" },
    };
    return new Promise((resolve) => {
        // biome-ignore lint/suspicious/noExplicitAny: test job
        platform.fetch(job as any, (err, result) => resolve({ err, result }));
    });
}

describe("metadata fetch SSRF hardening", () => {
    beforeEach(() => {
        // Reset shared mock state so a stale value from one test cannot make a
        // later assertion pass without exercising the current path.
        ogsOptions = undefined;
        ogsBehavior = () => Promise.resolve({ result: {} });
    });

    it("passes a guarded undici dispatcher to open-graph-scraper", async () => {
        ogsBehavior = () => Promise.resolve({ result: {} });
        await runFetch(makePlatform());
        const fetchOptions = ogsOptions?.fetchOptions as
            | { dispatcher?: unknown }
            | undefined;
        expect(fetchOptions?.dispatcher).toBeInstanceOf(Agent);
    });

    it("still passes a dispatcher when the escape hatch is enabled", async () => {
        ogsBehavior = () => Promise.resolve({ result: {} });
        await runFetch(makePlatform({ allowPrivateAddresses: true }));
        const fetchOptions = ogsOptions?.fetchOptions as
            | { dispatcher?: unknown }
            | undefined;
        expect(fetchOptions?.dispatcher).toBeInstanceOf(Agent);
    });

    it("reports the error from open-graph-scraper's { result } rejection", async () => {
        ogsBehavior = () =>
            Promise.reject({ result: { error: new Error("ogs failed") } });
        const { err, result } = await runFetch(makePlatform());
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toEqual("ogs failed");
        expect(result).toBeUndefined();
    });

    it("reports a plain Error rejection without throwing a TypeError", async () => {
        ogsBehavior = () => Promise.reject(new Error("blocked non-public"));
        const { err } = await runFetch(makePlatform());
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/blocked non-public/);
    });
});
