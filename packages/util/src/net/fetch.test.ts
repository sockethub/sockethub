import { describe, expect, it } from "bun:test";

import { safeFetch } from "./fetch.js";

// The fetch/dispatcher path runs on Node (the Bun runner ignores undici
// dispatchers), so it is validated in integration. Here we cover the
// pre-connect validation gate, which is pure and deterministic.

describe("safeFetch validation gate", () => {
    it("rejects an unsupported scheme before connecting", async () => {
        await expect(safeFetch("ftp://example.com/x")).rejects.toThrow(
            /unsupported scheme/,
        );
    });

    it("rejects a malformed URL before connecting", async () => {
        await expect(safeFetch("not a url")).rejects.toThrow(/invalid URL/);
    });
});
