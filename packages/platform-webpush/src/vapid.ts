/**
 * VAPID (RFC 8292): the signed token a push service requires on every
 * request, proving it comes from the server a subscription was created for.
 */
import {
    createPrivateKey,
    createPublicKey,
    type KeyObject,
    sign,
    verify,
} from "node:crypto";

export interface VapidConfig {
    /** Uncompressed P-256 point, base64url (what a browser subscribes with). */
    publicKey: string;
    /** The 32-byte P-256 private scalar, base64url. */
    privateKey: string;
    /** Operator contact sent to push services: a `mailto:` or `https:` URL. */
    subject: string;
}

/** A token is valid for 12 hours; push services allow at most 24. */
const TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000;
/**
 * Replace a token this long before it expires. With the lifetime above, a
 * token is reused for 11 hours: Apple asks for no more than one new token an
 * hour per origin.
 */
const TOKEN_RENEW_MARGIN_MS = 60 * 60 * 1000;
/** Hosts are allowlisted, so this only bounds a misconfigured wildcard. */
const MAX_CACHED_TOKENS = 256;

const base64url = (value: string | Buffer) =>
    Buffer.from(value).toString("base64url");

export class Vapid {
    private readonly key: KeyObject;
    private readonly publicKey: string;
    private readonly subject: string;
    private readonly tokens = new Map<
        string,
        { token: string; expires: number }
    >();

    constructor(config: Partial<VapidConfig> | undefined) {
        const { publicKey, privateKey, subject } = config ?? {};
        if (!publicKey || !privateKey || !subject) {
            throw new Error(
                "webpush: vapid.publicKey, vapid.privateKey and vapid.subject must be set in packageConfig",
            );
        }
        if (!/^(?:mailto:.+@.+|https:\/\/.+)/.test(subject)) {
            throw new Error(
                "webpush: vapid.subject must be a mailto: or https: URL",
            );
        }
        const point = Buffer.from(publicKey, "base64url");
        const scalar = Buffer.from(privateKey, "base64url");
        if (point.length !== 65 || point[0] !== 4 || scalar.length !== 32) {
            throw new Error(
                "webpush: vapid keys must be a base64url P-256 key pair (65-byte public point, 32-byte private scalar)",
            );
        }
        const jwk = {
            kty: "EC",
            crv: "P-256",
            x: base64url(point.subarray(1, 33)),
            y: base64url(point.subarray(33)),
        };
        // A push service only accepts tokens signed by the key a subscription
        // was created with, so a mismatched pair would fail every send.
        // Prove the pair matches by checking a signature against the public
        // half alone.
        let matches = false;
        try {
            this.key = createPrivateKey({
                format: "jwk",
                key: { ...jwk, d: base64url(scalar) },
            });
            const probe = Buffer.from("sockethub");
            matches = verify(
                "sha256",
                probe,
                createPublicKey({ format: "jwk", key: jwk }),
                sign("sha256", probe, this.key),
            );
        } catch {
            // An invalid point or scalar: reported below.
        }
        if (!matches) {
            throw new Error(
                "webpush: vapid.privateKey does not belong to vapid.publicKey",
            );
        }
        this.publicKey = base64url(point);
        this.subject = subject;
    }

    /** The `Authorization` header value for a request to `origin`. */
    authorization(origin: string, now = Date.now()): string {
        let cached = this.tokens.get(origin);
        if (!cached || cached.expires - now < TOKEN_RENEW_MARGIN_MS) {
            const expires = now + TOKEN_LIFETIME_MS;
            const unsigned = `${base64url(
                JSON.stringify({ typ: "JWT", alg: "ES256" }),
            )}.${base64url(
                JSON.stringify({
                    aud: origin,
                    exp: Math.floor(expires / 1000),
                    sub: this.subject,
                }),
            )}`;
            const signature = sign("sha256", Buffer.from(unsigned), {
                key: this.key,
                dsaEncoding: "ieee-p1363",
            });
            cached = { token: `${unsigned}.${base64url(signature)}`, expires };
            if (this.tokens.size >= MAX_CACHED_TOKENS) {
                this.tokens.clear();
            }
            this.tokens.set(origin, cached);
        }
        return `vapid t=${cached.token}, k=${this.publicKey}`;
    }
}
