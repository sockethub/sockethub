/**
 * Durable storage for scheduled Web Push deliveries.
 *
 * Everything else Sockethub keeps in Redis is tied to one server boot: key
 * names carry a random per-boot id and payloads are encrypted with per-boot
 * secrets, so nothing survives a restart. A scheduled delivery has to be
 * readable by whichever server is running when it comes due, so this store
 * uses fixed key names and a key derived from a configured secret.
 *
 * There is one record per subscription, holding its complete list of pending
 * messages, and one entry per subscription in a sorted set scored by when the
 * record next needs attention. The record is the source of truth. The sorted
 * set is only a wake-up call: a stale entry finds nothing due and is rescored
 * or removed.
 */
import {
    createCipheriv,
    createDecipheriv,
    createHmac,
    hkdfSync,
    randomBytes,
} from "node:crypto";
import IORedis, { type Redis } from "ioredis";
import type { RedisConfig } from "./types.js";

/**
 * Stable across boots, with no per-boot id, so the orphan sweep and the
 * shutdown purge (both scoped to a boot id) never match these keys. The hash
 * tag keeps both keys in one Redis Cluster slot, which the scripts need.
 */
const PREFIX = "sockethub:{scheduled}";
export const SCHEDULE_DUE_KEY = `${PREFIX}:due`;
export const scheduleRecordKey = (id: string) => `${PREFIX}:record:${id}`;

/** Kept past the last message's expiry, to allow for clock differences. */
const EXPIRY_GRACE_MS = 60_000;

export interface ScheduledMessage {
    /** When to send, in ms since the epoch. */
    deliverAt: number;
    /** The encrypted push message, base64. Opaque to Sockethub. */
    content: string;
    /** Seconds the message stays worth delivering after `deliverAt`. */
    ttl: number;
    urgency?: string;
    topic?: string;
    /** Set after a temporary failure: the earliest next attempt. */
    retryAt?: number;
    attempts?: number;
}

export interface ScheduleRecord {
    /** The subscription's delivery URL on the push service. */
    endpoint: string;
    messages: Array<ScheduledMessage>;
}

/** A record as read, with the stored bytes needed to write it back safely. */
export interface LoadedSchedule {
    record: ScheduleRecord;
    raw: string;
}

/**
 * What {@link ScheduleStore.loadOutcome} found. `unreadable` is distinct from
 * `missing` so a caller that just claimed the id can give the claim back
 * instead of holding it until the lease ends.
 */
export type ScheduleLoad =
    | { kind: "ready"; loaded: LoadedSchedule }
    | { kind: "missing" }
    | { kind: "unreadable" };

/** When a message is next due: its retry time if it has one. */
export const nextAttempt = (message: ScheduledMessage) =>
    message.retryAt ?? message.deliverAt;

// Claims up to ARGV[3] ids that are due and not listed in ARGV[4..], and
// pushes each claimed score forward by the lease. Ids this server already
// failed to decrypt are left for a server that can read them. A server that
// dies mid-send leaves an id to come due again when the lease ends.
const CLAIM_SCRIPT = `
local skip = {}
local window = tonumber(ARGV[3])
for i = 4, #ARGV do
    skip[ARGV[i]] = true
    window = window + 1
end
local ids = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, window)
local claimed = {}
local max = tonumber(ARGV[3])
for _, id in ipairs(ids) do
    if not skip[id] then
        redis.call('ZADD', KEYS[1], ARGV[2], id)
        table.insert(claimed, id)
        if #claimed >= max then
            break
        end
    end
end
return claimed`;

// Writes a record only if it is still the one that was read ('' for none).
// A worker and a client can both be changing a subscription at once: a
// client may replace its schedule while a send is in flight, and a send may
// finish while a client's new list is being worked out. Whoever wrote first
// wins, and the other reads again.
const SAVE_SCRIPT = `
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then
    return 0
end
if ARGV[2] == '' then
    redis.call('DEL', KEYS[1])
    redis.call('ZREM', KEYS[2], ARGV[3])
else
    redis.call('SET', KEYS[1], ARGV[2])
    redis.call('PEXPIREAT', KEYS[1], ARGV[4])
    redis.call('ZADD', KEYS[2], ARGV[5], ARGV[3])
end
return 1`;

// Drops a wake-up entry whose record has expired. Checked in Redis, so a
// schedule written in the meantime keeps the wake-up it just set.
const FORGET_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
    redis.call('ZREM', KEYS[2], ARGV[1])
end
return 1`;

// Gives back a claim this server cannot use. The score is moved only when it
// is still the lease this server took: a wake-up written since (a client
// syncing its list, or a server that can read the record) is left alone.
const RELEASE_CLAIM_SCRIPT = `
local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
if score and tonumber(score) == tonumber(ARGV[2]) then
    redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1])
end
return 1`;

/**
 * A dedicated connection for the schedule store. It retries forever with a
 * capped backoff: a scheduler that gave up after a Redis restart would stop
 * every reminder until the server itself was restarted.
 */
export function createScheduleRedisConnection(config: RedisConfig): Redis {
    return new IORedis(config.url, {
        connectionName: config.connectionName,
        enableOfflineQueue: false,
        maxRetriesPerRequest: config.maxRetriesPerRequest ?? null,
        connectTimeout: config.connectTimeout ?? 10000,
        disconnectTimeout: config.disconnectTimeout ?? 5000,
        lazyConnect: false,
        retryStrategy: (times: number) =>
            Math.min(2 ** Math.min(times - 1, 5) * 200, 5000),
    });
}

export class ScheduleStore {
    private readonly recordKey: Buffer;
    private readonly idKey: Buffer;

    /**
     * @param secret operator-configured, and the same on every server sharing
     * this Redis. Losing it is the same as losing the stored schedules.
     */
    constructor(
        private readonly redis: Redis,
        secret: string,
    ) {
        if (secret.length < 32) {
            throw new Error(
                "scheduled delivery secret must be at least 32 characters",
            );
        }
        const derive = (purpose: string) =>
            Buffer.from(
                hkdfSync(
                    "sha256",
                    secret,
                    "sockethub scheduled delivery",
                    purpose,
                    32,
                ),
            );
        this.recordKey = derive("record");
        this.idKey = derive("id");
    }

    /**
     * The key a subscription is stored under. Keyed, so a copy of Redis
     * cannot be searched for a known delivery URL.
     */
    idFor(endpoint: string): string {
        return createHmac("sha256", this.idKey).update(endpoint).digest("hex");
    }

    // AES-256-GCM, bound to the record's id so a stored value cannot be
    // copied under another subscription's key by someone with Redis access.
    private seal(id: string, record: ScheduleRecord): string {
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", this.recordKey, iv);
        cipher.setAAD(Buffer.from(id));
        const body = Buffer.concat([
            cipher.update(JSON.stringify(record)),
            cipher.final(),
        ]);
        return Buffer.concat([iv, cipher.getAuthTag(), body]).toString(
            "base64",
        );
    }

    private open(id: string, raw: string): ScheduleRecord {
        const bytes = Buffer.from(raw, "base64");
        const decipher = createDecipheriv(
            "aes-256-gcm",
            this.recordKey,
            bytes.subarray(0, 12),
        );
        decipher.setAAD(Buffer.from(id));
        decipher.setAuthTag(bytes.subarray(12, 28));
        return JSON.parse(
            Buffer.concat([
                decipher.update(bytes.subarray(28)),
                decipher.final(),
            ]).toString(),
        );
    }

    private static expiry(messages: Array<ScheduledMessage>): number {
        return (
            Math.max(...messages.map((m) => m.deliverAt + m.ttl * 1000)) +
            EXPIRY_GRACE_MS
        );
    }

    private static wakeAt(messages: Array<ScheduledMessage>): number {
        return Math.min(...messages.map(nextAttempt));
    }

    /** Number of subscriptions with a stored schedule. */
    count(): Promise<number> {
        return this.redis.zcard(SCHEDULE_DUE_KEY);
    }

    /**
     * The messages still pending for a subscription, with the stored bytes
     * to pass to {@link replace}. `raw` is null when there is no record.
     */
    async pending(
        endpoint: string,
    ): Promise<{ messages: Array<ScheduledMessage>; raw: string | null }> {
        const id = this.idFor(endpoint);
        const raw = await this.redis.get(scheduleRecordKey(id));
        if (raw === null) return { messages: [], raw };
        try {
            return { messages: this.open(id, raw).messages, raw };
        } catch {
            return { messages: [], raw };
        }
    }

    /**
     * Replace a subscription's whole list. An empty list removes it. The
     * record expires on its own once its last message is past delivery, so
     * an abandoned subscription cleans itself up. Returns false, and changes
     * nothing, when the record is no longer the one `expected` was read from.
     */
    async replace(
        endpoint: string,
        messages: Array<ScheduledMessage>,
        expected: string | null,
    ): Promise<boolean> {
        const id = this.idFor(endpoint);
        return this.write(
            id,
            expected ?? "",
            messages.length === 0 ? null : { endpoint, messages },
        );
    }

    private async write(
        id: string,
        expected: string,
        record: ScheduleRecord | null,
    ): Promise<boolean> {
        const args = record
            ? [
                  this.seal(id, record),
                  id,
                  ScheduleStore.expiry(record.messages),
                  ScheduleStore.wakeAt(record.messages),
              ]
            : ["", id, 0, 0];
        return (
            (await this.redis.eval(
                SAVE_SCRIPT,
                2,
                scheduleRecordKey(id),
                SCHEDULE_DUE_KEY,
                expected,
                ...args,
            )) === 1
        );
    }

    /**
     * Take up to `limit` subscriptions that need attention now. Each is held
     * for `leaseMs`, during which no other caller is given it.
     */
    async claimDue(
        now: number,
        leaseMs: number,
        limit: number,
        skip: Array<string> = [],
    ): Promise<Array<string>> {
        return (await this.redis.eval(
            CLAIM_SCRIPT,
            1,
            SCHEDULE_DUE_KEY,
            now,
            now + leaseMs,
            limit,
            ...skip,
        )) as Array<string>;
    }

    /**
     * Read a claimed record. Returns null when it has expired, which also
     * drops its wake-up entry, or when it cannot be read with the current
     * secret. An unreadable record is left alone until it expires: deleting
     * it would let one server started with a mistyped secret destroy every
     * schedule as it came due. The claim itself is not released here; the
     * caller uses {@link loadOutcome} and {@link releaseClaim} for that.
     */
    async load(id: string): Promise<LoadedSchedule | null> {
        const outcome = await this.loadOutcome(id);
        return outcome.kind === "ready" ? outcome.loaded : null;
    }

    /**
     * Read a claimed record, distinguishing a missing one from one this
     * server's secret cannot open. A missing record's wake-up entry is
     * dropped. An unreadable record is left stored until it expires.
     */
    async loadOutcome(id: string): Promise<ScheduleLoad> {
        const key = scheduleRecordKey(id);
        const raw = await this.redis.get(key);
        if (raw === null) {
            await this.redis.eval(FORGET_SCRIPT, 2, key, SCHEDULE_DUE_KEY, id);
            return { kind: "missing" };
        }
        try {
            return {
                kind: "ready",
                loaded: { record: this.open(id, raw), raw },
            };
        } catch {
            return { kind: "unreadable" };
        }
    }

    /**
     * Give back a claim of `id` whose score is still `leaseUntil`, making it
     * due at `dueAt`. A server that cannot decrypt a record calls this so a
     * server that can does not have to wait out the lease.
     */
    async releaseClaim(
        id: string,
        leaseUntil: number,
        dueAt: number,
    ): Promise<void> {
        await this.redis.eval(
            RELEASE_CLAIM_SCRIPT,
            1,
            SCHEDULE_DUE_KEY,
            id,
            leaseUntil,
            dueAt,
        );
    }

    /** Whether a record is still the one that was read. */
    async unchanged(id: string, loaded: LoadedSchedule): Promise<boolean> {
        return (await this.redis.get(scheduleRecordKey(id))) === loaded.raw;
    }

    /**
     * Write back what is left of a record after working on it, and set when
     * it is next due. An empty list removes the record. Returns false, and
     * changes nothing, when the record was replaced since it was read.
     */
    async save(
        id: string,
        loaded: LoadedSchedule,
        messages: Array<ScheduledMessage>,
    ): Promise<boolean> {
        return this.write(
            id,
            loaded.raw,
            messages.length === 0 ? null : { ...loaded.record, messages },
        );
    }
}
