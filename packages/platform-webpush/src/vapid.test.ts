import { describe, expect, it } from "bun:test";
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { Vapid } from "./vapid";

/** A fresh P-256 pair in the base64url form the config takes. */
export function generateVapidKeys() {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwk = privateKey.export({ format: "jwk" });
    const point = Buffer.concat([
        Buffer.from([4]),
        Buffer.from(String(jwk.x), "base64url"),
        Buffer.from(String(jwk.y), "base64url"),
    ]);
    return {
        publicKey: point.toString("base64url"),
        privateKey: String(jwk.d),
        jwk: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y },
    };
}

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const subject = "mailto:ops@example.org";

function parse(header: string) {
    const match = /^vapid t=([^,]+), k=(.+)$/.exec(header);
    if (!match) throw new Error(`not a vapid header: ${header}`);
    const [head, claims, signature] = match[1].split(".");
    return {
        token: match[1],
        key: match[2],
        head: JSON.parse(Buffer.from(head, "base64url").toString()),
        claims: JSON.parse(Buffer.from(claims, "base64url").toString()),
        signed: Buffer.from(`${head}.${claims}`),
        signature: Buffer.from(signature, "base64url"),
    };
}

describe("vapid", () => {
    it("signs a token a push service can verify with the public key", () => {
        const keys = generateVapidKeys();
        const vapid = new Vapid({ ...keys, subject });
        const parsed = parse(
            vapid.authorization("https://fcm.googleapis.com", NOW),
        );

        expect(parsed.key).toBe(keys.publicKey);
        expect(parsed.head).toEqual({ typ: "JWT", alg: "ES256" });
        expect(parsed.claims).toEqual({
            aud: "https://fcm.googleapis.com",
            exp: Math.floor((NOW + 12 * HOUR) / 1000),
            sub: subject,
        });
        expect(parsed.signature.length).toBe(64);
        expect(
            verify(
                "sha256",
                parsed.signed,
                {
                    key: createPublicKey({ format: "jwk", key: keys.jwk }),
                    dsaEncoding: "ieee-p1363",
                },
                parsed.signature,
            ),
        ).toBe(true);
    });

    it("reuses a token per origin and renews it before it expires", () => {
        const vapid = new Vapid({ ...generateVapidKeys(), subject });
        const origin = "https://web.push.apple.com";
        const first = vapid.authorization(origin, NOW);

        // Apple asks for at most one new token an hour.
        expect(vapid.authorization(origin, NOW + 10 * HOUR)).toBe(first);
        expect(
            vapid.authorization("https://fcm.googleapis.com", NOW),
        ).not.toBe(first);

        const renewed = parse(vapid.authorization(origin, NOW + 11.5 * HOUR));
        expect(renewed.token).not.toBe(parse(first).token);
        expect(renewed.claims.exp).toBe(
            Math.floor((NOW + 23.5 * HOUR) / 1000),
        );
    });

    it("refuses a missing, malformed or mismatched configuration", () => {
        const keys = generateVapidKeys();
        const other = generateVapidKeys();
        expect(() => new Vapid(undefined)).toThrow(/must be set/);
        expect(() => new Vapid({ ...keys, subject: "" })).toThrow(/must be set/);
        expect(() => new Vapid({ ...keys, subject: "ops@example.org" })).toThrow(
            /mailto: or https:/,
        );
        expect(
            () => new Vapid({ ...keys, publicKey: "AAAA", subject }),
        ).toThrow(/P-256 key pair/);
        // Every send would be refused by the push service.
        expect(
            () =>
                new Vapid({
                    publicKey: keys.publicKey,
                    privateKey: other.privateKey,
                    subject,
                }),
        ).toThrow(/does not belong/);
    });
});
