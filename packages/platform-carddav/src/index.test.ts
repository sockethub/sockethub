import { describe, expect, it, spyOn } from "bun:test";
import type { PlatformSession } from "@sockethub/schemas";
import Ajv from "ajv";
import { CardDavClient, CardDavFailure } from "./dav.js";
import CardDav from "./index.js";
import { PlatformCardDavSchema } from "./schema.js";

describe("CardDAV discovery cache", () => {
    const session = {
        log: { error() {}, warn() {}, info() {}, debug() {} },
    } as unknown as PlatformSession;
    const book = "https://contacts.example/dav/alice/contacts/";
    const credentials = {
        object: { url: "https://contacts.example/", token: "secret" },
    } as never;

    function query(platform: CardDav) {
        return new Promise<unknown>((resolve) =>
            platform.query(
                {
                    type: "query",
                    actor: { id: "carddav:alice", type: "person" },
                    target: { id: book, type: "address-book" },
                } as never,
                credentials,
                (error) => resolve(error),
            ),
        );
    }

    it("reuses discovery and rediscovers after a not-found failure", async () => {
        const discover = spyOn(
            CardDavClient.prototype,
            "discoverAddressBooks",
        ).mockResolvedValue([
            { id: book, type: "address-book", name: "Contacts" },
        ] as never);
        const run = spyOn(CardDavClient.prototype, "query").mockResolvedValue(
            [],
        );
        try {
            const platform = new CardDav(session);
            expect(await query(platform)).toBeNull();
            expect(await query(platform)).toBeNull();
            expect(discover).toHaveBeenCalledTimes(1);
            run.mockRejectedValueOnce(new CardDavFailure("carddav:not-found"));
            expect(await query(platform)).toBe("carddav:not-found");
            expect(await query(platform)).toBeNull();
            expect(discover).toHaveBeenCalledTimes(2);
        } finally {
            discover.mockRestore();
            run.mockRestore();
        }
    });
});

describe("CardDAV sync action", () => {
    const session = {
        log: { error() {}, warn() {}, info() {}, debug() {} },
    } as unknown as PlatformSession;
    const book = "https://contacts.example/dav/alice/contacts/";
    const credentials = {
        object: { url: "https://contacts.example/", token: "secret" },
    } as never;

    it("returns changes in a collection that matches the response schema", async () => {
        const discover = spyOn(
            CardDavClient.prototype,
            "discoverAddressBooks",
        ).mockResolvedValue([
            { id: book, type: "addressBook", name: "Contacts" },
        ]);
        const sync = spyOn(CardDavClient.prototype, "sync").mockResolvedValue({
            items: [
                {
                    id: `${book}a.vcf`,
                    type: "person",
                    uid: "a",
                    name: "Alice",
                    etag: '"1"',
                    vcardVersion: "4.0",
                    updateSupported: true,
                },
            ],
            removed: [`${book}b.vcf`],
            syncToken: "t2",
            truncated: true,
        });
        try {
            const [error, result] = await new Promise<[unknown, unknown]>(
                (resolve) =>
                    new CardDav(session).sync(
                        {
                            type: "sync",
                            actor: { id: "carddav:alice", type: "person" },
                            target: { id: book, type: "addressBook" },
                        } as never,
                        credentials,
                        (err, res) => resolve([err, res]),
                    ),
            );
            expect(error).toBeNull();
            expect(sync.mock.calls[0]?.[1]).toBeUndefined();
            expect(result).toMatchObject({
                type: "collection",
                totalItems: 1,
                removed: [`${book}b.vcf`],
                syncToken: "t2",
                truncated: true,
            });
            const validate = new Ajv({ strict: false }).compile(
                PlatformCardDavSchema.responses,
            );
            expect(validate(result)).toBeTrue();
        } finally {
            discover.mockRestore();
            sync.mockRestore();
        }
    });

    it("returns only the current token for tokenOnly", async () => {
        const discover = spyOn(
            CardDavClient.prototype,
            "discoverAddressBooks",
        ).mockResolvedValue([
            { id: book, type: "addressBook", name: "Contacts" },
        ]);
        const sync = spyOn(CardDavClient.prototype, "sync");
        const current = spyOn(
            CardDavClient.prototype,
            "currentSyncToken",
        ).mockResolvedValue("t9");
        try {
            const [error, result] = await new Promise<[unknown, unknown]>(
                (resolve) =>
                    new CardDav(session).sync(
                        {
                            type: "sync",
                            actor: { id: "carddav:alice", type: "person" },
                            target: { id: book, type: "addressBook" },
                            object: { tokenOnly: true },
                        } as never,
                        credentials,
                        (err, res) => resolve([err, res]),
                    ),
            );
            expect(error).toBeNull();
            expect(sync).not.toHaveBeenCalled();
            expect(String(current.mock.calls[0]?.[0])).toBe(book);
            expect(result).toMatchObject({
                type: "collection",
                totalItems: 0,
                items: [],
                removed: [],
                syncToken: "t9",
                truncated: false,
            });
            const validate = new Ajv({ strict: false }).compile(
                PlatformCardDavSchema.responses,
            );
            expect(validate(result)).toBeTrue();
        } finally {
            discover.mockRestore();
            sync.mockRestore();
            current.mockRestore();
        }
    });
});
