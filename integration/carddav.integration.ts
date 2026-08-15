import { beforeAll, describe, expect, it } from "bun:test";
import { CardDavClient } from "../packages/platform-carddav/src/dav.js";
import { buildVCard } from "../packages/platform-carddav/src/vcard.js";

const root = "http://127.0.0.1:5232/alice/";
const bookId = `${root}sockethub-contacts/`;
const authorization = `Basic ${Buffer.from("alice:calendar-test-password").toString("base64")}`;

beforeAll(async () => {
    const response = await fetch(bookId, {
        method: "MKCOL",
        headers: { authorization, "content-type": "application/xml" },
        body: `<?xml version="1.0"?><d:mkcol xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:carddav"><d:set><d:prop><d:resourcetype><d:collection/><c:addressbook/></d:resourcetype><d:displayname>Sockethub Contacts</d:displayname></d:prop></d:set></d:mkcol>`,
    });
    if (![201, 405].includes(response.status))
        throw new Error(
            `failed to prepare Radicale address book: ${response.status}`,
        );
});

describe("CardDAV integration", () => {
    it("discovers, creates, searches, safely updates, and deletes a contact", async () => {
        const client = new CardDavClient(
            root,
            { username: "alice", password: "calendar-test-password" },
            15_000,
            { allowPrivateAddresses: true, allowInsecureHttp: true },
        );
        const uid = `sockethub-${crypto.randomUUID()}`;
        let resourceId: string | undefined;
        let etag: string | undefined;
        try {
            const book = (await client.discoverAddressBooks()).find(
                (item) => item.id === bookId,
            );
            expect(book).toBeDefined();
            if (!book) throw new Error("address book was not discovered");
            const created = await client.create(book, {
                type: "person",
                uid,
                name: "Sockethub Contact",
                givenName: "Sockethub",
                familyName: "Contact",
                emails: [{ value: `${uid}@example.test`, types: ["work"] }],
                photoUrls: ["https://example.test/contact.jpg"],
            });
            resourceId = created.id;
            const seeded = buildVCard(
                {
                    type: "person",
                    uid,
                    name: "Sockethub Contact",
                    givenName: "Sockethub",
                    familyName: "Contact",
                    emails: [{ value: `${uid}@example.test`, types: ["work"] }],
                    photoUrls: ["https://example.test/contact.jpg"],
                },
                [{ raw: "X-SOCKETHUB-TEST:preserved" }],
            );
            const seedResponse = await fetch(resourceId, {
                method: "PUT",
                headers: {
                    authorization,
                    "content-type": "text/vcard; charset=utf-8",
                    "if-match": created.etag ?? "",
                },
                body: seeded.body,
            });
            expect(seedResponse.ok).toBe(true);
            etag = seedResponse.headers.get("etag") ?? created.etag;
            const matches = await client.query(book, {
                text: uid,
                fields: ["email"],
            });
            const stored = matches.find((item) => item.uid === uid);
            expect(stored?.photoUrls).toEqual([
                "https://example.test/contact.jpg",
            ]);
            expect(stored?.preservedProperties).toContainEqual({
                raw: "X-SOCKETHUB-TEST:preserved",
            });
            if (!stored?.etag) throw new Error("created contact has no ETag");
            const updated = await client.update({
                ...stored,
                name: "Updated Contact",
                etag: stored.etag,
            });
            etag = updated.etag;
            const refreshed = (await client.query(book)).find(
                (item) => item.uid === uid,
            );
            expect(refreshed?.name).toBe("Updated Contact");
            expect(refreshed?.preservedProperties).toContainEqual({
                raw: "X-SOCKETHUB-TEST:preserved",
            });
            etag = refreshed?.etag ?? etag;
            if (!etag) throw new Error("updated contact has no ETag");
            await client.delete(resourceId, etag);
            resourceId = undefined;
        } finally {
            if (resourceId && etag)
                await client.delete(resourceId, etag).catch(() => {});
            await client.close();
        }
    });
});
