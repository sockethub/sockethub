/**
 * Scheduled Web Push delivery.
 *
 * A web app with no backend cannot notify its user while it is closed: on
 * iOS nothing can be scheduled on the device, so a server has to send the
 * push at the right time. The app hands over its future notifications,
 * already encrypted, and this module sends each one when it is due, with no
 * client connected and across server restarts.
 *
 * The `schedule` action is handled here, in the server, because a platform
 * child has neither the durable store nor its key. A due message is then
 * submitted to the `webpush` platform as an ordinary `send`, so platform
 * isolation and the per-boot queue encryption stay as they are.
 */
import {
    nextAttempt,
    type ScheduledMessage,
    type ScheduleStore,
} from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import {
    type ActivityStream,
    buildCanonicalContext,
    type InternalActivityStream,
} from "@sockethub/schemas";
import { errorMessage } from "@sockethub/util/error";
import type { MessageHandlers } from "./message-handlers.js";

const log = createLogger("server:scheduled-delivery");

/** The platform and action this module serves. */
export const WEBPUSH_PLATFORM_ID = "webpush";
export const SCHEDULE_ACTION = "schedule";

const POLL_INTERVAL_MS = 5000;
/** How long one server holds a subscription before another may take it. */
const LEASE_MS = 2 * 60 * 1000;
/** Subscriptions worked on at once. */
const BATCH_SIZE = 20;
/** Give up waiting for the platform; the message is retried. */
const DELIVER_TIMEOUT_MS = 60 * 1000;
/**
 * How late a message with a `ttl` of 0 may still be sent. Taken literally it
 * could never be delivered: the poll that finds a message is always a little
 * after `deliverAt`.
 */
const ZERO_TTL_LATE_SECONDS = 60;
/** How long shutdown waits for a send that is already in flight. */
const STOP_WAIT_MS = 5000;
const FIRST_RETRY_MS = 60 * 1000;
const MAX_RETRY_MS = 60 * 60 * 1000;

export interface DeliveryOutcome {
    status: "accepted" | "gone" | "retry" | "rejected";
    /** Seconds the push service asked us to wait before retrying. */
    retryAfter?: number;
}

/** Send one message now, with `ttl` seconds left for the push service. */
export type DeliverFn = (
    endpoint: string,
    message: ScheduledMessage,
    ttl: number,
) => Promise<DeliveryOutcome>;

export interface ScheduledDeliveryLimits {
    maxMessagesPerSubscription: number;
    maxSubscriptions: number;
    maxDaysAhead: number;
    /** Per client address. 0 turns the limit off. */
    maxSchedulesPerMinute: number;
}

/** How often `schedule` re-reads a record that changed under it. */
const SCHEDULE_WRITE_ATTEMPTS = 3;

type ScheduleItem = {
    deliverAt: string;
    content: string;
    ttl?: number;
    urgency?: string;
    topic?: string;
};

/** Matches the `webpush` platform's default when a message sets no `ttl`. */
const DEFAULT_TTL_SECONDS = 86400;

/**
 * Submit a due message to the `webpush` platform through the normal handler
 * chain, and report what the push service answered. Anything other than a
 * delivery result (a failed job, a platform that never answers) counts as a
 * temporary failure.
 */
export function createQueueDeliver(
    handlers: Pick<MessageHandlers, "message">,
    contextUrl: string,
    timeoutMs = DELIVER_TIMEOUT_MS,
): DeliverFn {
    return (endpoint, message, ttl) =>
        new Promise((resolve) => {
            const timer = setTimeout(() => {
                log.warn("webpush platform did not answer a scheduled send");
                resolve({ status: "retry" });
            }, timeoutMs);
            handlers.message(
                {
                    "@context": buildCanonicalContext(contextUrl),
                    type: "send",
                    actor: { id: "sockethub", type: "service" },
                    target: { id: endpoint, type: "service" },
                    object: {
                        type: "push",
                        content: message.content,
                        ttl,
                        ...(message.urgency
                            ? { urgency: message.urgency }
                            : {}),
                        ...(message.topic ? { topic: message.topic } : {}),
                    },
                } as InternalActivityStream,
                (result) => {
                    clearTimeout(timer);
                    const object =
                        result && !(result instanceof Error)
                            ? (result.object as
                                  | { status?: string; retryAfter?: number }
                                  | undefined)
                            : undefined;
                    if (
                        !object ||
                        !["accepted", "gone", "retry", "rejected"].includes(
                            String(object.status),
                        )
                    ) {
                        const reason =
                            result instanceof Error
                                ? result.message
                                : String(result?.error ?? "no result");
                        log.warn(`scheduled send failed: ${reason}`);
                        resolve({ status: "retry" });
                        return;
                    }
                    resolve({
                        status: object.status as DeliveryOutcome["status"],
                        retryAfter: object.retryAfter,
                    });
                },
            );
        });
}

/**
 * The list to store for a `schedule` request. Sending the same list again
 * must change nothing, so a message whose time has passed is kept only if it
 * is still pending, and then exactly as stored, retry state included. One
 * that has been dealt with is not sent a second time.
 */
function merge(
    wanted: Array<ScheduledMessage>,
    pending: Array<ScheduledMessage>,
    now: number,
): Array<ScheduledMessage> {
    const waiting = [...pending];
    const messages: Array<ScheduledMessage> = [];
    for (const message of wanted) {
        if (message.deliverAt > now) {
            messages.push(message);
            continue;
        }
        const index = waiting.findIndex(
            (stored) =>
                stored.deliverAt === message.deliverAt &&
                stored.content === message.content &&
                stored.ttl === message.ttl &&
                stored.urgency === message.urgency &&
                stored.topic === message.topic,
        );
        // Each stored message answers for one submitted item.
        if (index >= 0) messages.push(...waiting.splice(index, 1));
    }
    return messages;
}

export class ScheduledDelivery {
    private timer?: ReturnType<typeof setTimeout>;
    private inFlight: Promise<void> = Promise.resolve();
    private stopped = false;
    /** `schedule` calls per client address in the current minute. */
    private readonly calls = new Map<
        string,
        { start: number; count: number }
    >();

    constructor(
        private readonly store: ScheduleStore,
        private readonly deliver: DeliverFn,
        private readonly limits: ScheduledDeliveryLimits,
        private readonly now: () => number = Date.now,
        private readonly pollIntervalMs = POLL_INTERVAL_MS,
    ) {}

    /**
     * Start polling for due messages. The first poll runs at once, so
     * anything that came due while the server was down goes out on boot.
     */
    start(): void {
        const poll = () => {
            if (this.stopped) return;
            this.inFlight = this.tick()
                .catch((err: unknown) => {
                    // Redis being down is the usual cause; the connection
                    // retries on its own and the next poll picks up.
                    log.warn(
                        `scheduled delivery poll failed: ${errorMessage(err)}`,
                    );
                })
                .then(() => {
                    if (this.stopped) return;
                    this.timer = setTimeout(poll, this.pollIntervalMs);
                    this.timer.unref?.();
                });
        };
        poll();
    }

    /**
     * Stop polling. No further send is started; one already in flight gets a
     * few seconds to finish. Whatever is cut short is still claimed, and is
     * sent by the next server run when the claim lapses.
     */
    async stop(): Promise<void> {
        this.stopped = true;
        clearTimeout(this.timer);
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
            this.inFlight,
            new Promise((resolve) => {
                timer = setTimeout(resolve, STOP_WAIT_MS);
            }),
        ]);
        clearTimeout(timer);
    }

    private overRate(clientIp: string | undefined): boolean {
        const max = this.limits.maxSchedulesPerMinute;
        if (max <= 0) return false;
        const now = this.now();
        // Bounded: entries older than the window are dropped once the map
        // grows, so a spread of addresses cannot hold memory for long.
        if (this.calls.size > 10000) {
            for (const [key, entry] of this.calls) {
                if (now - entry.start >= 60000) this.calls.delete(key);
            }
        }
        const key = clientIp ?? "";
        const entry = this.calls.get(key);
        if (!entry || now - entry.start >= 60000) {
            this.calls.set(key, { start: now, count: 1 });
            return false;
        }
        entry.count += 1;
        return entry.count > max;
    }

    /**
     * Handle a validated `schedule` message: replace the subscription's list
     * with the one given. An empty list cancels. Knowing the delivery URL is
     * the only authorization, as it is for the push service itself.
     */
    async schedule(
        msg: ActivityStream,
        clientIp?: string,
    ): Promise<ActivityStream> {
        if (this.overRate(clientIp)) {
            throw new Error(
                "too many schedule requests; try again in a minute",
            );
        }
        // The URL as it will be requested, so one subscription written two
        // ways (a default port, a fragment) is not stored as two.
        const url = new URL(String(msg.target?.id));
        url.hash = "";
        const endpoint = url.href;
        const items = (msg.object as { items: Array<ScheduleItem> }).items;
        if (items.length > this.limits.maxMessagesPerSubscription) {
            throw new Error(
                `a schedule may hold at most ${this.limits.maxMessagesPerSubscription} messages`,
            );
        }
        const now = this.now();
        const latest = now + this.limits.maxDaysAhead * 24 * 60 * 60 * 1000;
        const wanted = items.map((item): ScheduledMessage => {
            const deliverAt = Date.parse(item.deliverAt);
            if (!Number.isFinite(deliverAt) || deliverAt > latest) {
                throw new Error(
                    `deliverAt may be at most ${this.limits.maxDaysAhead} days ahead`,
                );
            }
            return {
                deliverAt,
                content: item.content,
                ttl: item.ttl ?? DEFAULT_TTL_SECONDS,
                ...(item.urgency ? { urgency: item.urgency } : {}),
                ...(item.topic ? { topic: item.topic } : {}),
            };
        });
        // The delivery URL is left out: results may be cached for replay.
        const ack = (pending: number) => {
            const result = {
                "@context": msg["@context"],
                type: SCHEDULE_ACTION,
                actor: msg.actor,
                object: { type: "schedule", pending },
            } as ActivityStream;
            if (msg.id) result.id = msg.id;
            return result;
        };
        // A send can finish while the new list is being worked out. The
        // write only goes through if the record is still the one read here;
        // otherwise read it again.
        for (let attempt = 0; attempt < SCHEDULE_WRITE_ATTEMPTS; attempt++) {
            const current = await this.store.pending(endpoint);
            // The time after the read: on a second attempt a message may
            // have come due, and been sent, since the request arrived.
            const messages = merge(wanted, current.messages, this.now());
            if (JSON.stringify(messages) === JSON.stringify(current.messages)) {
                // The same list again. Nothing is written, so a send in
                // progress keeps its claim.
                return ack(messages.length);
            }
            // A delivery URL cannot be checked until something is sent to
            // it, so made-up ones can be stored. The cap bounds what they
            // can take up.
            if (
                messages.length > 0 &&
                current.raw === null &&
                (await this.store.count()) >= this.limits.maxSubscriptions
            ) {
                throw new Error("this server is not accepting new schedules");
            }
            if (await this.store.replace(endpoint, messages, current.raw)) {
                return ack(messages.length);
            }
        }
        throw new Error("the schedule is being changed; try again");
    }

    /** Send everything that is due now. Runs on a timer; public for tests. */
    async tick(): Promise<void> {
        while (!this.stopped) {
            const ids = await this.store.claimDue(
                this.now(),
                LEASE_MS,
                BATCH_SIZE,
            );
            await Promise.all(
                ids.map((id) =>
                    this.process(id).catch((err: unknown) => {
                        // Left claimed: it comes due again when the lease ends.
                        log.warn(
                            `scheduled delivery ${id.slice(0, 8)} failed: ${errorMessage(err)}`,
                        );
                    }),
                ),
            );
            if (ids.length < BATCH_SIZE) return;
        }
    }

    private async process(id: string): Promise<void> {
        const loaded = await this.store.load(id);
        if (!loaded) return;
        const started = this.now();
        const remaining: Array<ScheduledMessage> = [];
        for (const message of loaded.record.messages) {
            if (nextAttempt(message) > this.now()) {
                remaining.push(message);
                continue;
            }
            if (!(await this.store.unchanged(id, loaded))) {
                // The app replaced or cancelled this list while an earlier
                // message was being sent. The new list has its own wake-up.
                return;
            }
            // Everything below is decided on the time after that read, as
            // close to the send as this process gets.
            const now = this.now();
            const window =
                message.ttl > 0 ? message.ttl : ZERO_TTL_LATE_SECONDS;
            const expires = message.deliverAt + window * 1000;
            if (now > expires) {
                // Too late to be worth showing, e.g. after a long outage.
                continue;
            }
            if (this.stopped || now - started > LEASE_MS / 2) {
                // Shutting down, or close to the end of the claim: leave
                // the rest for the next poll, which claims it afresh.
                remaining.push(message);
                continue;
            }
            const late = Math.max(
                0,
                Math.floor((now - message.deliverAt) / 1000),
            );
            const outcome = await this.deliver(
                loaded.record.endpoint,
                message,
                // The push service gets only what is left of the ttl, or a
                // late message could be held for up to twice as long.
                Math.max(0, message.ttl - late),
            );
            if (outcome.status === "gone") {
                // The subscription no longer exists; nothing can reach it.
                await this.store.save(id, loaded, []);
                log.debug(
                    `subscription ${id.slice(0, 8)} is gone; schedule removed`,
                );
                return;
            }
            if (outcome.status !== "retry") {
                // Sent, or refused for good. Either way it is finished.
                continue;
            }
            const attempts = (message.attempts ?? 0) + 1;
            const retryAt =
                this.now() +
                Math.max(
                    (outcome.retryAfter ?? 0) * 1000,
                    Math.min(
                        FIRST_RETRY_MS * 2 ** (attempts - 1),
                        MAX_RETRY_MS,
                    ),
                );
            if (retryAt <= expires) {
                remaining.push({ ...message, attempts, retryAt });
            }
        }
        await this.store.save(id, loaded, remaining);
    }
}
