import { afterEach, describe, expect, it } from "bun:test";
import { CardDavClient } from "./dav.js";

const originalFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("CardDAV client", () => {
    it("re-fetches the current card and preserves authoritative unknown fields", async () => {
        const requests: Array<{ method: string; body?: string }> = [];
        globalThis.fetch = (async (_url: URL | RequestInfo, init?: RequestInit) => {
            const method = init?.method ?? "GET";
            requests.push({ method, body: init?.body?.toString() });
            if (method === "GET")
                return new Response(
                    "BEGIN:VCARD\r\nVERSION:4.0\r\nUID:alice-1\r\nFN:Alice\r\nN:;Alice;;;\r\nPHOTO;ENCODING=b:aGVsbG8=\r\nX-SERVER:keep\r\nEND:VCARD\r\n",
                    { status: 200, headers: { etag: '"v1"' } },
                );
            return new Response(null, {
                status: 204,
                headers: { etag: '"v2"' },
            });
        }) as typeof fetch;
        const client = new CardDavClient("https://dav.example/", {
            token: "access-token",
        });
        const result = await client.update({
            id: "https://dav.example/books/alice/alice.vcf",
            etag: '"v1"',
            uid: "alice-1",
            type: "person",
            name: "Alice Updated",
            ...({
                preservedProperties: [{ raw: "X-CLIENT:do-not-trust" }],
            } as Record<string, unknown>),
        });
        expect(result.etag).toBe('"v2"');
        expect(requests.map((request) => request.method)).toEqual([
            "GET",
            "PUT",
        ]);
        expect(requests[1].body).toContain("X-SERVER:keep");
        expect(requests[1].body).toContain("PHOTO;ENCODING=b:aGVsbG8=");
        expect(requests[1].body).not.toContain("X-CLIENT:do-not-trust");
    });

    it("does not accept client preservation data when the stored card has none", async () => {
        let written = "";
        globalThis.fetch = (async (_url: URL | RequestInfo, init?: RequestInit) => {
            if (init?.method === "GET")
                return new Response(
                    "BEGIN:VCARD\r\nVERSION:4.0\r\nUID:alice-1\r\nFN:Alice\r\nEND:VCARD\r\n",
                );
            written = init?.body?.toString() ?? "";
            return new Response(null, { status: 204 });
        }) as typeof fetch;
        const client = new CardDavClient("https://dav.example/", {
            token: "access-token",
        });
        await client.update({
            id: "https://dav.example/books/alice/alice.vcf",
            etag: '"v1"',
            uid: "alice-1",
            type: "person",
            name: "Alice Updated",
            ...({
                preservedProperties: [{ raw: "X-CLIENT:do-not-trust" }],
            } as Record<string, unknown>),
        });
        expect(written).not.toContain("X-CLIENT:do-not-trust");
    });

    it("sends If-Match and reports an update conflict", async () => {
        let ifMatch: string | null = null;
        globalThis.fetch = (async (_url: URL | RequestInfo, init?: RequestInit) => {
            if (init?.method === "GET")
                return new Response(
                    "BEGIN:VCARD\r\nVERSION:4.0\r\nUID:alice-1\r\nFN:Alice\r\nEND:VCARD\r\n",
                );
            ifMatch = new Headers(init?.headers).get("if-match");
            return new Response(null, { status: 412 });
        }) as typeof fetch;
        const client = new CardDavClient("https://dav.example/", {
            token: "access-token",
        });
        await expect(
            client.update({
                id: "https://dav.example/books/alice/alice.vcf",
                etag: '"v1"',
                uid: "alice-1",
                type: "person",
                name: "Alice Updated",
            }),
        ).rejects.toEqual(expect.objectContaining({ code: "carddav:conflict" }));
        expect(ifMatch).toBe('"v1"');
    });
});
