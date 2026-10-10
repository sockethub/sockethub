import { describe, expect, it } from "bun:test";
import {
    asArray,
    DavClient,
    type DavFetch,
    DavFailure,
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
