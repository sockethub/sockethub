import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import {
    buildAliveKey,
    KNOWN_SERVERS_KEY,
    purgeCredentialsStoreKeys,
    SCHEDULE_DUE_KEY,
    type ScheduledMessage,
    ScheduleStore,
    scheduleRecordKey,
    sweepOrphanedQueues,
} from "@sockethub/data-layer";
import Redis from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
// Its own database: these tests clear the whole schedule namespace, and that
// must never be a namespace a real server is using.
const REDIS_URL = `redis://${REDIS_HOST}:6379/15`;

const SECRET = "integration-test-secret-0123456789abcdef";
const HOUR = 60 * 60 * 1000;
const NOW = Date.now();
const ENDPOINT = "https://web.push.apple.com/integration-secret-path";

const message = (
    offsetMs: number,
    extra: Partial<ScheduledMessage> = {},
): ScheduledMessage => ({
    deliverAt: NOW + offsetMs,
    content: "AAAA",
    ttl: 3600,
    ...extra,
});

describe("ScheduleStore", () => {
    const redis = new Redis(REDIS_URL);
    const store = new ScheduleStore(redis, SECRET);
    const id = store.idFor(ENDPOINT);

    /** Replace whatever is stored, as a client's schedule request does. */
    async function put(endpoint: string, messages: Array<ScheduledMessage>) {
        const current = await store.pending(endpoint);
        expect(await store.replace(endpoint, messages, current.raw)).toBe(true);
    }

    async function clear() {
        const keys = await redis.keys("sockethub:{scheduled}:*");
        if (keys.length) await redis.del(...keys);
    }
    beforeEach(clear);
    afterAll(async () => {
        await clear();
        redis.disconnect();
    });

    it("stores a schedule that a later boot can read back", async () => {
        await put(ENDPOINT, [message(HOUR), message(2 * HOUR)]);

        // A second server, or the same one after a restart: a new process
        // with only the configured secret in common.
        const connection = new Redis(REDIS_URL);
        const later = new ScheduleStore(connection, SECRET);
        expect((await later.pending(ENDPOINT)).messages).toHaveLength(2);
        expect(await later.count()).toBe(1);
        const loaded = await later.load(later.idFor(ENDPOINT));
        connection.disconnect();
        expect(loaded?.record).toEqual({
            endpoint: ENDPOINT,
            messages: [message(HOUR), message(2 * HOUR)],
        });
    });

    it("reveals nothing about a subscription without the secret", async () => {
        await put(ENDPOINT, [message(HOUR, { content: "TOPSECRET" })]);
        const dump = JSON.stringify([
            await redis.keys("sockethub:{scheduled}:*"),
            await redis.get(scheduleRecordKey(id)),
            await redis.zrange(SCHEDULE_DUE_KEY, 0, -1),
        ]);
        expect(dump).not.toContain("web.push.apple.com");
        expect(dump).not.toContain("integration-secret-path");
        expect(dump).not.toContain("TOPSECRET");

        // Another secret can neither find nor read the record. It is left
        // in place: a server started with a mistyped secret must not
        // destroy schedules that the right secret can still read.
        const other = new ScheduleStore(redis, `${SECRET}-other`);
        expect(await other.pending(ENDPOINT)).toEqual({
            messages: [],
            raw: null,
        });
        expect(await other.load(id)).toBeNull();
        expect((await store.load(id))?.record.endpoint).toBe(ENDPOINT);
        expect(await redis.zscore(SCHEDULE_DUE_KEY, id)).not.toBeNull();
    });

    it("refuses a record copied under another subscription's key", async () => {
        await put(ENDPOINT, [message(HOUR)]);
        const otherId = store.idFor(`${ENDPOINT}-other`);
        await redis.set(
            scheduleRecordKey(otherId),
            String(await redis.get(scheduleRecordKey(id))),
        );
        expect(await store.load(otherId)).toBeNull();
    });

    it("expires a record once its last message is past delivery", async () => {
        await put(ENDPOINT, [
            message(HOUR, { ttl: 600 }),
            message(2 * HOUR, { ttl: 1200 }),
        ]);
        const expiresAt = await redis.pexpiretime(scheduleRecordKey(id));
        expect(expiresAt).toBe(NOW + 2 * HOUR + 1200 * 1000 + 60 * 1000);
    });

    it("replaces the list, and an empty list removes everything", async () => {
        await put(ENDPOINT, [message(HOUR)]);
        await put(ENDPOINT, [message(3 * HOUR)]);
        expect(await redis.zscore(SCHEDULE_DUE_KEY, id)).toBe(
            String(NOW + 3 * HOUR),
        );

        await put(ENDPOINT, []);
        expect(await redis.exists(scheduleRecordKey(id))).toBe(0);
        expect(await store.count()).toBe(0);
    });

    it("hands a due subscription to one claimer until the lease ends", async () => {
        await put(ENDPOINT, [message(-1000)]);
        await put(`${ENDPOINT}-later`, [message(HOUR)]);

        expect(await store.claimDue(NOW, 60000, 10)).toEqual([id]);
        // A second server polling at the same moment gets nothing.
        expect(await store.claimDue(NOW, 60000, 10)).toEqual([]);
        // The first server died mid-send: it comes due again.
        expect(await store.claimDue(NOW + 60001, 60000, 10)).toEqual([id]);
    });

    it("saves what is left and sets the next wake-up, by retry time", async () => {
        await put(ENDPOINT, [message(-1000), message(HOUR)]);
        await store.claimDue(NOW, 60000, 10);
        const loaded = await store.load(id);
        if (!loaded) throw new Error("record missing");

        const retrying = message(2 * HOUR, {
            retryAt: NOW + 5000,
            attempts: 1,
        });
        expect(await store.save(id, loaded, [message(HOUR), retrying])).toBe(
            true,
        );
        expect(await redis.zscore(SCHEDULE_DUE_KEY, id)).toBe(
            String(NOW + 5000),
        );
        expect((await store.load(id))?.record.messages).toEqual([
            message(HOUR),
            retrying,
        ]);
    });

    it("does not overwrite a schedule replaced while a send was in flight", async () => {
        await put(ENDPOINT, [message(-1000)]);
        await store.claimDue(NOW, 60000, 10);
        const loaded = await store.load(id);
        if (!loaded) throw new Error("record missing");

        expect(await store.unchanged(id, loaded)).toBe(true);
        // The app syncs a new list before the send finishes.
        await put(ENDPOINT, [message(4 * HOUR)]);

        expect(await store.unchanged(id, loaded)).toBe(false);
        expect(await store.save(id, loaded, [])).toBe(false);
        expect((await store.load(id))?.record.messages).toEqual([
            message(4 * HOUR),
        ]);
        expect(await redis.zscore(SCHEDULE_DUE_KEY, id)).toBe(
            String(NOW + 4 * HOUR),
        );
    });

    it("refuses a replacement worked out from a record that has since changed", async () => {
        await put(ENDPOINT, [message(-1000), message(HOUR)]);
        const read = await store.pending(ENDPOINT);
        const loaded = await store.load(id);
        if (!loaded) throw new Error("record missing");

        // A worker sends the due message and saves what is left.
        expect(await store.save(id, loaded, [message(HOUR)])).toBe(true);

        // A list that still included the sent message must not go in.
        expect(await store.replace(ENDPOINT, read.messages, read.raw)).toBe(
            false,
        );
        expect((await store.pending(ENDPOINT)).messages).toEqual([
            message(HOUR),
        ]);
        // Nor may a new record be written over one that appeared meanwhile.
        expect(await store.replace(ENDPOINT, [message(2 * HOUR)], null)).toBe(
            false,
        );
    });

    it("removes the record when nothing is left", async () => {
        await put(ENDPOINT, [message(-1000)]);
        const loaded = await store.load(id);
        if (!loaded) throw new Error("record missing");
        expect(await store.save(id, loaded, [])).toBe(true);
        expect(await redis.exists(scheduleRecordKey(id))).toBe(0);
        expect(await store.count()).toBe(0);
    });

    it("drops a wake-up whose record has expired", async () => {
        await redis.zadd(SCHEDULE_DUE_KEY, NOW - 1, id);
        expect(await store.load(id)).toBeNull();
        expect(await store.count()).toBe(0);
    });

    it("survives the cleanup that removes a stopped server's data", async () => {
        await put(ENDPOINT, [message(HOUR)]);

        // A server that crashed long ago: listed, no alive key, idle queue.
        const deadServer = "deadServerIntegration1";
        await redis.sadd(KNOWN_SERVERS_KEY, deadServer);
        await redis.del(buildAliveKey(deadServer));
        const queueKey = `bull:sockethub-${deadServer}-data-layer-queue-x:meta`;
        await redis.set(queueKey, "1");
        expect(
            await sweepOrphanedQueues(redis, "liveServerIntegration", 0),
        ).toBeGreaterThan(0);
        expect(await redis.exists(queueKey)).toBe(0);
        // What a server deletes on shutdown.
        await purgeCredentialsStoreKeys(redis, deadServer);

        expect((await store.pending(ENDPOINT)).messages).toEqual([
            message(HOUR),
        ]);
        expect(await redis.zscore(SCHEDULE_DUE_KEY, id)).toBe(
            String(NOW + HOUR),
        );
    });

    it("refuses a secret too short to protect the stored schedules", () => {
        expect(() => new ScheduleStore(redis, "short")).toThrow(
            /at least 32 characters/,
        );
    });
});
