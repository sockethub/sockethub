import { describe, expect, it, spyOn } from "bun:test";
import type { PlatformSession } from "@sockethub/schemas";
import { CardDavClient, CardDavFailure } from "./dav.js";
import CardDav from "./index.js";

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
