import {
    asArray,
    type DavAuthentication,
    DavClient,
    DavFailure,
    type DavNetworkOptions,
    davHref,
    parseDavXml,
    propertyHref,
    rejectDavResponse,
    successfulProps,
} from "@sockethub/dav";
import { isUpdateSupported, parseICalendar } from "./ical.js";
import type { CalendarDescription, CalendarItem, QueryInput } from "./types.js";

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
        throw new DavFailure("caldav:invalid-query");
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

export const CalDavFailure = DavFailure;

export class CalDavClient extends DavClient {
    constructor(
        url: string,
        authentication: DavAuthentication,
        timeoutMs = 15_000,
        networkOptions: DavNetworkOptions = {},
    ) {
        super(url, authentication, "caldav", timeoutMs, networkOptions);
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
            const responseHref = davHref(response.href);
            if (!responseHref) continue;
            const calendarUrl = new URL(responseHref, homeUrl);
            this.assertAllowed(calendarUrl);
            const supported = props["supported-calendar-component-set"] as
                | Record<string, unknown>
                | undefined;
            const comps = asArray(
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
            return rejectDavResponse(response, "caldav:conflict");
        if (response.status === 404)
            return rejectDavResponse(response, "caldav:not-found");
        if (!response.ok)
            return rejectDavResponse(response, "caldav:create-failed");
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
                parsed = parseDavXml(await response.text());
            } catch {
                throw new CalDavFailure("caldav:invalid-response");
            }
            const responses = asArray(
                (parsed.multistatus as Record<string, unknown> | undefined)
                    ?.response as
                    | Record<string, unknown>
                    | Record<string, unknown>[],
            );
            for (const item of responses) {
                const props = successfulProps(item);
                const itemHref = davHref(item.href);
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
            return rejectDavResponse(current, "caldav:conflict");
        if (current.status === 404)
            return rejectDavResponse(current, "caldav:not-found");
        if (!current.ok)
            return rejectDavResponse(current, "caldav:update-failed");
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
            return rejectDavResponse(response, "caldav:conflict");
        if (response.status === 404)
            return rejectDavResponse(response, "caldav:not-found");
        if (!response.ok)
            return rejectDavResponse(response, "caldav:update-failed");
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
            return rejectDavResponse(response, "caldav:conflict");
        if (response.status === 404)
            return rejectDavResponse(response, "caldav:not-found");
        if (!response.ok)
            return rejectDavResponse(response, "caldav:delete-failed");
        await response.body?.cancel().catch(() => {});
    }
}
