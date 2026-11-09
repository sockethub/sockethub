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

    it("removes expired entries without another lookup", async () => {
        const cache = new DiscoveryCache<number[]>();
        await cache.get("k", 5, counter().discover);
        expect(cache.size).toBe(1);
        await Bun.sleep(30);
        expect(cache.size).toBe(0);
    });

    it("shares a pending discovery that outlives the TTL", async () => {
        const cache = new DiscoveryCache<number[]>();
        let calls = 0;
        let finish: (value: number[]) => void = () => {};
        const discover = () => {
            calls += 1;
            return new Promise<number[]>((resolve) => {
                finish = resolve;
            });
        };
        const first = cache.get("k", 1, discover);
        await Bun.sleep(10);
        const second = cache.get("k", 1, discover);
        finish([1]);
        expect(await Promise.all([first, second])).toEqual([[1], [1]]);
        expect(calls).toBe(1);
    });

    it("starts the TTL when discovery succeeds", async () => {
        const cache = new DiscoveryCache<number[]>();
        const source = counter();
        await cache.get("k", 40, async () => {
            await Bun.sleep(30);
            return source.discover();
        });
        expect(await cache.get("k", 40, source.discover)).toEqual([1]);
    });

    it("does not store a discovery invalidated while pending", async () => {
        const cache = new DiscoveryCache<number[]>();
        const source = counter();
        const pending = cache.get("k", 60_000, async () => {
            await Bun.sleep(5);
            return source.discover();
        });
        cache.delete("k");
        await pending;
        expect(cache.size).toBe(0);
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

describe("DavClient.syncCollection", () => {
    const collection = new URL("https://dav.example/cal/work/");
    const multistatus = (inner: string, token = "https://dav.example/sync/2") =>
        `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${inner}<d:sync-token>${token}</d:sync-token></d:multistatus>`;

    function client(respond: (body: string) => Response) {
        const bodies: string[] = [];
        const fetch: DavFetch = async (_url, init) => {
            bodies.push(String(init.body));
            return respond(String(init.body));
        };
        return {
            bodies,
            client: new DavClient(
                "https://dav.example/",
                { token: "token" },
                "davtest",
                15_000,
                { fetch },
            ),
        };
    }

    it("returns changed and removed members with the new token", async () => {
        const { client: dav, bodies } = client(
            () =>
                new Response(
                    multistatus(`
<d:response><d:href>/cal/work/</d:href><d:status>HTTP/1.1 507 Insufficient Storage</d:status></d:response>
<d:response><d:href>/cal/work/a.ics</d:href><d:propstat><d:prop><d:getetag>"1"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
<d:response><d:href>/cal/work/b.ics</d:href><d:status>HTTP/1.1 404 Not Found</d:status></d:response>`),
                    { status: 207 },
                ),
        );
        const result = await dav.syncCollection(
            collection,
            "<d:getetag/>",
            "https://dav.example/sync/1?a&b",
        );
        expect(bodies[0]).toContain(
            "<d:sync-token>https://dav.example/sync/1?a&amp;b</d:sync-token>",
        );
        expect(bodies[0]).toContain("<d:sync-level>1</d:sync-level>");
        expect(result).toEqual({
            changed: [
                {
                    id: "https://dav.example/cal/work/a.ics",
                    props: { getetag: '"1"' },
                },
            ],
            removed: ["https://dav.example/cal/work/b.ics"],
            syncToken: "https://dav.example/sync/2",
            truncated: true,
        });
        await dav.close();
    });

    it("sends an empty token for the initial sync and keeps tokens verbatim", async () => {
        const { client: dav, bodies } = client(
            () => new Response(multistatus("", "0012"), { status: 207 }),
        );
        const result = await dav.syncCollection(collection, "<d:getetag/>");
        expect(bodies[0]).toContain("<d:sync-token/>");
        expect(result.syncToken).toBe("0012");
        expect(result.truncated).toBe(false);
        await dav.close();
    });

    it("rejects members outside the collection and responses without a token", async () => {
        const outside = client(
            () =>
                new Response(
                    multistatus(
                        "<d:response><d:href>/cal/other/a.ics</d:href><d:status>HTTP/1.1 404 Not Found</d:status></d:response>",
                    ),
                    { status: 207 },
                ),
        ).client;
        await expect(
            outside.syncCollection(collection, "<d:getetag/>"),
        ).rejects.toEqual(new DavFailure("davtest:invalid-response"));
        const tokenless = client(
            () =>
                new Response('<d:multistatus xmlns:d="DAV:"/>', {
                    status: 207,
                }),
        ).client;
        await expect(
            tokenless.syncCollection(collection, "<d:getetag/>"),
        ).rejects.toEqual(new DavFailure("davtest:invalid-response"));
    });

    it("distinguishes invalid tokens, unsupported reports, and other failures", async () => {
        const error = (element: string) =>
            `<?xml version="1.0"?><d:error xmlns:d="DAV:"><d:${element}/></d:error>`;
        const cases: Array<[number, string, string | undefined, string]> = [
            [403, error("valid-sync-token"), "t", "sync-token-invalid"],
            [403, error("valid-sync-token"), undefined, "sync-token-invalid"],
            [403, error("supported-report"), undefined, "sync-unsupported"],
            [409, "", "t", "sync-token-invalid"],
            [403, "", undefined, "authentication-failed"],
            [501, "", undefined, "sync-unsupported"],
            [400, "", undefined, "sync-unsupported"],
            [404, "", "t", "not-found"],
            [500, "", "t", "sync-failed"],
        ];
        for (const [status, body, token, code] of cases) {
            const dav = client(
                () => new Response(body || null, { status }),
            ).client;
            await expect(
                dav.syncCollection(collection, "<d:getetag/>", token),
            ).rejects.toEqual(new DavFailure(`davtest:${code}`));
        }
    });

    it("still treats a plain 403 as an authentication failure", async () => {
        const dav = client(
            () => new Response(null, { status: 403 }),
        ).client;
        await expect(
            dav.request(collection, { method: "PROPFIND" }),
        ).rejects.toEqual(new DavFailure("davtest:authentication-failed"));
    });
});

describe("DavClient.syncResources", () => {
    const collection = new URL("https://dav.example/cal/work/");
    const options = {
        namespaces: 'xmlns:c="urn:ietf:params:xml:ns:caldav"',
        data: "c:calendar-data",
        multiget: "c:calendar-multiget",
    };
    const member = (name: string, props: string) =>
        `<d:response><d:href>/cal/work/${name}</d:href><d:propstat><d:prop>${props}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
    const multistatus = (inner: string, token = true) =>
        `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${inner}${token ? "<d:sync-token>t2</d:sync-token>" : ""}</d:multistatus>`;

    function client(responses: string[]) {
        const bodies: string[] = [];
        const fetch: DavFetch = async (_url, init) => {
            bodies.push(String(init.body));
            return new Response(responses[bodies.length - 1], { status: 207 });
        };
        return {
            bodies,
            dav: new DavClient(
                "https://dav.example/",
                { token: "token" },
                "davtest",
                15_000,
                { fetch },
            ),
        };
    }

    it("returns inline data without a second request", async () => {
        const { dav, bodies } = client([
            multistatus(
                member("a.ics", '<d:getetag>"1"</d:getetag><c:calendar-data>A</c:calendar-data>'),
            ),
        ]);
        expect(await dav.syncResources(collection, options, "t1")).toEqual({
            resources: [
                { id: "https://dav.example/cal/work/a.ics", etag: '"1"', data: "A" },
            ],
            removed: [],
            syncToken: "t2",
            truncated: false,
        });
        expect(bodies).toHaveLength(1);
        expect(bodies[0]).toContain("<c:calendar-data/>");
    });

    it("fetches members listed without data through one multiget", async () => {
        const { dav, bodies } = client([
            multistatus(
                member("a.ics", '<d:getetag>"1"</d:getetag>') +
                    member("b c.ics", '<d:getetag>"2"</d:getetag>'),
            ),
            multistatus(
                member("a.ics", '<d:getetag>"1"</d:getetag><c:calendar-data>A</c:calendar-data>') +
                    '<d:response><d:href>/cal/work/b%20c.ics</d:href><d:status>HTTP/1.1 404 Not Found</d:status></d:response>',
                false,
            ),
        ]);
        const result = await dav.syncResources(collection, options);
        expect(bodies[1]).toContain("<c:calendar-multiget");
        expect(bodies[1]).toContain("<d:href>/cal/work/a.ics</d:href>");
        expect(bodies[1]).toContain("<d:href>/cal/work/b%20c.ics</d:href>");
        expect(result.resources).toEqual([
            { id: "https://dav.example/cal/work/a.ics", etag: '"1"', data: "A" },
        ]);
        // Deleted between the two requests.
        expect(result.removed).toEqual(["https://dav.example/cal/work/b%20c.ics"]);
    });

    it("reads data from an element that carries attributes", async () => {
        const { dav } = client([
            multistatus(
                member(
                    "a.ics",
                    '<c:calendar-data content-type="text/calendar">A</c:calendar-data>',
                ),
            ),
        ]);
        const result = await dav.syncResources(collection, options);
        expect(result.resources).toEqual([
            { id: "https://dav.example/cal/work/a.ics", data: "A" },
        ]);
    });

    it("fails rather than advance the token past a member it could not read", async () => {
        const { dav } = client([
            multistatus(member("a.ics", '<d:getetag>"1"</d:getetag>')),
            multistatus("", false),
        ]);
        await expect(dav.syncResources(collection, options)).rejects.toEqual(
            new DavFailure("davtest:invalid-response"),
        );
    });
});
