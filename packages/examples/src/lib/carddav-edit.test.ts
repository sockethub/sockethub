import { describe, expect, it } from "vitest";
import { reconcileOpenEdit } from "./carddav-edit";

const original = {
    id: "https://contacts.example/bob.vcf",
    etag: '"v1"',
    name: "Bob",
    emails: [{ value: "bob@old.test" }],
};

describe("reconcileOpenEdit", () => {
    it("keeps the open form when the refreshed contact has the same etag", () => {
        const refreshed = {
            ...original,
            emails: [{ value: "bob@old.test" }],
        };
        expect(reconcileOpenEdit(original, [refreshed])).toEqual({
            action: "retain",
            contact: refreshed,
        });
    });

    it("reloads the form when the refreshed contact has a new etag", () => {
        const refreshed = {
            ...original,
            etag: '"v2"',
            emails: [{ value: "bob@new.test" }],
        };
        expect(reconcileOpenEdit(original, [refreshed])).toEqual({
            action: "reload",
            contact: refreshed,
        });
    });

    it("reloads when the refreshed contact no longer has an etag", () => {
        const refreshed = { id: original.id, name: "Bob" };
        expect(reconcileOpenEdit(original, [refreshed])).toEqual({
            action: "reload",
            contact: refreshed,
        });
    });

    it("drops the edit when the contact is not in the refreshed list", () => {
        expect(
            reconcileOpenEdit(original, [
                {
                    id: "https://contacts.example/alice.vcf",
                    etag: '"v1"',
                    name: "Alice",
                    emails: [{ value: "alice@example.test" }],
                },
            ]),
        ).toEqual({ action: "clear" });
    });
});
