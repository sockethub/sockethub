import { describe, expect, it } from "bun:test";
import {
    asArray,
    DavClient,
    type DavFetch,
    DavFailure,
    DiscoveryCache,
    isDavCollectionChild,
    parseDavXml,
} from "./index.js";

describe("shared DAV helpers", () => {

    it("requires HTTPS unless the administrator opts in", () => {
        expect(
            () =>
                new DavClient(
                    "http://dav.example/",
                    { token: "token" },
                    "davtest",
                ),
        ).toThrow(new DavFailure("davtest:https-required"));
    });

    it("parses multistatus XML without expanding custom entities", () => {
        const parsed = parseDavXml(
            '<?xml version="1.0"?><!DOCTYPE d:multistatus [<!ENTITY secret "expanded">]><d:multistatus xmlns:d="DAV:"><d:response><d:href>&secret;</d:href></d:response></d:multistatus>',
        );
        const responses = asArray(
            (parsed.multistatus as Record<string, unknown>).response,
        ) as Array<Record<string, unknown>>;
        expect(responses).toHaveLength(1);
        expect(responses[0].href).not.toBe("expanded");
    });

    it("rejects encoded traversal outside DAV collections", () => {
        expect(
            isDavCollectionChild(
                "https://dav.example/addressbooks/alice/",
                "https://dav.example/addressbooks/alice/contact.vcf",
            ),
        ).toBe(true);
        expect(
            isDavCollectionChild(
                "https://dav.example/addressbooks/alice/",
                "https://dav.example/addressbooks/alice/%252e%252e/private.vcf",
            ),
        ).toBe(false);
    });

    it("maps malformed service URLs to the DAV failure contract", () => {
        expect(
            () => new DavClient("not a URL", { token: "token" }, "davtest"),
        ).toThrow(new DavFailure("davtest:invalid-url"));
    });

    it("rejects cross-origin and unsafe write redirects", async () => {
        const fetch: DavFetch = async () =>
            new Response(null, {
                status: 302,
                headers: { location: "https://other.example/dav/" },
            });
        const client = new DavClient(
            "https://dav.example/",
            { token: "token" },
            "davtest",
            15_000,
            { fetch },
        );
        await expect(
            client.request(new URL("https://dav.example/"), { method: "GET" }),
        ).rejects.toEqual(new DavFailure("davtest:unsafe-redirect"));
        await expect(
            client.request(new URL("https://dav.example/"), { method: "PUT" }),
        ).rejects.toEqual(new DavFailure("davtest:unsafe-redirect"));
        await client.close();
    });

    it("limits redirect chains across the whole request", async () => {
        const signals = new Set<AbortSignal | null | undefined>();
        const fetch: DavFetch = async (_url, init) => {
            signals.add(init.signal);
            return new Response(null, {
                status: 302,
                headers: { location: "/next" },
            });
        };
        const client = new DavClient(
            "https://dav.example/",
            { token: "token" },
            "davtest",
            15_000,
            { fetch },
        );
        await expect(
            client.request(new URL("https://dav.example/"), { method: "GET" }),
        ).rejects.toEqual(new DavFailure("davtest:too-many-redirects"));
        expect(signals.size).toBe(1);
        await client.close();
    });

    it("rejects unsupported Digest modes", async () => {
        for (const unsupported of ["userhash=true", 'qop="auth-int"']) {
            const fetch: DavFetch = async () =>
                new Response(null, {
                    status: 401,
                    headers: {
                        "www-authenticate": `Digest realm="dav", nonce="nonce", ${unsupported}`,
                    },
                });
            const client = new DavClient(
                "https://dav.example/",
                { username: "alice", password: "secret" },
                "davtest",
                15_000,
                { fetch },
            );
            await expect(
                client.request(new URL("https://dav.example/"), {
                    method: "GET",
                }),
            ).rejects.toEqual(
                new DavFailure("davtest:unsupported-authentication"),
            );
            await client.close();
        }
    });

    it("maps Bearer token rejection to authentication-failed", async () => {
        const fetch: DavFetch = async () => new Response(null, { status: 401 });
        const client = new DavClient(
            "https://dav.example/",
            { token: "token" },
            "davtest",
            15_000,
            { fetch },
        );
        await expect(
            client.request(new URL("https://dav.example/"), { method: "GET" }),
        ).rejects.toEqual(new DavFailure("davtest:authentication-failed"));
        await client.close();
    });
});

describe("DiscoveryCache", () => {
    const counter = () => {
        let calls = 0;
        return {
            discover: async () => [++calls],
            get calls() {
                return calls;
            },
        };
    };

    it("discovers once within the TTL and again after expiry", async () => {
        const cache = new DiscoveryCache<number[]>();
        const source = counter();
        const key = cache.key("caldav", { url: "https://a/", token: "t" });
        expect(await cache.get(key, 60_000, source.discover)).toEqual([1]);
        expect(await cache.get(key, 60_000, source.discover)).toEqual([1]);
        expect(source.calls).toBe(1);
        const short = cache.key("carddav", {});
        expect(await cache.get(short, 1, source.discover)).toEqual([2]);
        await Bun.sleep(5);
        expect(await cache.get(short, 1, source.discover)).toEqual([3]);
    });

    it("does not cache when the TTL is 0", async () => {
        const cache = new DiscoveryCache<number[]>();
        const source = counter();
        await cache.get("k", 0, source.discover);
        await cache.get("k", 0, source.discover);
        expect(source.calls).toBe(2);
    });

    it("isolates protocols, endpoints and credentials, without plaintext keys", () => {
        const cache = new DiscoveryCache<number[]>();
        const credentials = { url: "https://a/", password: "hunter2" };
        const keys = new Set([
            cache.key("caldav", credentials),
            cache.key("carddav", credentials),
            cache.key("caldav", { ...credentials, url: "https://b/" }),
            cache.key("caldav", { ...credentials, password: "other" }),
        ]);
        expect(keys.size).toBe(4);
        for (const key of keys) expect(key).toMatch(/^[0-9a-f]{64}$/);
        // Per-process secret: another cache never derives the same key.
        expect(new DiscoveryCache().key("caldav", credentials)).not.toBe(
            cache.key("caldav", credentials),
        );
    });

    it("shares one discovery between concurrent misses", async () => {
        const cache = new DiscoveryCache<number[]>();
        const source = counter();
        await Promise.all([
            cache.get("k", 60_000, source.discover),
            cache.get("k", 60_000, source.discover),
        ]);
        expect(source.calls).toBe(1);
    });

    it("does not cache failures and supports invalidation", async () => {
        const cache = new DiscoveryCache<number[]>();
        const source = counter();
        await expect(
            cache.get("k", 60_000, () => Promise.reject(new Error("x"))),
        ).rejects.toThrow("x");
        expect(await cache.get("k", 60_000, source.discover)).toEqual([1]);
        cache.delete("k");
        expect(await cache.get("k", 60_000, source.discover)).toEqual([2]);
    });

    it("bounds the number of entries", async () => {
        const cache = new DiscoveryCache<number[]>(2);
        const source = counter();
        for (const key of ["a", "b", "c"])
            await cache.get(key, 60_000, source.discover);
        await cache.get("a", 60_000, source.discover);
        expect(source.calls).toBe(4);
    });
});
