import { describe, expect, it } from "bun:test";
import type {
    LoadedSchedule,
    ScheduledMessage,
    ScheduleStore,
} from "@sockethub/data-layer";
import type { ActivityStream } from "@sockethub/schemas";
import {
    createQueueDeliver,
    type DeliveryOutcome,
    ScheduledDelivery,
    type ScheduledDeliveryLimits,
} from "./scheduled-delivery.js";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const NOW = Date.parse("2026-11-20T08:00:00Z");
const ENDPOINT = "https://web.push.apple.com/secret-subscription";
const CONTEXT = [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/webpush/v1.jsonld",
];
const limits: ScheduledDeliveryLimits = {
    maxMessagesPerSubscription: 3,
    maxSubscriptions: 2,
    maxDaysAhead: 30,
    maxSchedulesPerMinute: 0,
};

/** The store's contract, in memory: one list and one wake-up per endpoint. */
class MemoryStore {
    records = new Map<string, Array<ScheduledMessage>>();
    due = new Map<string, number>();

    async count() {
        return this.due.size;
    }
    writes = 0;
    private raw(endpoint: string) {
        const messages = this.records.get(endpoint);
        return messages ? JSON.stringify(messages) : null;
    }
    async pending(endpoint: string) {
        return {
            messages: this.records.get(endpoint) ?? [],
            raw: this.raw(endpoint),
        };
    }
    async replace(
        endpoint: string,
        messages: Array<ScheduledMessage>,
        expected: string | null,
    ) {
        if (this.raw(endpoint) !== expected) return false;
        this.writes += 1;
        if (messages.length === 0) {
            this.records.delete(endpoint);
            this.due.delete(endpoint);
            return true;
        }
        this.records.set(endpoint, messages);
        this.due.set(
            endpoint,
            Math.min(...messages.map((m) => m.retryAt ?? m.deliverAt)),
        );
        return true;
    }
    async claimDue(now: number, leaseMs: number, limit: number) {
        const ids = [...this.due]
            .filter(([, at]) => at <= now)
            .slice(0, limit)
            .map(([id]) => id);
        for (const id of ids) this.due.set(id, now + leaseMs);
        return ids;
    }
    async load(id: string): Promise<LoadedSchedule | null> {
        const messages = this.records.get(id);
        if (!messages) {
            this.due.delete(id);
            return null;
        }
        return {
            record: { endpoint: id, messages },
            raw: JSON.stringify(messages),
        };
    }
    async unchanged(id: string, loaded: LoadedSchedule) {
        return JSON.stringify(this.records.get(id)) === loaded.raw;
    }
    async save(
        id: string,
        _loaded: LoadedSchedule,
        messages: Array<ScheduledMessage>,
    ) {
        return this.replace(id, messages, _loaded.raw);
    }
}

function setup(
    outcomes: Array<DeliveryOutcome> = [],
    overrides: Partial<ScheduledDeliveryLimits> = {},
) {
    const store = new MemoryStore();
    const clock = { now: NOW };
    const sent: Array<{ endpoint: string; content: string; ttl: number }> = [];
    const scheduler = new ScheduledDelivery(
        store as unknown as ScheduleStore,
        async (endpoint, message, ttl) => {
            sent.push({ endpoint, content: message.content, ttl });
            return outcomes.shift() ?? { status: "accepted" };
        },
        { ...limits, ...overrides },
        () => clock.now,
    );
    return { store, clock, sent, scheduler };
}

const schedule = (
    items: Array<Record<string, unknown>>,
    endpoint = ENDPOINT,
): ActivityStream =>
    ({
        "@context": CONTEXT,
        type: "schedule",
        id: "req-1",
        actor: { id: "https://app.example", type: "website" },
        target: { id: endpoint, type: "service" },
        object: { type: "schedule", items },
    }) as ActivityStream;

const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
/** A moment after NOW: a schedule only takes messages that are still ahead. */
const DUE = 1000;

describe("ScheduledDelivery.schedule", () => {
    it("stores the list and acknowledges without the delivery URL", async () => {
        const { store, scheduler } = setup();
        const ack = await scheduler.schedule(
            schedule([
                { deliverAt: at(HOUR), content: "AAAA", ttl: 600 },
                { deliverAt: at(2 * HOUR), content: "BBBB", topic: "daily" },
            ]),
        );

        expect(ack).toEqual({
            "@context": CONTEXT,
            type: "schedule",
            id: "req-1",
            actor: { id: "https://app.example", type: "website" },
            object: { type: "schedule", pending: 2 },
        } as unknown as ActivityStream);
        expect(JSON.stringify(ack)).not.toContain("secret-subscription");
        expect(store.records.get(ENDPOINT)).toEqual([
            { deliverAt: NOW + HOUR, content: "AAAA", ttl: 600 },
            // ttl defaults to a day
            {
                deliverAt: NOW + 2 * HOUR,
                content: "BBBB",
                ttl: 86400,
                topic: "daily",
            },
        ]);
    });

    it("replaces an earlier list, and an empty list cancels", async () => {
        const { store, scheduler } = setup();
        await scheduler.schedule(
            schedule([{ deliverAt: at(HOUR), content: "AAAA" }]),
        );
        await scheduler.schedule(
            schedule([{ deliverAt: at(3 * HOUR), content: "CCCC" }]),
        );
        expect(store.records.get(ENDPOINT)?.map((m) => m.content)).toEqual([
            "CCCC",
        ]);

        const ack = await scheduler.schedule(schedule([]));
        expect((ack.object as { pending: number }).pending).toBe(0);
        expect(store.records.size).toBe(0);
        expect(store.due.size).toBe(0);
    });

    it("leaves out messages whose time has passed, so a list can be sent again", async () => {
        const { store, clock, sent, scheduler } = setup();
        const list = schedule([
            { deliverAt: at(MINUTE), content: "FIRST", ttl: 3600 },
            { deliverAt: at(HOUR), content: "SECOND", ttl: 3600 },
        ]);
        await scheduler.schedule(list);
        clock.now = NOW + MINUTE;
        await scheduler.tick();
        expect(sent.map((s) => s.content)).toEqual(["FIRST"]);

        // The app opens five minutes later and syncs the same list. FIRST
        // is still within its ttl, and must not go out a second time.
        clock.now = NOW + 5 * MINUTE;
        const ack = await scheduler.schedule(list);
        expect((ack.object as { pending: number }).pending).toBe(1);
        await scheduler.tick();
        expect(sent.map((s) => s.content)).toEqual(["FIRST"]);
        expect(store.records.get(ENDPOINT)?.map((m) => m.content)).toEqual([
            "SECOND",
        ]);
    });

    it("keeps a due message that is still waiting when the list is sent again", async () => {
        const { store, clock, sent, scheduler } = setup([{ status: "retry" }]);
        const list = schedule([
            { deliverAt: at(MINUTE), content: "FIRST", ttl: 3600 },
        ]);
        await scheduler.schedule(list);
        clock.now = NOW + MINUTE;
        await scheduler.tick();
        const retrying = store.records.get(ENDPOINT)?.[0];
        expect(retrying).toMatchObject({ attempts: 1 });

        // The push service is down and the message is being retried. The
        // same list arriving again must neither cancel it nor restart it.
        clock.now = NOW + MINUTE + 10 * 1000;
        const ack = await scheduler.schedule(list);
        expect((ack.object as { pending: number }).pending).toBe(1);
        expect(store.records.get(ENDPOINT)).toEqual([
            retrying as ScheduledMessage,
        ]);
        await scheduler.tick();
        expect(sent).toHaveLength(1);

        clock.now = NOW + 2 * MINUTE;
        await scheduler.tick();
        expect(sent).toHaveLength(2);
        expect(store.records.size).toBe(0);
    });

    it("writes nothing when the same list arrives again", async () => {
        const { store, scheduler } = setup();
        const list = schedule([
            { deliverAt: at(HOUR), content: "AAAA", topic: "daily" },
        ]);
        await scheduler.schedule(list);
        expect(store.writes).toBe(1);
        const ack = await scheduler.schedule(list);
        expect((ack.object as { pending: number }).pending).toBe(1);
        // A write would reset the claim of a send in progress.
        expect(store.writes).toBe(1);
    });

    it("does not bring back a message delivered while the list was being saved", async () => {
        const { store, clock, scheduler } = setup();
        const list = schedule([
            { deliverAt: at(MINUTE), content: "FIRST" },
            { deliverAt: at(HOUR), content: "SECOND" },
            { deliverAt: at(2 * HOUR), content: "THIRD" },
        ]);
        await scheduler.schedule(list);
        clock.now = NOW + MINUTE;

        // A worker finishes sending FIRST between this request reading the
        // record and writing it.
        const pending = store.pending.bind(store);
        let raced = false;
        store.pending = async (endpoint: string) => {
            const snapshot = await pending(endpoint);
            if (!raced) {
                raced = true;
                store.records.set(
                    endpoint,
                    snapshot.messages.filter((m) => m.content !== "FIRST"),
                );
            }
            return snapshot;
        };
        // The same list minus its last item, so there is something to write.
        const ack = await scheduler.schedule(
            schedule([
                { deliverAt: at(MINUTE), content: "FIRST" },
                { deliverAt: at(HOUR), content: "SECOND" },
            ]),
        );

        expect((ack.object as { pending: number }).pending).toBe(1);
        expect(store.records.get(ENDPOINT)?.map((m) => m.content)).toEqual([
            "SECOND",
        ]);
    });

    it("enforces the per-subscription, look-ahead and server-wide limits", async () => {
        const { store, scheduler } = setup();
        const item = (ms: number) => ({ deliverAt: at(ms), content: "AAAA" });

        await expect(
            scheduler.schedule(schedule([1, 2, 3, 4].map((n) => item(n * HOUR)))),
        ).rejects.toThrow(/at most 3 messages/);
        await expect(
            scheduler.schedule(schedule([item(31 * 24 * HOUR)])),
        ).rejects.toThrow(/at most 30 days ahead/);
        expect(store.records.size).toBe(0);

        await scheduler.schedule(schedule([item(HOUR)], `${ENDPOINT}-1`));
        await scheduler.schedule(schedule([item(HOUR)], `${ENDPOINT}-2`));
        await expect(
            scheduler.schedule(schedule([item(HOUR)], `${ENDPOINT}-3`)),
        ).rejects.toThrow(/not accepting new schedules/);
        // A subscription that already has a schedule can still change it,
        // and anyone can still cancel.
        await scheduler.schedule(schedule([item(2 * HOUR)], `${ENDPOINT}-1`));
        await scheduler.schedule(schedule([], `${ENDPOINT}-3`));
    });

    it("limits schedule requests per client address", async () => {
        const { clock, scheduler } = setup([], { maxSchedulesPerMinute: 2 });
        const msg = schedule([]);
        await scheduler.schedule(msg, "203.0.113.1");
        await scheduler.schedule(msg, "203.0.113.1");
        await expect(scheduler.schedule(msg, "203.0.113.1")).rejects.toThrow(
            /too many schedule requests/,
        );
        await scheduler.schedule(msg, "203.0.113.2");
        clock.now += MINUTE;
        await scheduler.schedule(msg, "203.0.113.1");
    });
});

describe("ScheduledDelivery.tick", () => {
    it("sends what is due and leaves the rest for later", async () => {
        const { store, clock, sent, scheduler } = setup();
        await scheduler.schedule(
            schedule([
                { deliverAt: at(MINUTE), content: "AAAA", ttl: 600 },
                { deliverAt: at(HOUR), content: "BBBB", ttl: 600 },
            ]),
        );

        await scheduler.tick();
        expect(sent).toHaveLength(0);

        clock.now = NOW + MINUTE + 5000;
        await scheduler.tick();
        expect(sent).toEqual([
            // The push service is given what is left of the ttl.
            { endpoint: ENDPOINT, content: "AAAA", ttl: 595 },
        ]);
        expect(store.records.get(ENDPOINT)?.map((m) => m.content)).toEqual([
            "BBBB",
        ]);
        expect(store.due.get(ENDPOINT)).toBe(NOW + HOUR);

        clock.now = NOW + HOUR;
        await scheduler.tick();
        expect(sent).toHaveLength(2);
        expect(store.records.size).toBe(0);
        expect(store.due.size).toBe(0);
    });

    it("skips a message that is more than its ttl late", async () => {
        const { store, clock, sent, scheduler } = setup();
        await scheduler.schedule(
            schedule([
                { deliverAt: at(MINUTE), content: "STALE", ttl: 600 },
                { deliverAt: at(2 * MINUTE), content: "FRESH", ttl: 7200 },
            ]),
        );
        // As after an hour of downtime.
        clock.now = NOW + HOUR;
        await scheduler.tick();
        expect(sent.map((s) => s.content)).toEqual(["FRESH"]);
        expect(store.records.size).toBe(0);
    });

    it("does not stretch a short ttl", async () => {
        const { clock, sent, scheduler } = setup();
        await scheduler.schedule(
            schedule([{ deliverAt: at(MINUTE), content: "AAAA", ttl: 30 }]),
        );
        clock.now = NOW + MINUTE + 45 * 1000;
        await scheduler.tick();
        expect(sent).toHaveLength(0);
    });

    it("still sends a message with a ttl of zero", async () => {
        const { clock, sent, scheduler } = setup();
        await scheduler.schedule(
            schedule([{ deliverAt: at(MINUTE), content: "AAAA", ttl: 0 }]),
        );
        clock.now = NOW + MINUTE + 5000;
        await scheduler.tick();
        expect(sent).toEqual([{ endpoint: ENDPOINT, content: "AAAA", ttl: 0 }]);
    });

    it("retries a temporary failure with backoff until the ttl runs out", async () => {
        const { store, clock, sent, scheduler } = setup([
            { status: "retry" },
            { status: "retry", retryAfter: 600 },
            { status: "retry" },
        ]);
        await scheduler.schedule(
            schedule([{ deliverAt: at(DUE), content: "AAAA", ttl: 1800 }]),
        );

        clock.now = NOW + DUE;
        await scheduler.tick();
        expect(store.records.get(ENDPOINT)?.[0]).toMatchObject({
            attempts: 1,
            retryAt: NOW + DUE + MINUTE,
        });
        // Not due again until the retry time.
        clock.now = NOW + DUE + 30 * 1000;
        await scheduler.tick();
        expect(sent).toHaveLength(1);

        // The push service's Retry-After wins over a shorter backoff.
        clock.now = NOW + DUE + MINUTE;
        await scheduler.tick();
        expect(store.records.get(ENDPOINT)?.[0]).toMatchObject({
            attempts: 2,
            retryAt: NOW + DUE + 11 * MINUTE,
        });

        // The next retry would land after the ttl, so the message is dropped.
        clock.now = NOW + DUE + 28 * MINUTE;
        await scheduler.tick();
        expect(sent).toHaveLength(3);
        expect(store.records.size).toBe(0);
    });

    it("drops a refused message but keeps the rest of the list", async () => {
        const { store, clock, sent, scheduler } = setup([
            { status: "rejected" },
        ]);
        await scheduler.schedule(
            schedule([
                { deliverAt: at(DUE), content: "BAD" },
                { deliverAt: at(HOUR), content: "LATER" },
            ]),
        );
        clock.now = NOW + DUE;
        await scheduler.tick();
        expect(sent).toHaveLength(1);
        expect(store.records.get(ENDPOINT)?.map((m) => m.content)).toEqual([
            "LATER",
        ]);
    });

    it("removes the whole schedule when the subscription is gone", async () => {
        const { store, clock, sent, scheduler } = setup([{ status: "gone" }]);
        await scheduler.schedule(
            schedule([
                { deliverAt: at(DUE), content: "AAAA" },
                { deliverAt: at(DUE), content: "BBBB" },
                { deliverAt: at(HOUR), content: "CCCC" },
            ]),
        );
        clock.now = NOW + DUE;
        await scheduler.tick();
        expect(sent).toHaveLength(1);
        expect(store.records.size).toBe(0);
        expect(store.due.size).toBe(0);
    });

    it("stops when the list is replaced or cancelled during a send", async () => {
        const store = new MemoryStore();
        const clock = { now: NOW };
        const sent: Array<string> = [];
        const scheduler: ScheduledDelivery = new ScheduledDelivery(
            store as unknown as ScheduleStore,
            async (_endpoint, message) => {
                sent.push(message.content);
                // The app syncs a new list while this send is in flight.
                await scheduler.schedule(
                    schedule([{ deliverAt: at(HOUR), content: "NEW" }]),
                );
                return { status: "accepted" };
            },
            limits,
            () => clock.now,
        );
        await scheduler.schedule(
            schedule([
                { deliverAt: at(DUE), content: "OLD-1" },
                { deliverAt: at(DUE), content: "OLD-2" },
            ]),
        );
        clock.now = NOW + DUE;
        await scheduler.tick();

        expect(sent).toEqual(["OLD-1"]);
        expect(store.records.get(ENDPOINT)?.map((m) => m.content)).toEqual([
            "NEW",
        ]);
        expect(store.due.get(ENDPOINT)).toBe(NOW + HOUR);
    });

    it("starts no further send once it has been stopped", async () => {
        const store = new MemoryStore();
        const clock = { now: NOW };
        const sent: Array<string> = [];
        const scheduler: ScheduledDelivery = new ScheduledDelivery(
            store as unknown as ScheduleStore,
            async (_endpoint, message) => {
                sent.push(message.content);
                await scheduler.stop();
                return { status: "accepted" };
            },
            limits,
            () => clock.now,
        );
        await scheduler.schedule(
            schedule([
                { deliverAt: at(DUE), content: "ONE" },
                { deliverAt: at(DUE), content: "TWO" },
            ]),
        );
        clock.now = NOW + DUE;
        await scheduler.tick();

        expect(sent).toEqual(["ONE"]);
        // Kept for the next server run.
        expect(store.records.get(ENDPOINT)?.map((m) => m.content)).toEqual([
            "TWO",
        ]);
    });

    it("forgets a wake-up whose record has expired", async () => {
        const { store, sent, scheduler } = setup();
        store.due.set(ENDPOINT, NOW - 1);
        await scheduler.tick();
        expect(sent).toHaveLength(0);
        expect(store.due.size).toBe(0);
    });
});

describe("createQueueDeliver", () => {
    const message: ScheduledMessage = {
        deliverAt: NOW,
        content: "AAAA",
        ttl: 600,
        topic: "daily",
    };
    type Callback = (result?: ActivityStream | Error) => void;

    function deliverWith(answer: (callback: Callback) => void, timeoutMs = 50) {
        const submitted: Array<ActivityStream> = [];
        const deliver = createQueueDeliver(
            {
                message: (msg, callback) => {
                    submitted.push(msg);
                    answer(callback as Callback);
                },
            },
            "https://sockethub.org/ns/context/platform/webpush/v1.jsonld",
            timeoutMs,
        );
        return { submitted, result: deliver(ENDPOINT, message, 120) };
    }

    it("submits an ordinary send and returns the platform's answer", async () => {
        const { submitted, result } = deliverWith((callback) =>
            callback({
                type: "send",
                object: { type: "delivery", status: "retry", retryAfter: 30 },
            } as unknown as ActivityStream),
        );
        expect(await result).toEqual({ status: "retry", retryAfter: 30 });
        expect(submitted[0]).toMatchObject({
            "@context": CONTEXT,
            type: "send",
            target: { id: ENDPOINT, type: "service" },
            object: { type: "push", content: "AAAA", ttl: 120, topic: "daily" },
        });
    });

    it("treats a failed job or a silent platform as a temporary failure", async () => {
        const failed = deliverWith((callback) =>
            callback({
                type: "send",
                error: "Error: webpush: vapid keys are not configured",
            } as unknown as ActivityStream),
        );
        expect(await failed.result).toEqual({ status: "retry" });

        const thrown = deliverWith((callback) => callback(new Error("boom")));
        expect(await thrown.result).toEqual({ status: "retry" });

        const silent = deliverWith(() => {}, 10);
        expect(await silent.result).toEqual({ status: "retry" });
    });
});
