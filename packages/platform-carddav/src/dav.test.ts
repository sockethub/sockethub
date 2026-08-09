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
            preservedProperties: [{ raw: "X-CLIENT:do-not-trust" }],
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
});
