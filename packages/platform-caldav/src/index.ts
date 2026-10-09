import type {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformInterface,
    PlatformSchemaStruct,
    PlatformSession,
    StatelessPlatformConfig,
} from "@sockethub/schemas";
import { buildCanonicalContext } from "@sockethub/schemas";
import { createGuardedDispatcher } from "@sockethub/util/net";
import { CalDavClient, CalDavFailure } from "./dav.js";
import { buildICalendar } from "./ical.js";
import { parseICalendarFeed } from "./ics.js";
import { PlatformCalDavSchema } from "./schema.js";
import type {
    CalDavCredentials,
    CalendarObjectInput,
    DeleteInput,
    QueryInput,
} from "./types.js";

const CONTEXT = buildCanonicalContext(PlatformCalDavSchema.contextUrl);
const MAX_FEED_BYTES = 10 * 1024 * 1024;
const MAX_FEED_REDIRECTS = 5;

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

export function assertCalendarResource(
    calendarId: string,
    resourceId: string,
): void {
    let calendar: URL;
    let resource: URL;
    try {
        calendar = new URL(calendarId);
        resource = new URL(resourceId);
    } catch {
        throw new CalDavFailure("caldav:invalid-resource");
    }
    if (
        calendar.search ||
        calendar.hash ||
        resource.search ||
        resource.hash ||
        !safePathname(calendar.pathname) ||
        !safePathname(resource.pathname)
    )
        throw new CalDavFailure("caldav:invalid-resource");
    const prefix = calendar.pathname.endsWith("/")
        ? calendar.pathname
        : `${calendar.pathname}/`;
    if (
        resource.origin !== calendar.origin ||
        !resource.pathname.startsWith(prefix) ||
        resource.pathname === prefix
    )
        throw new CalDavFailure("caldav:invalid-resource");
}

export default class CalDav implements PlatformInterface {
    private readonly log: Logger;
    private feedDispatcher?: ReturnType<typeof createGuardedDispatcher>;
    config: StatelessPlatformConfig = {
        persist: false,
        requireCredentials: ["fetch", "query", "create", "update", "delete"],
        connectTimeoutMs: 15_000,
        allowPrivateAddresses: false,
        allowInsecureHttp: false,
        concurrency: 10,
    };

    constructor(session: PlatformSession) {
        this.log = session.log;
    }

    get schema(): PlatformSchemaStruct {
        return PlatformCalDavSchema;
    }

    isInitialized(): boolean {
        return true;
    }

    cleanup(done: PlatformCallback): void {
        if (typeof this.feedDispatcher?.close === "function")
            this.feedDispatcher.close().catch(() => {});
        this.feedDispatcher = undefined;
        done();
    }

    fetch(
        job: ActivityStream,
        credentials: CalDavCredentials,
        done: PlatformCallback,
    ): void {
        const client = this.client(credentials);
        client
            .discoverCalendars()
            .then((calendars) =>
                done(null, {
                    "@context": CONTEXT,
                    id: job.id ?? null,
                    type: "collection",
                    summary: "CalDAV calendars",
                    totalItems: calendars.length,
                    // The platform response schema intentionally defines compact
                    // calendar descriptors rather than nested activities.
                    items: calendars,
                } as never),
            )
            .catch((error) => this.fail(job, error, done))
            .finally(() => client.close().catch(() => {}));
    }

    /**
     * Read a published iCalendar (`.ics`) file such as a holiday calendar or a
     * read-only subscription link. No CalDAV account is involved, so this
     * action takes no credentials; `webcal:` links are fetched over HTTPS.
     */
    read(job: ActivityStream, done: PlatformCallback): void {
        const query = (job.object ?? {}) as QueryInput;
        this.feedUrl(job.target?.id ?? "")
            .then((url) => this.fetchFeed(url))
            .then(({ url, body }) => {
                let feed: ReturnType<typeof parseICalendarFeed>;
                try {
                    feed = parseICalendarFeed(body, url.href, query);
                } catch (error) {
                    throw new CalDavFailure("caldav:invalid-response", error);
                }
                if (feed.skipped)
                    this.log.warn(
                        `CalDAV read skipped ${feed.skipped} unsupported component(s) for actor ${job.actor.id}`,
                    );
                done(null, {
                    "@context": CONTEXT,
                    id: job.id ?? null,
                    type: "collection",
                    summary: feed.name ?? "iCalendar feed",
                    totalItems: feed.items.length,
                    items: feed.items,
                } as never);
            })
            .catch((error) => this.fail(job, error, done));
    }

    create(
        job: ActivityStream,
        credentials: CalDavCredentials,
        done: PlatformCallback,
    ): void {
        const client = this.client(credentials);
        const input = job.object as CalendarObjectInput;
        this.calendar(client, job.target?.id ?? "")
            .then(async (target) => {
                if (!target.components.includes(input.type)) {
                    throw new CalDavFailure("caldav:unsupported-component");
                }
                const calendarData = buildICalendar(input);
                const created = await client.create(
                    target,
                    calendarData.uid,
                    calendarData.body,
                );
                done(null, {
                    "@context": CONTEXT,
                    ...(job.id ? { id: job.id } : {}),
                    type: "create",
                    actor: job.actor,
                    target: job.target,
                    object: {
                        id: created.id,
                        type: input.type,
                        uid: calendarData.uid,
                        ...(created.etag ? { etag: created.etag } : {}),
                    },
                });
            })
            .catch((error) => this.fail(job, error, done))
            .finally(() => client.close().catch(() => {}));
    }

    query(
        job: ActivityStream,
        credentials: CalDavCredentials,
        done: PlatformCallback,
    ): void {
        const client = this.client(credentials);
        this.calendar(client, job.target?.id ?? "")
            .then((calendar) =>
                client.query(calendar, (job.object ?? {}) as QueryInput),
            )
            .then((items) =>
                done(null, {
                    "@context": CONTEXT,
                    ...(job.id ? { id: job.id } : {}),
                    type: "collection",
                    summary: "CalDAV items",
                    totalItems: items.length,
                    items,
                } as never),
            )
            .catch((error) => this.fail(job, error, done))
            .finally(() => client.close().catch(() => {}));
    }

    update(
        job: ActivityStream,
        credentials: CalDavCredentials,
        done: PlatformCallback,
    ): void {
        const client = this.client(credentials);
        const input = job.object as CalendarObjectInput;
        this.calendar(client, job.target?.id ?? "")
            .then((calendar) => {
                this.assertResource(calendar.id, input.id ?? "");
                const generated = buildICalendar(input);
                return client
                    .update(input.id ?? "", input.etag ?? "", generated.body)
                    .then((updated) => ({ updated, uid: generated.uid }));
            })
            .then(({ updated, uid }) =>
                done(
                    null,
                    this.mutationResponse(
                        job,
                        "update",
                        updated.id,
                        input.type,
                        uid,
                        updated.etag,
                    ),
                ),
            )
            .catch((error) => this.fail(job, error, done))
            .finally(() => client.close().catch(() => {}));
    }

    delete(
        job: ActivityStream,
        credentials: CalDavCredentials,
        done: PlatformCallback,
    ): void {
        const client = this.client(credentials);
        const input = job.object as DeleteInput;
        this.calendar(client, job.target?.id ?? "")
            .then((calendar) => {
                this.assertResource(calendar.id, input.id);
                return client.delete(input.id, input.etag);
            })
            .then(() =>
                done(
                    null,
                    this.mutationResponse(job, "delete", input.id, input.type),
                ),
            )
            .catch((error) => this.fail(job, error, done))
            .finally(() => client.close().catch(() => {}));
    }

    private client(credentials: CalDavCredentials): CalDavClient {
        const { url, ...authentication } = credentials.object;
        return new CalDavClient(
            url,
            authentication,
            this.config.connectTimeoutMs,
            {
                allowPrivateAddresses: this.config.allowPrivateAddresses,
                allowInsecureHttp: this.config.allowInsecureHttp,
            },
        );
    }

    /**
     * The SSRF-guarded dispatcher for feed reads, created once per instance
     * (its policy comes from packageConfig, fixed before the first job) so
     * connections are pooled across reads.
     */
    private dispatcher(): ReturnType<typeof createGuardedDispatcher> {
        if (!this.feedDispatcher)
            this.feedDispatcher = createGuardedDispatcher({
                allowPrivateAddresses: this.config.allowPrivateAddresses,
                maxResponseBytes: MAX_FEED_BYTES,
            });
        return this.feedDispatcher;
    }

    /** Fetch a feed and apply the HTTP policy to every redirect hop. */
    private async fetchFeed(start: URL): Promise<{ url: URL; body: string }> {
        let current = start;
        const timeoutMs = this.config.connectTimeoutMs;
        const signal =
            timeoutMs !== undefined && timeoutMs > 0
                ? AbortSignal.timeout(timeoutMs)
                : undefined;
        for (let hop = 0; hop <= MAX_FEED_REDIRECTS; hop += 1) {
            let response: Response;
            try {
                response = await fetch(current.href, {
                    dispatcher: this.dispatcher(),
                    redirect: "manual",
                    ...(signal ? { signal } : {}),
                    headers: { accept: "text/calendar, */*;q=0.1" },
                } as RequestInit);
            } catch (error) {
                throw new CalDavFailure("caldav:feed-failed", error);
            }
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get("location");
                await response.body?.cancel().catch(() => {});
                if (!location || hop === MAX_FEED_REDIRECTS)
                    throw new CalDavFailure("caldav:feed-failed");
                current = this.followFeedUrl(location, current);
                continue;
            }
            if (!response.ok) {
                await response.body?.cancel().catch(() => {});
                throw new CalDavFailure("caldav:feed-failed");
            }
            try {
                return { url: current, body: await response.text() };
            } catch (error) {
                throw new CalDavFailure("caldav:feed-failed", error);
            }
        }
        throw new CalDavFailure("caldav:feed-failed");
    }

    private followFeedUrl(location: string, current: URL): URL {
        let url: URL;
        try {
            url = new URL(location, current);
        } catch {
            throw new CalDavFailure("caldav:feed-failed");
        }
        if (url.protocol === "http:" && !this.config.allowInsecureHttp)
            throw new CalDavFailure("caldav:https-required");
        if (url.protocol !== "https:" && url.protocol !== "http:")
            throw new CalDavFailure("caldav:feed-failed");
        url.username = "";
        url.password = "";
        return url;
    }

    private async feedUrl(id: string): Promise<URL> {
        let url: URL;
        try {
            url = new URL(id.replace(/^webcal:/i, "https:"));
        } catch {
            throw new CalDavFailure("caldav:invalid-feed");
        }
        if (url.protocol === "http:" && !this.config.allowInsecureHttp)
            throw new CalDavFailure("caldav:https-required");
        if (url.protocol !== "https:" && url.protocol !== "http:")
            throw new CalDavFailure("caldav:invalid-feed");
        url.username = "";
        url.password = "";
        return url;
    }

    private async calendar(client: CalDavClient, id: string) {
        let normalized: string;
        try {
            normalized = new URL(id).href;
        } catch {
            throw new CalDavFailure("caldav:invalid-calendar");
        }
        const calendar = (await client.discoverCalendars()).find(
            (item) => item.id === normalized,
        );
        if (!calendar) throw new CalDavFailure("caldav:invalid-calendar");
        return calendar;
    }

    private assertResource(calendarId: string, resourceId: string): void {
        assertCalendarResource(calendarId, resourceId);
    }

    private mutationResponse(
        job: ActivityStream,
        type: "update" | "delete",
        id: string,
        objectType: "event" | "task",
        uid?: string,
        etag?: string,
    ): ActivityStream {
        return {
            "@context": CONTEXT,
            ...(job.id ? { id: job.id } : {}),
            type,
            actor: job.actor,
            target: job.target,
            object: {
                id,
                type: objectType,
                ...(uid ? { uid } : {}),
                ...(etag ? { etag } : {}),
            },
        } as ActivityStream;
    }

    private fail(
        job: ActivityStream,
        error: unknown,
        done: PlatformCallback,
    ): void {
        const code =
            error instanceof CalDavFailure
                ? error.code
                : `caldav:invalid-${job.type}: ${error instanceof Error ? error.message : String(error)}`;
        this.log.error(`CalDAV ${job.type} failed for actor ${job.actor.id}`, {
            code,
            ...(error instanceof Error && error.cause instanceof Error
                ? { cause: error.cause.message }
                : {}),
        });
        done(code);
    }
}

export { buildICalendar, foldLine } from "./ical.js";
export { PlatformCalDavSchema } from "./schema.js";
