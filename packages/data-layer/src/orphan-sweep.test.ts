import { describe, expect, it } from "bun:test";
import type { Redis } from "ioredis";
import {
    buildAliveKey,
    KNOWN_SERVERS_KEY,
    startAliveHeartbeat,
    sweepOrphanedQueues,
} from "./orphan-sweep.js";

const HOUR = 60 * 60 * 1000;
const NOW = 10 * HOUR;

/** Just enough of ioredis for the sweep: keys, one set, stream timestamps. */
class FakeRedis {
    keys = new Map<string, { lastEventMs?: number; px?: number }>();
    members = new Set<string>();
    failing = new Set<string>();

    private check(command: string) {
        if (this.failing.has(command)) {
            throw new Error(`${command} failed`);
        }
    }
    async scan(_cursor: string, _match: string, pattern: string) {
        const re = new RegExp(
            `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
        );
        return ["0", [...this.keys.keys()].filter((key) => re.test(key))];
    }
    async exists(key: string) {
        return this.keys.has(key) ? 1 : 0;
    }
    async xrevrange(key: string) {
        this.check("xrevrange");
        const ms = this.keys.get(key)?.lastEventMs;
        return ms === undefined ? [] : [[`${ms}-0`, []]];
    }
    async del(key: string) {
        return this.keys.delete(key) ? 1 : 0;
    }
    async set(key: string, _value: string, _px: string, ttl: number) {
        this.check("set");
        this.keys.set(key, { px: ttl });
        return "OK";
    }
    async sadd(_key: string, member: string) {
        this.members.add(member);
        return 1;
    }
    async srem(_key: string, member: string) {
        return this.members.delete(member) ? 1 : 0;
    }
    async smembers(key: string) {
        return key === KNOWN_SERVERS_KEY ? [...this.members] : [];
    }
}

function queue(redis: FakeRedis, parentId: string, lastEventMs: number) {
    const name = `bull:sockethub-${parentId}-data-layer-queue-abc123`;
    redis.keys.set(`${name}:meta`, {});
    redis.keys.set(`${name}:1`, {});
    redis.keys.set(`${name}:events`, { lastEventMs });
}

const keysOf = (redis: FakeRedis, parentId: string) =>
    [...redis.keys.keys()].filter((k) => k.includes(`-${parentId}-`)).length;

describe("sweepOrphanedQueues", () => {
    it("removes only queues of known servers that are gone and idle", async () => {
        const redis = new FakeRedis();
        for (const parent of [
            "crashedServer01",
            "aliveServer0001",
            "recentServer001",
            "ownServer000001",
        ]) {
            redis.members.add(parent);
        }
        queue(redis, "crashedServer01", NOW - 2 * HOUR);
        queue(redis, "aliveServer0001", NOW - 2 * HOUR);
        redis.keys.set(buildAliveKey("aliveServer0001"), {});
        queue(redis, "recentServer001", NOW - 60_000);
        queue(redis, "ownServer000001", NOW - 2 * HOUR);
        // A server from a release without alive keys: never listed.
        queue(redis, "olderRelease001", NOW - 2 * HOUR);
        redis.keys.set("bull:connectiontest:meta", {});
        redis.keys.set(
            "sockethub:crashedServer01:data-layer:credentials-store:s1",
            {},
        );

        const removed = await sweepOrphanedQueues(
            redis as unknown as Redis,
            "ownServer000001",
            HOUR,
            NOW,
        );

        expect(removed).toBe(3);
        expect(keysOf(redis, "crashedServer01")).toBe(0);
        expect(redis.members.has("crashedServer01")).toBe(false);
        for (const parent of [
            "aliveServer0001",
            "recentServer001",
            "ownServer000001",
            "olderRelease001",
        ]) {
            expect(keysOf(redis, parent)).toBe(3);
        }
        expect([...redis.keys.keys()]).toContain("bull:connectiontest:meta");
        expect([...redis.keys.keys()]).toContain(
            "sockethub:crashedServer01:data-layer:credentials-store:s1",
        );
    });

    it("forgets a known server that left no queues", async () => {
        const redis = new FakeRedis();
        redis.members.add("cleanStop000001");
        await sweepOrphanedQueues(redis as unknown as Redis, "own", HOUR, NOW);
        expect(redis.members.size).toBe(0);
    });

    it("deletes nothing when reading a queue's activity fails", async () => {
        const redis = new FakeRedis();
        redis.members.add("crashedServer01");
        queue(redis, "crashedServer01", NOW - 2 * HOUR);
        redis.failing.add("xrevrange");
        expect(
            sweepOrphanedQueues(redis as unknown as Redis, "own", HOUR, NOW),
        ).rejects.toThrow("xrevrange failed");
        await new Promise((r) => setTimeout(r, 0));
        expect(keysOf(redis, "crashedServer01")).toBe(3);
        expect(redis.members.has("crashedServer01")).toBe(true);
    });
});

describe("startAliveHeartbeat", () => {
    it("sets the alive key with a TTL, registers the server, and deletes the key on stop", async () => {
        const redis = new FakeRedis();
        const stop = await startAliveHeartbeat(
            redis as unknown as Redis,
            "server000000001",
        );
        expect(redis.keys.get(buildAliveKey("server000000001"))?.px).toBe(
            60_000,
        );
        expect(redis.members.has("server000000001")).toBe(true);
        await stop();
        expect(redis.keys.has(buildAliveKey("server000000001"))).toBe(false);
        // Still listed, so a later sweep can clear anything it left behind.
        expect(redis.members.has("server000000001")).toBe(true);
    });

    it("keeps running when the first write fails, so it can retry", async () => {
        const redis = new FakeRedis();
        redis.failing.add("set");
        const stop = await startAliveHeartbeat(
            redis as unknown as Redis,
            "server000000001",
        );
        expect(redis.keys.has(buildAliveKey("server000000001"))).toBe(false);
        // Not registered either, so no sweep can treat it as crashed.
        expect(redis.members.has("server000000001")).toBe(false);
        await stop();
    });
});
