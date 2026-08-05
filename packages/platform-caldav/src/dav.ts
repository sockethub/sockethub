import { createHash, randomBytes } from "node:crypto";
import { createGuardedDispatcher } from "@sockethub/util/net";
import { XMLParser } from "fast-xml-parser";
import type { Agent } from "undici";
import { isUpdateSupported, parseICalendar } from "./ical.js";
import type { CalendarDescription, CalendarItem, QueryInput } from "./types.js";

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_AUTH_ATTEMPTS = 2;
const DAV_PROPS = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:current-user-principal/><c:calendar-home-set/></d:prop>
</d:propfind>`;
const CALENDAR_PROPS = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/">
  <d:prop><d:resourcetype/><d:displayname/><a:calendar-color/><c:supported-calendar-component-set/></d:prop>
</d:propfind>`;
const calDavTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        throw new CalDavFailure("caldav:invalid-query");
    return parsed
        .toISOString()
        .replaceAll("-", "")
        .replaceAll(":", "")
        .replace(/\.\d{3}Z$/, "Z");
};
const queryBody = (query: QueryInput) => `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
 <d:prop><d:getetag/><c:calendar-data/></d:prop>
 <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="${query.type === "task" ? "VTODO" : "VEVENT"}">${query.startTime || query.endTime ? `<c:time-range${query.startTime ? ` start="${calDavTime(query.startTime)}"` : ""}${query.endTime ? ` end="${calDavTime(query.endTime)}"` : ""}/>` : ""}</c:comp-filter></c:comp-filter></c:filter>
</c:calendar-query>`;

export class CalDavFailure extends Error {
    constructor(
        readonly code: string,
        cause?: unknown,
    ) {
        super(code, { cause });
    }
}

async function rejectResponse(
    response: Response,
    code: string,
): Promise<never> {
    await response.body?.cancel().catch(() => {});
    throw new CalDavFailure(code);
}

function array<T>(value: T | T[] | undefined): T[] {
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
                const isXmlCharacter =
                    Number.isSafeInteger(codePoint) &&
                    (codePoint === 0x9 ||
                        codePoint === 0xa ||
                        codePoint === 0xd ||
                        (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
                        (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
                        (codePoint >= 0x10000 && codePoint <= 0x10ffff));
                if (!isXmlCharacter) return reference;
                return String.fromCodePoint(codePoint);
            }
            return predefined[entity.toLowerCase()] ?? reference;
        },
    );
}

function xmlParser(): XMLParser {
    return new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true,
        processEntities: false,
        tagValueProcessor: (_tagName, value) => xmlText(value),
    });
}

function successfulProps(
    response: Record<string, unknown>,
): Record<string, unknown> {
    for (const item of array(
        response.propstat as
            | Record<string, unknown>
            | Record<string, unknown>[],
    )) {
        if (String(item.status ?? "").includes(" 200 ")) {
            return (item.prop as Record<string, unknown>) ?? {};
        }
    }
    return {};
}

function href(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
        const text = (value as Record<string, unknown>)["#text"];
        if (typeof text === "string") return text;
    }
    return undefined;
}

function propertyHref(value: unknown): string | undefined {
    if (value && typeof value === "object") {
        return href((value as Record<string, unknown>).href);
    }
    return href(value);
}

type PasswordAuthentication = { username: string; password: string };
type DigestAlgorithm = "MD5" | "MD5-sess" | "SHA-256" | "SHA-256-sess";
type DigestChallenge = {
    realm: string;
    nonce: string;
    algorithm: DigestAlgorithm;
    qop?: "auth";
    opaque?: string;
};

function unquote(value: string): string {
    if (!value.startsWith('"')) return value;
    return value.slice(1, -1).replace(/\\(.)/g, "$1");
}

function parseDigestChallenge(parameters: string): DigestChallenge | undefined {
    const values = new Map<string, string>();
    for (const item of parameters.matchAll(
        /(?:^|,\s*)([!#$%&'*+.^_`|~\w-]+)\s*=\s*("(?:\\.|[^"\\])*"|[^,\s]+)/g,
    )) {
        values.set(item[1].toLowerCase(), unquote(item[2]));
    }
    const realm = values.get("realm");
    const nonce = values.get("nonce");
    if (!realm || !nonce) return undefined;
    const algorithmValue = (values.get("algorithm") ?? "MD5").toUpperCase();
    const algorithm = algorithmValue.endsWith("-SESS")
        ? `${algorithmValue.slice(0, -5)}-sess`
        : algorithmValue;
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
    const challengePattern =
        /(?:^|,\s*)([!#$%&'*+.^_`|~\w-]+)\s+(?=[!#$%&'*+.^_`|~\w-]+\s*=)/g;
    const matches = [...header.matchAll(challengePattern)];
    for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        if (match[1]?.toLowerCase() !== "digest") continue;
        const start = (match.index ?? 0) + match[0].length;
        const end = matches[index + 1]?.index ?? header.length;
        const challenge = parseDigestChallenge(header.slice(start, end));
        if (challenge) return challenge;
    }
    return undefined;
}

function quote(value: string): string {
    return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export class CalDavClient {
    private readonly dispatcher: Agent;
    private readonly authentication: PasswordAuthentication | { token: string };
    private authenticationScheme?: "basic" | "digest";
    private challenge?: DigestChallenge;
    private nonceCount = 0;
    readonly serviceUrl: URL;

    constructor(
        url: string,
        authentication:
            | { username: string; password: string }
            | { token: string },
        private timeoutMs = 15_000,
        networkOptions: {
            allowPrivateAddresses?: boolean;
            allowInsecureHttp?: boolean;
        } = {},
    ) {
        this.serviceUrl = new URL(url);
        if (
            this.serviceUrl.protocol !== "https:" &&
            !networkOptions.allowInsecureHttp
        ) {
            throw new CalDavFailure("caldav:https-required");
        }
        this.serviceUrl.username = "";
        this.serviceUrl.password = "";
        this.authentication = authentication;
        this.dispatcher = createGuardedDispatcher({
            allowPrivateAddresses: networkOptions.allowPrivateAddresses,
            maxResponseBytes: MAX_RESPONSE_BYTES,
        });
    }

    async close(): Promise<void> {
        // Bun's fetch-compatible dispatcher shim does not expose close(); the
        // Node/undici Agent does. Closing is best-effort in either runtime.
        if (typeof this.dispatcher.close === "function") {
            await this.dispatcher.close();
        }
    }

    private assertAllowed(url: URL): void {
        if (url.protocol !== this.serviceUrl.protocol)
            throw new CalDavFailure("caldav:https-required");
        if (url.origin !== this.serviceUrl.origin) {
            throw new CalDavFailure("caldav:unsafe-redirect");
        }
    }

    private async request(
        url: URL,
        init: RequestInit,
        redirects = 0,
        authAttempts = 0,
    ): Promise<Response> {
        this.assertAllowed(url);
        let response: Response;
        try {
            const authorization = this.authorization(url, init);
            response = await fetch(url, {
                ...init,
                redirect: "manual",
                signal: AbortSignal.timeout(this.timeoutMs),
                headers: {
                    ...init.headers,
                    ...(authorization ? { authorization } : {}),
                },
                // Node's fetch accepts this undici extension.
                dispatcher: this.dispatcher,
            } as RequestInit);
        } catch (error) {
            throw new CalDavFailure("caldav:connection-failed", error);
        }
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            await response.body?.cancel().catch(() => {});
            if (redirects >= MAX_REDIRECTS)
                throw new CalDavFailure("caldav:too-many-redirects");
            if (!location) throw new CalDavFailure("caldav:invalid-response");
            const method = (init.method ?? "GET").toUpperCase();
            const writable = ["POST", "PUT", "PATCH", "DELETE"].includes(
                method,
            );
            if (writable && ![307, 308].includes(response.status))
                throw new CalDavFailure("caldav:unsafe-redirect");
            return this.request(
                new URL(location, url),
                init,
                redirects + 1,
                authAttempts,
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
                    throw new CalDavFailure("caldav:authentication-failed");
                this.authenticationScheme = "digest";
                this.challenge = challenge;
                this.nonceCount = 0;
                return this.request(url, init, redirects, authAttempts + 1);
            }
            if (basic && authAttempts === 0) {
                this.authenticationScheme = "basic";
                return this.request(url, init, redirects, authAttempts + 1);
            }
            if (authAttempts > 0)
                throw new CalDavFailure("caldav:authentication-failed");
            throw new CalDavFailure("caldav:unsupported-authentication");
        }
        if (response.status === 401 || response.status === 403) {
            await response.body?.cancel().catch(() => {});
            throw new CalDavFailure("caldav:authentication-failed");
        }
        return response;
    }

    private authorization(url: URL, init: RequestInit): string | undefined {
        if ("token" in this.authentication)
            return `Bearer ${this.authentication.token}`;
        if (this.authenticationScheme === "basic") {
            return `Basic ${Buffer.from(`${this.authentication.username}:${this.authentication.password}`, "utf8").toString("base64")}`;
        }
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

    private async propfind(
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
            return rejectResponse(response, "caldav:not-found");
        if (response.status !== 207) {
            await response.body?.cancel().catch(() => {});
            throw new CalDavFailure("caldav:invalid-response");
        }
        let parsed: Record<string, unknown>;
        try {
            parsed = xmlParser().parse(await response.text());
        } catch {
            throw new CalDavFailure("caldav:invalid-response");
        }
        const multistatus = parsed.multistatus as
            | Record<string, unknown>
            | undefined;
        return array(
            multistatus?.response as
                | Record<string, unknown>
                | Record<string, unknown>[],
        );
    }

    async discoverCalendars(): Promise<CalendarDescription[]> {
        try {
            return await this.discoverFrom(this.serviceUrl);
        } catch (error) {
            if (
                !(error instanceof CalDavFailure) ||
                !["caldav:not-found", "caldav:not-caldav"].includes(error.code)
            ) {
                throw error;
            }
            const wellKnown = new URL("/.well-known/caldav", this.serviceUrl);
            if (wellKnown.href === this.serviceUrl.href) throw error;
            return await this.discoverFrom(wellKnown);
        }
    }

    private async discoverFrom(entryUrl: URL): Promise<CalendarDescription[]> {
        const initial = await this.propfind(entryUrl, 0, DAV_PROPS);
        const initialProps = successfulProps(initial[0] ?? {});
        let homeHref = propertyHref(initialProps["calendar-home-set"]);
        if (!homeHref) {
            const principalHref = propertyHref(
                initialProps["current-user-principal"],
            );
            if (!principalHref) throw new CalDavFailure("caldav:not-caldav");
            const principalUrl = new URL(principalHref, entryUrl);
            this.assertAllowed(principalUrl);
            const principal = await this.propfind(principalUrl, 0, DAV_PROPS);
            homeHref = propertyHref(
                successfulProps(principal[0] ?? {})["calendar-home-set"],
            );
        }
        if (!homeHref) throw new CalDavFailure("caldav:not-caldav");
        const homeUrl = new URL(homeHref, entryUrl);
        this.assertAllowed(homeUrl);
        const responses = await this.propfind(homeUrl, 1, CALENDAR_PROPS);
        const calendars: CalendarDescription[] = [];
        for (const response of responses) {
            const props = successfulProps(response);
            const resourceType = props.resourcetype as
                | Record<string, unknown>
                | undefined;
            if (!resourceType || !("calendar" in resourceType)) continue;
            const responseHref = href(response.href);
            if (!responseHref) continue;
            const calendarUrl = new URL(responseHref, homeUrl);
            this.assertAllowed(calendarUrl);
            const supported = props["supported-calendar-component-set"] as
                | Record<string, unknown>
                | undefined;
            const comps = array(
                supported?.comp as
                    | Record<string, unknown>
                    | Record<string, unknown>[],
            );
            const names = comps.map((comp) =>
                String(comp["@_name"] ?? "").toUpperCase(),
            );
            const components: Array<"event" | "task"> = [];
            // Absence means the server accepts all component types (RFC 4791 5.2.3).
            if (!supported || names.includes("VEVENT"))
                components.push("event");
            if (!supported || names.includes("VTODO")) components.push("task");
            calendars.push({
                id: calendarUrl.href,
                type: "calendar",
                name:
                    typeof props.displayname === "string"
                        ? props.displayname
                        : calendarUrl.pathname,
                ...(typeof props["calendar-color"] === "string"
                    ? { color: props["calendar-color"] }
                    : {}),
                components,
            });
        }
        return calendars;
    }

    async create(
        calendar: CalendarDescription,
        uid: string,
        body: string,
    ): Promise<{ id: string; etag?: string }> {
        const resource = new URL(
            `${encodeURIComponent(uid)}.ics`,
            calendar.id.endsWith("/") ? calendar.id : `${calendar.id}/`,
        );
        this.assertAllowed(resource);
        const response = await this.request(resource, {
            method: "PUT",
            headers: {
                "content-type": "text/calendar; charset=utf-8",
                "if-none-match": "*",
            },
            body,
        });
        if (response.status === 412)
            return rejectResponse(response, "caldav:conflict");
        if (response.status === 404)
            return rejectResponse(response, "caldav:not-found");
        if (!response.ok)
            return rejectResponse(response, "caldav:create-failed");
        await response.body?.cancel().catch(() => {});
        const location = response.headers.get("location");
        const finalUrl = location ? new URL(location, resource) : resource;
        this.assertAllowed(finalUrl);
        return {
            id: finalUrl.href,
            etag: response.headers.get("etag") ?? undefined,
        };
    }

    async query(
        calendar: CalendarDescription,
        query: QueryInput = {},
    ): Promise<CalendarItem[]> {
        const types = query.type ? [query.type] : calendar.components;
        const items: CalendarItem[] = [];
        for (const type of types) {
            const response = await this.request(new URL(calendar.id), {
                method: "REPORT",
                headers: {
                    depth: "1",
                    "content-type": "application/xml; charset=utf-8",
                },
                body: queryBody({ ...query, type }),
            });
            if (response.status !== 207) {
                await response.body?.cancel().catch(() => {});
                throw new CalDavFailure("caldav:query-failed");
            }
            let parsed: Record<string, unknown>;
            try {
                parsed = xmlParser().parse(await response.text());
            } catch {
                throw new CalDavFailure("caldav:invalid-response");
            }
            const responses = array(
                (parsed.multistatus as Record<string, unknown> | undefined)
                    ?.response as
                    | Record<string, unknown>
                    | Record<string, unknown>[],
            );
            for (const item of responses) {
                const props = successfulProps(item);
                const itemHref = href(item.href);
                const data = props["calendar-data"];
                if (!itemHref || typeof data !== "string") continue;
                try {
                    items.push(
                        parseICalendar(
                            data,
                            new URL(itemHref, calendar.id).href,
                            typeof props.getetag === "string"
                                ? props.getetag
                                : undefined,
                        ),
                    );
                } catch {
                    throw new CalDavFailure("caldav:invalid-response");
                }
            }
        }
        return items;
    }

    async update(
        id: string,
        etag: string,
        body: string,
    ): Promise<{ id: string; etag?: string }> {
        const resource = new URL(id);
        this.assertAllowed(resource);
        const current = await this.request(resource, {
            method: "GET",
            headers: { "if-match": etag },
        });
        if (current.status === 412)
            return rejectResponse(current, "caldav:conflict");
        if (current.status === 404)
            return rejectResponse(current, "caldav:not-found");
        if (!current.ok) return rejectResponse(current, "caldav:update-failed");
        if (!isUpdateSupported(await current.text()))
            throw new CalDavFailure("caldav:unsupported-update");
        const response = await this.request(resource, {
            method: "PUT",
            headers: {
                "content-type": "text/calendar; charset=utf-8",
                "if-match": etag,
            },
            body,
        });
        if (response.status === 412)
            return rejectResponse(response, "caldav:conflict");
        if (response.status === 404)
            return rejectResponse(response, "caldav:not-found");
        if (!response.ok)
            return rejectResponse(response, "caldav:update-failed");
        await response.body?.cancel().catch(() => {});
        return {
            id: resource.href,
            etag: response.headers.get("etag") ?? undefined,
        };
    }

    async delete(id: string, etag: string): Promise<void> {
        const resource = new URL(id);
        this.assertAllowed(resource);
        const response = await this.request(resource, {
            method: "DELETE",
            headers: { "if-match": etag },
        });
        if (response.status === 412)
            return rejectResponse(response, "caldav:conflict");
        if (response.status === 404)
            return rejectResponse(response, "caldav:not-found");
        if (!response.ok)
            return rejectResponse(response, "caldav:delete-failed");
        await response.body?.cancel().catch(() => {});
    }
}
