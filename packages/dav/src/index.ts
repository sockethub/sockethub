import { createHash, createHmac, randomBytes } from "node:crypto";
import { createGuardedDispatcher } from "@sockethub/util/net";
import { XMLParser } from "fast-xml-parser";
import { type Agent, fetch as undiciFetch } from "undici";

const MAX_REDIRECTS = 5;
const MAX_AUTH_ATTEMPTS = 2;

export type DavAuthentication =
    | { username: string; password: string }
    | { token: string };
/** `fetch`-compatible function that honours an undici `dispatcher` option. */
export type DavFetch = (
    url: URL,
    init: RequestInit & { dispatcher?: Agent },
) => Promise<Response>;
export interface DavNetworkOptions {
    allowPrivateAddresses?: boolean;
    allowInsecureHttp?: boolean;
    maxResponseBytes?: number;
    /**
     * Fetch implementation. Defaults to undici's own `fetch` so the request
     * and the guarded dispatcher come from the same undici build (a global
     * `fetch` from a different undici major returns empty headers). Mainly a
     * test seam.
     */
    fetch?: DavFetch;
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

export function parseDavXml(
    xml: string,
    options: { parseTagValue?: boolean } = {},
): Record<string, unknown> {
    return new XMLParser({
        ignoreAttributes: false,
        // Opaque values such as sync tokens must survive verbatim; the parser
        // would otherwise turn "0012" into 12.
        parseTagValue: options.parseTagValue ?? true,
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

/**
 * In-process TTL cache for discovered DAV collections. Stateless DAV platforms
 * run as one long-lived process shared by every session, so a per-process map
 * is enough. Keys are an HMAC (with a per-process random secret) of the
 * identity parts, so credentials never appear in keys and cannot be recovered
 * from them. Concurrent misses for the same key share one pending discovery
 * however long it takes; the TTL starts when discovery succeeds. A single
 * unref'd timer removes expired entries, so they never outlive their TTL and
 * the timer never keeps the process alive.
 */
export class DiscoveryCache<T> {
    private readonly secret = randomBytes(32);
    private readonly entries = new Map<string, { expires: number; value: T }>();
    private readonly pending = new Map<string, Promise<T>>();
    private timer?: ReturnType<typeof setTimeout>;
    private timerAt = Number.POSITIVE_INFINITY;

    constructor(private readonly maxEntries = 1000) {}

    key(...identity: unknown[]): string {
        return createHmac("sha256", this.secret)
            .update(JSON.stringify(identity))
            .digest("hex");
    }

    /** Return the cached value for `key`, or run `discover`. `ttlMs <= 0` disables caching. */
    async get(
        key: string,
        ttlMs: number,
        discover: () => Promise<T>,
    ): Promise<T> {
        if (!(ttlMs > 0)) return discover();
        const hit = this.entries.get(key);
        if (hit && hit.expires > Date.now()) return hit.value;
        const inFlight = this.pending.get(key);
        if (inFlight) return inFlight;
        const promise = discover();
        this.pending.set(key, promise);
        try {
            const value = await promise;
            // Skip storing if the key was invalidated while discovery ran.
            if (this.pending.get(key) === promise)
                this.store(key, value, Date.now() + ttlMs);
            return value;
        } finally {
            if (this.pending.get(key) === promise) this.pending.delete(key);
        }
    }

    delete(key: string): void {
        this.entries.delete(key);
        this.pending.delete(key);
    }

    /** Number of stored (settled, unexpired or not yet swept) entries. */
    get size(): number {
        return this.entries.size;
    }

    private store(key: string, value: T, expires: number): void {
        this.entries.delete(key);
        if (this.entries.size >= this.maxEntries) {
            this.sweep();
            // Still full: evict the oldest insertion.
            if (this.entries.size >= this.maxEntries)
                this.entries.delete(this.entries.keys().next().value as string);
        }
        this.entries.set(key, { expires, value });
        this.schedule(expires);
    }

    private sweep(): void {
        const now = Date.now();
        for (const [key, entry] of this.entries)
            if (entry.expires <= now) this.entries.delete(key);
    }

    private schedule(at: number): void {
        if (this.timer && at >= this.timerAt) return;
        clearTimeout(this.timer);
        this.timerAt = at;
        this.timer = setTimeout(
            () => {
                this.timer = undefined;
                this.timerAt = Number.POSITIVE_INFINITY;
                this.sweep();
                let next = Number.POSITIVE_INFINITY;
                for (const entry of this.entries.values())
                    next = Math.min(next, entry.expires);
                if (next !== Number.POSITIVE_INFINITY) this.schedule(next);
            },
            // setTimeout treats delays over 2^31-1 ms as 1 ms; the callback reschedules.
            Math.min(Math.max(0, at - Date.now()), 2_147_483_647),
        );
        this.timer.unref?.();
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

/** Request options understood by `DavClient.request`. */
export type DavRequestInit = RequestInit & {
    /**
     * Return a 403 response to the caller instead of treating it as an
     * authentication failure. WebDAV reports failed preconditions, such as an
     * expired sync token, as 403 with a `DAV:error` body.
     */
    passForbidden?: boolean;
};

export interface DavSyncMember {
    /** Absolute URL of the changed member. */
    id: string;
    props: Record<string, unknown>;
}

export interface DavSyncResult {
    changed: DavSyncMember[];
    /** Absolute URLs of members removed since the supplied token. */
    removed: string[];
    syncToken: string;
    /** The server truncated the result; sync again with `syncToken`. */
    truncated: boolean;
}

export interface DavSyncResource {
    /** Absolute URL of the changed member. */
    id: string;
    etag?: string;
    /** Body of the member, such as iCalendar or vCard text. */
    data: string;
}

export interface DavSyncResourcesResult {
    resources: DavSyncResource[];
    removed: string[];
    syncToken: string;
    truncated: boolean;
}

export interface DavSyncDataOptions {
    /** Namespace declarations for the prefixes below, besides `d` (`DAV:`). */
    namespaces: string;
    /** Prefixed element holding member data, e.g. `c:calendar-data`. */
    data: string;
    /** Prefixed multiget report element, e.g. `c:calendar-multiget`. */
    multiget: string;
}

const isStatus = (value: unknown, code: number) =>
    new RegExp(`\\s${code}(?:\\s|$)`).test(String(value ?? ""));

/** Names of the precondition elements in a `DAV:error` body. */
function davPreconditions(xml: string): string[] {
    try {
        const error = parseDavXml(xml).error;
        return error && typeof error === "object" ? Object.keys(error) : [];
    } catch {
        return [];
    }
}

const xmlEscape = (value: string) =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

export class DavClient {
    private readonly dispatcher: Agent;
    private readonly fetchImpl: DavFetch;
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
        this.fetchImpl =
            networkOptions.fetch ?? (undiciFetch as unknown as DavFetch);
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
        init: DavRequestInit,
        redirects = 0,
        authAttempts = 0,
        signal: AbortSignal = AbortSignal.timeout(this.timeoutMs),
    ): Promise<Response> {
        this.assertAllowed(url);
        let response: Response;
        try {
            const { passForbidden: _, ...fetchInit } = init;
            const authorization = this.authorization(url, init);
            response = await this.fetchImpl(url, {
                ...fetchInit,
                redirect: "manual",
                signal,
                headers: {
                    ...init.headers,
                    ...(authorization ? { authorization } : {}),
                },
                dispatcher: this.dispatcher,
            });
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
        if (
            response.status === 401 ||
            (response.status === 403 && !init.passForbidden)
        ) {
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
        return this.readMultistatus(response);
    }

    /**
     * The collection's current RFC 6578 sync token, read from its
     * `DAV:sync-token` property without listing any members. A later
     * `syncCollection` with this token returns only what changed after it.
     * Throws `sync-unsupported` when the server exposes no token.
     */
    async currentSyncToken(collection: URL): Promise<string> {
        const response = await this.request(collection, {
            method: "PROPFIND",
            headers: {
                depth: "0",
                "content-type": "application/xml; charset=utf-8",
            },
            body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:"><d:prop><d:sync-token/></d:prop></d:propfind>`,
        });
        if (response.status === 404)
            return rejectDavResponse(response, `${this.errorPrefix}:not-found`);
        if (response.status !== 207) {
            await response.body?.cancel().catch(() => {});
            throw new DavFailure(`${this.errorPrefix}:invalid-response`);
        }
        let responses: Record<string, unknown>[];
        try {
            responses = asArray(
                (
                    parseDavXml(await response.text(), {
                        parseTagValue: false,
                    }).multistatus as Record<string, unknown> | undefined
                )?.response as
                    | Record<string, unknown>
                    | Record<string, unknown>[],
            );
        } catch {
            throw new DavFailure(`${this.errorPrefix}:invalid-response`);
        }
        const token = successfulProps(responses[0] ?? {})["sync-token"];
        if (typeof token !== "string" || token.trim() === "")
            throw new DavFailure(`${this.errorPrefix}:sync-unsupported`);
        return token.trim();
    }

    /**
     * Run an RFC 6578 `DAV:sync-collection` REPORT against `collection`.
     * Without `syncToken` this is the initial sync and lists every member.
     * `prop` is the inner XML of the `DAV:prop` element, and `namespaces`
     * declares any prefixes it uses besides `d` (`DAV:`).
     *
     * Errors use the client prefix: `sync-unsupported` when the server does
     * not offer the report, `sync-token-invalid` when it rejects the token
     * (start again without one), and `not-found` for a missing collection.
     * Without a precondition element, a 400/409/412 counts as a rejected
     * token when one was sent, so a client's retry without a token reaches
     * the real cause; a plain 403 stays an authentication failure.
     */
    async syncCollection(
        collection: URL,
        prop: string,
        syncToken?: string,
        namespaces = "",
    ): Promise<DavSyncResult> {
        const response = await this.request(collection, {
            method: "REPORT",
            passForbidden: true,
            headers: {
                depth: "0",
                "content-type": "application/xml; charset=utf-8",
            },
            body: `<?xml version="1.0" encoding="utf-8"?>
<d:sync-collection xmlns:d="DAV:"${namespaces ? ` ${namespaces}` : ""}>
 ${syncToken ? `<d:sync-token>${xmlEscape(syncToken)}</d:sync-token>` : "<d:sync-token/>"}
 <d:sync-level>1</d:sync-level>
 <d:prop>${prop}</d:prop>
</d:sync-collection>`,
        });
        if (response.status !== 207) {
            let body = "";
            try {
                body = await response.text();
            } catch {
                // The status alone decides below.
            }
            const preconditions = davPreconditions(body);
            const prefix = this.errorPrefix;
            if (preconditions.includes("valid-sync-token"))
                throw new DavFailure(`${prefix}:sync-token-invalid`);
            if (preconditions.includes("supported-report"))
                throw new DavFailure(`${prefix}:sync-unsupported`);
            if (response.status === 404)
                throw new DavFailure(`${prefix}:not-found`);
            if ([400, 409, 412].includes(response.status) && syncToken)
                throw new DavFailure(`${prefix}:sync-token-invalid`);
            if (response.status === 403)
                throw new DavFailure(`${prefix}:authentication-failed`);
            if ([400, 405, 415, 501].includes(response.status))
                throw new DavFailure(`${prefix}:sync-unsupported`);
            throw new DavFailure(`${prefix}:sync-failed`);
        }
        let multistatus: Record<string, unknown>;
        try {
            const parsed = parseDavXml(await response.text(), {
                parseTagValue: false,
            }).multistatus;
            if (!parsed || typeof parsed !== "object") throw new Error();
            multistatus = parsed as Record<string, unknown>;
        } catch {
            throw new DavFailure(`${this.errorPrefix}:invalid-response`);
        }
        const token = multistatus["sync-token"];
        if (typeof token !== "string" || token.trim() === "")
            throw new DavFailure(`${this.errorPrefix}:invalid-response`);
        const result: DavSyncResult = {
            changed: [],
            removed: [],
            syncToken: token.trim(),
            truncated: false,
        };
        for (const item of asArray(
            multistatus.response as
                | Record<string, unknown>
                | Record<string, unknown>[],
        )) {
            const href = davHref(item.href);
            if (!href)
                throw new DavFailure(`${this.errorPrefix}:invalid-response`);
            const id = new URL(href, collection).href;
            const status = item.status;
            if (id === collection.href || `${id}/` === collection.href) {
                // RFC 6578 3.6: 507 on the collection marks a truncated result.
                if (isStatus(status, 507)) result.truncated = true;
                continue;
            }
            if (!isDavCollectionChild(collection.href, id))
                throw new DavFailure(`${this.errorPrefix}:invalid-response`);
            if (isStatus(status, 404)) result.removed.push(id);
            else result.changed.push({ id, props: successfulProps(item) });
        }
        return result;
    }

    /**
     * `syncCollection` that also returns each changed member's data. Members
     * the server lists without data are fetched with one multiget REPORT; a
     * member the multiget reports as 404 was deleted in between and is listed
     * as removed. A member that still has no data fails the sync with
     * `invalid-response`, because returning the token would skip its change.
     */
    async syncResources(
        collection: URL,
        options: DavSyncDataOptions,
        syncToken?: string,
    ): Promise<DavSyncResourcesResult> {
        const property = options.data.slice(options.data.indexOf(":") + 1);
        const sync = await this.syncCollection(
            collection,
            `<d:getetag/><${options.data}/>`,
            syncToken,
            options.namespaces,
        );
        const resources: DavSyncResource[] = [];
        const missing = new Map<string, unknown>();
        const add = (id: string, value: unknown, etag: unknown) => {
            // An element with attributes, such as content-type, parses to
            // an object holding its text.
            const data =
                value && typeof value === "object"
                    ? (value as Record<string, unknown>)["#text"]
                    : value;
            if (typeof data !== "string") return false;
            resources.push({
                id,
                data,
                ...(typeof etag === "string" ? { etag } : {}),
            });
            return true;
        };
        for (const member of sync.changed)
            if (!add(member.id, member.props[property], member.props.getetag))
                missing.set(member.id, member.props.getetag);
        if (missing.size) {
            const hrefs = [...missing.keys()]
                .map(
                    (id) =>
                        `<d:href>${xmlEscape(new URL(id).pathname)}</d:href>`,
                )
                .join("");
            const response = await this.request(collection, {
                method: "REPORT",
                headers: {
                    depth: "1",
                    "content-type": "application/xml; charset=utf-8",
                },
                body: `<?xml version="1.0" encoding="utf-8"?>
<${options.multiget} xmlns:d="DAV:" ${options.namespaces}>
 <d:prop><d:getetag/><${options.data}/></d:prop>
 ${hrefs}
</${options.multiget}>`,
            });
            if (response.status !== 207)
                return rejectDavResponse(
                    response,
                    `${this.errorPrefix}:sync-failed`,
                );
            for (const item of await this.readMultistatus(response)) {
                const href = davHref(item.href);
                if (!href) continue;
                const id = new URL(href, collection).href;
                if (!missing.has(id)) continue;
                if (isStatus(item.status, 404)) {
                    sync.removed.push(id);
                    missing.delete(id);
                    continue;
                }
                const props = successfulProps(item);
                if (add(id, props[property], props.getetag ?? missing.get(id)))
                    missing.delete(id);
            }
            if (missing.size)
                throw new DavFailure(`${this.errorPrefix}:invalid-response`);
        }
        return {
            resources,
            removed: sync.removed,
            syncToken: sync.syncToken,
            truncated: sync.truncated,
        };
    }

    /** The `DAV:response` elements of a 207 multistatus body. */
    async readMultistatus(
        response: Response,
    ): Promise<Record<string, unknown>[]> {
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
