import { describe, expect, test } from "bun:test";
import Ajv from "ajv";

import { PlatformSchema } from "./schema.js";

const ajv = new Ajv({ strictTypes: false });
const validate = ajv.compile(PlatformSchema.credentials);

const base = {
    actor: { id: "user@jabber.net", type: "person" },
    object: {
        type: "credentials",
        userAddress: "user@jabber.net",
        resource: "home",
    },
};

function withObject(extra: Record<string, unknown>) {
    return { ...base, object: { ...base.object, ...extra } };
}

describe("PlatformSchema.credentials", () => {
    test("accepts password-only credentials", () => {
        expect(validate(withObject({ password: "hunter2" }))).toBe(true);
    });

    test("rejects credentials without a password", () => {
        expect(validate(base)).toBe(false);
    });
});
