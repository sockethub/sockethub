import { describe, expect, it } from "bun:test";
import { buildVCard, parseVCard } from "./vcard.js";

describe("vCard", () => {
    it("parses public contact fields, URL photos, and preserves unknown properties", () => {
        const card = parseVCard(
            "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:alice-1\r\nFN:Alice Example\r\nN:Example;Alice;;;\r\nEMAIL;TYPE=work,pref:alice@example.test\r\nPHOTO;VALUE=URI:https://example.test/alice.jpg\r\nPHOTO;ENCODING=b;TYPE=JPEG:aGVsbG8=\r\nX-AB-LABEL:Friend\r\nEND:VCARD\r\n",
            "https://dav.example/alice.vcf",
            '"v1"',
        );
        expect(card.name).toBe("Alice Example");
        expect(card.emails?.[0]).toEqual({
            value: "alice@example.test",
            types: ["work"],
            preferred: true,
        });
        expect(card.photoUrls).toEqual(["https://example.test/alice.jpg"]);
        expect(card.preservedProperties).toEqual([
            { raw: "PHOTO;ENCODING=b;TYPE=JPEG:aGVsbG8=" },
            { raw: "X-AB-LABEL:Friend" },
        ]);
    });

    it("round-trips unknown properties and hidden inline photos on update", () => {
        const existing = parseVCard(
            "BEGIN:VCARD\r\nVERSION:4.0\r\nUID:alice-1\r\nFN:Alice\r\nN:;Alice;;;\r\nPHOTO;ENCODING=b:aGVsbG8=\r\nX-CUSTOM;X-PARAM=yes:opaque\r\nEND:VCARD\r\n",
            "https://dav.example/alice.vcf",
        );
        const updated = buildVCard(
            { ...existing, name: "Alice Updated", photoUrls: undefined },
            existing.preservedProperties,
        );
        expect(updated.body).toContain("FN:Alice Updated\r\n");
        expect(updated.body).toContain("PHOTO;ENCODING=b:aGVsbG8=\r\n");
        expect(updated.body).toContain("X-CUSTOM;X-PARAM=yes:opaque\r\n");
    });

    it("replaces preserved inline photos when URL photos are explicitly supplied", () => {
        const result = buildVCard(
            {
                type: "person",
                uid: "alice-1",
                name: "Alice",
                photoUrls: ["https://example.test/alice.jpg"],
            },
            [{ raw: "PHOTO;ENCODING=b:aGVsbG8=" }],
        );
        expect(result.body).toContain(
            "PHOTO;VALUE=uri:https://example.test/alice.jpg",
        );
        expect(result.body).not.toContain("aGVsbG8=");
    });

    it("accepts trailing blank lines and preserves astral characters when folding", () => {
        const name = `${"a".repeat(68)}😀 tail`;
        const built = buildVCard({ type: "person", uid: "alice-1", name });
        expect(built.body).toContain("😀");
        expect(built.body).not.toContain("�");
        expect(
            parseVCard(
                `${built.body}\r\n`,
                "https://dav.example/alice.vcf",
            ).name,
        ).toBe(name);
    });

    it("rejects malformed cards", () => {
        expect(() =>
            parseVCard("NOPE", "https://dav.example/a.vcf"),
        ).toThrow("not a vCard");
        expect(() =>
            parseVCard(
                "BEGIN:VCARD\r\nVERSION:4.0\r\n",
                "https://dav.example/a.vcf",
            ),
        ).toThrow("unterminated vCard");
        expect(() =>
            parseVCard(
                "BEGIN:VCARD\r\nVERSION:4.0\r\nEND:VCARD\r\n",
                "https://dav.example/a.vcf",
            ),
        ).toThrow("vCard requires VERSION, UID, and FN");
    });

    it("rejects unsafe UIDs, raw values, parameters, and preserved properties", () => {
        expect(() =>
            buildVCard({ type: "person", uid: "a/b", name: "Alice" }),
        ).toThrow("unsafe vCard UID");
        expect(() =>
            buildVCard({
                type: "person",
                uid: "alice-1",
                name: "Alice",
                urls: [{ value: "https://example.test/\r\nX-INJECT:1" }],
            }),
        ).toThrow("invalid vCard URL");
        expect(() =>
            buildVCard({
                type: "person",
                uid: "alice-1",
                name: "Alice",
                emails: [{ value: "alice@example.test", types: ["work;PREF=1"] }],
            }),
        ).toThrow("invalid vCard type parameter");
        expect(() =>
            buildVCard({ type: "person", uid: "alice-1", name: "Alice" }, [
                { raw: "X-BAD:one\r\nX-INJECT:two" },
            ]),
        ).toThrow("invalid preserved vCard property");
    });

    it("normalizes carriage returns in text values without adding content lines", () => {
        const built = buildVCard({
            type: "person",
            uid: "alice-1",
            name: "Alice\rX-INJECT:1",
            note: "one\r\ntwo",
        });
        expect(built.body).toContain("FN:Alice\\nX-INJECT:1");
        expect(built.body).toContain("NOTE:one\\ntwo");
        expect(built.body).not.toContain("\rX-INJECT:1");
    });
});
