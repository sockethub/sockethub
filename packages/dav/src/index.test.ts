import { describe, expect, it } from "bun:test";
import {
    asArray,
    DavClient,
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
            '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/book/</d:href></d:response></d:multistatus>',
        );
        expect(asArray((parsed.multistatus as Record<string, unknown>).response)).toHaveLength(1);
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
});
