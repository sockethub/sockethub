import { createGuardedDispatcher } from "@sockethub/util/net";
import { XMLParser } from "fast-xml-parser";
import type { Agent } from "undici";
import { parseICalendar } from "./ical.js";
import type { CalendarDescription, CalendarItem, QueryInput } from "./types.js";

const MAX_REDIRECTS = 5;
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
    constructor(readonly code: string) {
        super(code);
    }
}

function array<T>(value: T | T[] | undefined): T[] {
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
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

export class CalDavClient {
    private readonly dispatcher: Agent;
    private readonly authorization: string;
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
        this.authorization =
            "token" in authentication
                ? `Bearer ${authentication.token}`
                : `Basic ${Buffer.from(`${authentication.username}:${authentication.password}`, "utf8").toString("base64")}`;
        this.dispatcher = createGuardedDispatcher({
            allowPrivateAddresses: networkOptions.allowPrivateAddresses,
            maxResponseBytes: 1024 * 1024,
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
    ): Promise<Response> {
        this.assertAllowed(url);
        let response: Response;
        try {
            response = await fetch(url, {
                ...init,
                redirect: "manual",
                signal: AbortSignal.timeout(this.timeoutMs),
                headers: { ...init.headers, authorization: this.authorization },
                // Node's fetch accepts this undici extension.
                dispatcher: this.dispatcher,
            } as RequestInit);
        } catch {
            throw new CalDavFailure("caldav:connection-failed");
        }
        if (response.status >= 300 && response.status < 400) {
            if (redirects >= MAX_REDIRECTS)
                throw new CalDavFailure("caldav:too-many-redirects");
            const location = response.headers.get("location");
            await response.body?.cancel().catch(() => {});
            if (!location) throw new CalDavFailure("caldav:invalid-response");
            return this.request(new URL(location, url), init, redirects + 1);
        }
        if (response.status === 401 || response.status === 403) {
            await response.body?.cancel().catch(() => {});
            throw new CalDavFailure("caldav:authentication-failed");
        }
        return response;
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
            throw new CalDavFailure("caldav:not-found");
        if (response.status !== 207) {
            await response.body?.cancel().catch(() => {});
            throw new CalDavFailure("caldav:invalid-response");
        }
        let parsed: Record<string, unknown>;
        try {
            parsed = new XMLParser({
                ignoreAttributes: false,
                removeNSPrefix: true,
            }).parse(await response.text());
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
        if (response.status === 412) throw new CalDavFailure("caldav:conflict");
        if (response.status === 404)
            throw new CalDavFailure("caldav:not-found");
        if (!response.ok) throw new CalDavFailure("caldav:create-failed");
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
                parsed = new XMLParser({
                    ignoreAttributes: false,
                    removeNSPrefix: true,
                }).parse(await response.text());
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
        const response = await this.request(resource, {
            method: "PUT",
            headers: {
                "content-type": "text/calendar; charset=utf-8",
                "if-match": etag,
            },
            body,
        });
        if (response.status === 412) throw new CalDavFailure("caldav:conflict");
        if (response.status === 404)
            throw new CalDavFailure("caldav:not-found");
        if (!response.ok) throw new CalDavFailure("caldav:update-failed");
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
        if (response.status === 412) throw new CalDavFailure("caldav:conflict");
        if (response.status === 404)
            throw new CalDavFailure("caldav:not-found");
        if (!response.ok) throw new CalDavFailure("caldav:delete-failed");
        await response.body?.cancel().catch(() => {});
    }
}
