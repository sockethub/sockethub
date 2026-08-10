import { createHash, randomBytes } from "node:crypto";
import { createGuardedDispatcher } from "@sockethub/util/net";
import { XMLParser } from "fast-xml-parser";
import type { Agent } from "undici";

const MAX_REDIRECTS = 5;
const MAX_AUTH_ATTEMPTS = 2;

export type DavAuthentication =
    | { username: string; password: string }
    | { token: string };
export interface DavNetworkOptions {
    allowPrivateAddresses?: boolean;
    allowInsecureHttp?: boolean;
    maxResponseBytes?: number;
}

export class DavFailure extends Error {
    constructor(
        readonly code: string,
        cause?: unknown,
    ) {
        super(code, { cause });
    }
}

export async function rejectDavResponse(
    response: Response,
    code: string,
): Promise<never> {
    await response.body?.cancel().catch(() => {});
    throw new DavFailure(code);
}

export function asArray<T>(value: T | T[] | undefined): T[] {
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function xmlText(value: string): string {
    const predefined: Record<string, string> = {
        amp: "&",
        apos: "'",
        gt: ">",
        lt: "<",
        quot: '"',
    };
    return value.replace(
        /&(amp|apos|gt|lt|quot|#\d+|#x[\da-f]+);/gi,
        (reference, entity: string) => {
            if (entity.startsWith("#")) {
                const hexadecimal = entity[1]?.toLowerCase() === "x";
                const codePoint = Number.parseInt(
                    entity.slice(hexadecimal ? 2 : 1),
                    hexadecimal ? 16 : 10,
                );
                const valid =
                    Number.isSafeInteger(codePoint) &&
                    (codePoint === 0x9 ||
                        codePoint === 0xa ||
                        codePoint === 0xd ||
                        (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
                        (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
                        (codePoint >= 0x10000 && codePoint <= 0x10ffff));
                return valid ? String.fromCodePoint(codePoint) : reference;
            }
            return predefined[entity.toLowerCase()] ?? reference;
        },
    );
}

export function parseDavXml(xml: string): Record<string, unknown> {
    return new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true,
        processEntities: false,
        tagValueProcessor: (_tagName, value) => xmlText(value),
        attributeValueProcessor: (_attributeName, value) => xmlText(value),
    }).parse(xml);
}

export function successfulProps(
    response: Record<string, unknown>,
): Record<string, unknown> {
    for (const item of asArray(
        response.propstat as
            | Record<string, unknown>
            | Record<string, unknown>[],
    )) {
        if (/\s200(?:\s|$)/.test(String(item.status ?? "")))
            return (item.prop as Record<string, unknown>) ?? {};
    }
    return {};
}

export function davHref(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
        const text = (value as Record<string, unknown>)["#text"];
        if (typeof text === "string") return text;
    }
    return undefined;
}

export function propertyHref(value: unknown): string | undefined {
    if (value && typeof value === "object")
        return davHref((value as Record<string, unknown>).href);
    return davHref(value);
}

function safePathname(pathname: string): boolean {
    if (pathname.includes("\\") || /%(?:2f|5c)/i.test(pathname)) return false;
    for (const segment of pathname.split("/")) {
        let decoded = segment;
        try {
            for (let pass = 0; pass < 3; pass += 1) {
                const next = decodeURIComponent(decoded);
                if (next === decoded) break;
                decoded = next;
            }
        } catch {
            return false;
        }
        if (decoded === "." || decoded === ".." || /[\\/]/.test(decoded))
            return false;
    }
    return true;
}

export function isDavCollectionChild(
    collectionId: string,
    resourceId: string,
): boolean {
    try {
        const collection = new URL(collectionId);
        const resource = new URL(resourceId);
        if (
            collection.search ||
            collection.hash ||
            resource.search ||
            resource.hash ||
            !safePathname(collection.pathname) ||
            !safePathname(resource.pathname)
        )
            return false;
        const prefix = collection.pathname.endsWith("/")
            ? collection.pathname
            : `${collection.pathname}/`;
        return (
            resource.origin === collection.origin &&
            resource.pathname.startsWith(prefix) &&
            resource.pathname !== prefix
        );
    } catch {
        return false;
    }
}

type DigestAlgorithm = "MD5" | "MD5-sess" | "SHA-256" | "SHA-256-sess";
type DigestChallenge = {
    realm: string;
    nonce: string;
    algorithm: DigestAlgorithm;
    qop?: "auth";
    opaque?: string;
};

function unquote(value: string): string {
    return value.startsWith('"')
        ? value.slice(1, -1).replace(/\\(.)/g, "$1")
        : value;
}

function parseDigest(parameters: string): DigestChallenge | undefined {
    const values = new Map<string, string>();
    for (const item of parameters.matchAll(
        /(?:^|,\s*)([!#$%&'*+.^_`|~\w-]+)\s*=\s*("(?:\\.|[^"\\])*"|[^,\s]+)/g,
    ))
        values.set(item[1].toLowerCase(), unquote(item[2]));
    const realm = values.get("realm");
    const nonce = values.get("nonce");
    if (!realm || !nonce) return undefined;
    const raw = (values.get("algorithm") ?? "MD5").toUpperCase();
    const algorithm = raw.endsWith("-SESS") ? `${raw.slice(0, -5)}-sess` : raw;
    if (!["MD5", "MD5-sess", "SHA-256", "SHA-256-sess"].includes(algorithm))
        return undefined;
    if (values.get("userhash")?.toLowerCase() === "true") return undefined;
    const qops = values
        .get("qop")
        ?.split(",")
        .map((value) => value.trim().toLowerCase());
    if (qops && !qops.includes("auth")) return undefined;
    return {
        realm,
        nonce,
        algorithm: algorithm as DigestAlgorithm,
        ...(qops ? { qop: "auth" as const } : {}),
        ...(values.has("opaque") ? { opaque: values.get("opaque") } : {}),
    };
}

function digestChallenge(header: string): DigestChallenge | undefined {
    const pattern =
        /(?:^|,\s*)([!#$%&'*+.^_`|~\w-]+)\s+(?=[!#$%&'*+.^_`|~\w-]+\s*=)/g;
    const matches = [...header.matchAll(pattern)];
    for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        if (match[1]?.toLowerCase() !== "digest") continue;
        const challenge = parseDigest(
            header.slice(
                (match.index ?? 0) + match[0].length,
                matches[index + 1]?.index ?? header.length,
            ),
        );
        if (challenge) return challenge;
    }
    return undefined;
}

const quote = (value: string) =>
    `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

export class DavClient {
    private readonly dispatcher: Agent;
    private authenticationScheme?: "basic" | "digest";
    private challenge?: DigestChallenge;
    private nonceCount = 0;
    readonly serviceUrl: URL;

    constructor(
        url: string,
        private readonly authentication: DavAuthentication,
        private readonly errorPrefix: string,
        private readonly timeoutMs = 15_000,
        networkOptions: DavNetworkOptions = {},
    ) {
        try {
            this.serviceUrl = new URL(url);
        } catch (error) {
            throw new DavFailure(`${errorPrefix}:invalid-url`, error);
        }
        if (
            this.serviceUrl.protocol !== "https:" &&
            !networkOptions.allowInsecureHttp
        )
            throw new DavFailure(`${errorPrefix}:https-required`);
        this.serviceUrl.username = "";
        this.serviceUrl.password = "";
        this.dispatcher = createGuardedDispatcher({
            allowPrivateAddresses: networkOptions.allowPrivateAddresses,
            maxResponseBytes:
                networkOptions.maxResponseBytes ?? 10 * 1024 * 1024,
        });
    }

    async close(): Promise<void> {
        if (typeof this.dispatcher.close === "function")
            await this.dispatcher.close();
    }

    assertAllowed(url: URL): void {
        if (url.protocol !== this.serviceUrl.protocol)
            throw new DavFailure(`${this.errorPrefix}:https-required`);
        if (url.origin !== this.serviceUrl.origin)
            throw new DavFailure(`${this.errorPrefix}:unsafe-redirect`);
    }

    async request(
        url: URL,
        init: RequestInit,
        redirects = 0,
        authAttempts = 0,
        signal: AbortSignal = AbortSignal.timeout(this.timeoutMs),
    ): Promise<Response> {
        this.assertAllowed(url);
        let response: Response;
        try {
            const authorization = this.authorization(url, init);
            response = await fetch(url, {
                ...init,
                redirect: "manual",
                signal,
                headers: {
                    ...init.headers,
                    ...(authorization ? { authorization } : {}),
                },
                dispatcher: this.dispatcher,
            } as RequestInit);
        } catch (error) {
            throw new DavFailure(
                `${this.errorPrefix}:connection-failed`,
                error,
            );
        }
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            await response.body?.cancel().catch(() => {});
            if (redirects >= MAX_REDIRECTS)
                throw new DavFailure(`${this.errorPrefix}:too-many-redirects`);
            if (!location)
                throw new DavFailure(`${this.errorPrefix}:invalid-response`);
            const method = (init.method ?? "GET").toUpperCase();
            if (
                ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
                ![307, 308].includes(response.status)
            )
                throw new DavFailure(`${this.errorPrefix}:unsafe-redirect`);
            return this.request(
                new URL(location, url),
                init,
                redirects + 1,
                authAttempts,
                signal,
            );
        }
        if (
            response.status === 401 &&
            "username" in this.authentication &&
            authAttempts < MAX_AUTH_ATTEMPTS
        ) {
            const authenticate = response.headers.get("www-authenticate") ?? "";
            const challenge = digestChallenge(authenticate);
            const basic = /(?:^|,\s*)Basic(?:\s|,|$)/i.test(authenticate);
            await response.body?.cancel().catch(() => {});
            if (challenge) {
                const stale = /(?:^|,\s*)stale\s*=\s*(?:true|"true")/i.test(
                    authenticate,
                );
                if (authAttempts > 0 && !stale)
                    throw new DavFailure(
                        `${this.errorPrefix}:authentication-failed`,
                    );
                this.authenticationScheme = "digest";
                this.challenge = challenge;
                this.nonceCount = 0;
                return this.request(
                    url,
                    init,
                    redirects,
                    authAttempts + 1,
                    signal,
                );
            }
            if (basic && authAttempts === 0) {
                this.authenticationScheme = "basic";
                return this.request(
                    url,
                    init,
                    redirects,
                    authAttempts + 1,
                    signal,
                );
            }
            throw new DavFailure(
                `${this.errorPrefix}:${authAttempts > 0 ? "authentication-failed" : "unsupported-authentication"}`,
            );
        }
        if (response.status === 401 || response.status === 403) {
            await response.body?.cancel().catch(() => {});
            throw new DavFailure(`${this.errorPrefix}:authentication-failed`);
        }
        return response;
    }

    async propfind(
        url: URL,
        depth: 0 | 1,
        body: string,
    ): Promise<Record<string, unknown>[]> {
        const response = await this.request(url, {
            method: "PROPFIND",
            headers: {
                depth: String(depth),
                "content-type": "application/xml; charset=utf-8",
            },
            body,
        });
        if (response.status === 404)
            return rejectDavResponse(response, `${this.errorPrefix}:not-found`);
        if (response.status !== 207) {
            await response.body?.cancel().catch(() => {});
            throw new DavFailure(`${this.errorPrefix}:invalid-response`);
        }
        try {
            const parsed = parseDavXml(await response.text());
            return asArray(
                (parsed.multistatus as Record<string, unknown> | undefined)
                    ?.response as
                    | Record<string, unknown>
                    | Record<string, unknown>[],
            );
        } catch {
            throw new DavFailure(`${this.errorPrefix}:invalid-response`);
        }
    }

    private authorization(url: URL, init: RequestInit): string | undefined {
        if ("token" in this.authentication)
            return `Bearer ${this.authentication.token}`;
        if (this.authenticationScheme === "basic")
            return `Basic ${Buffer.from(`${this.authentication.username}:${this.authentication.password}`, "utf8").toString("base64")}`;
        if (this.authenticationScheme !== "digest" || !this.challenge)
            return undefined;
        const challenge = this.challenge;
        const hashName = challenge.algorithm.startsWith("SHA-256")
            ? "sha256"
            : "md5";
        const hash = (value: string) =>
            createHash(hashName).update(value, "utf8").digest("hex");
        const method = (init.method ?? "GET").toUpperCase();
        const uri = `${url.pathname}${url.search}`;
        const cnonce = randomBytes(16).toString("hex");
        const nc = (++this.nonceCount).toString(16).padStart(8, "0");
        let ha1 = hash(
            `${this.authentication.username}:${challenge.realm}:${this.authentication.password}`,
        );
        if (challenge.algorithm.endsWith("-sess"))
            ha1 = hash(`${ha1}:${challenge.nonce}:${cnonce}`);
        const ha2 = hash(`${method}:${uri}`);
        const response = challenge.qop
            ? hash(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:auth:${ha2}`)
            : hash(`${ha1}:${challenge.nonce}:${ha2}`);
        const values = [
            `username=${quote(this.authentication.username)}`,
            `realm=${quote(challenge.realm)}`,
            `nonce=${quote(challenge.nonce)}`,
            `uri=${quote(uri)}`,
            `algorithm=${challenge.algorithm}`,
            `response=${quote(response)}`,
        ];
        if (challenge.opaque !== undefined)
            values.push(`opaque=${quote(challenge.opaque)}`);
        if (challenge.qop) values.push("qop=auth", `nc=${nc}`);
        if (challenge.qop || challenge.algorithm.endsWith("-sess"))
            values.push(`cnonce=${quote(cnonce)}`);
        return `Digest ${values.join(", ")}`;
    }
}
