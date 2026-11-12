import { createLogger } from "@sockethub/logger";
import type { Redis } from "ioredis";

const log = createLogger("data-layer:orphan-sweep");

/**
 * Each server boot gets a random parentId, and its BullMQ queues are named
 * after it. A server that crashes never obliterates them, and no later boot
 * reuses the name, so they would stay in Redis for good. A live server keeps
 * this key fresh so a sweep from another server can tell the two apart.
 */
export function buildAliveKey(parentId: string): string {
    return `sockethub:${parentId}:alive`;
}

/**
 * Servers that have kept an alive key. Only these are ever swept: a server
 * from a release without alive keys is never listed, so a sweep cannot
 * mistake it for a crashed one during a rolling deployment.
 */
export const KNOWN_SERVERS_KEY = "sockethub:servers";

/** BullMQ key prefix of every queue owned by `parentId` (see queue-id.ts). */
function queueKeyPrefix(parentId: string): string {
    return `bull:sockethub-${parentId}-data-layer-queue-`;
}

export const ALIVE_TTL_MS = 60_000;
const ALIVE_REFRESH_MS = 20_000;

/**
 * Mark `parentId` as alive and keep it marked until the returned stop
 * function is called, which deletes the alive key. A failed write is logged
 * and retried on the next refresh, so a Redis outage at boot does not leave
 * the server unmarked for good. The server stays listed in
 * {@link KNOWN_SERVERS_KEY} after a stop, so a later sweep can remove any
 * queues it left behind.
 */
export async function startAliveHeartbeat(
    client: Redis,
    parentId: string,
): Promise<() => Promise<void>> {
    const key = buildAliveKey(parentId);
    const beat = async () => {
        try {
            await client.set(key, "1", "PX", ALIVE_TTL_MS);
            await client.sadd(KNOWN_SERVERS_KEY, parentId);
        } catch (err) {
            log.warn(`could not refresh alive key: ${err}`);
        }
    };
    await beat();
    const timer = setInterval(beat, ALIVE_REFRESH_MS);
    timer.unref?.();
    return async () => {
        clearInterval(timer);
        await client.del(key).catch(() => undefined);
    };
}

async function scanKeys(client: Redis, pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = "0";
    do {
        const [next, batch] = await client.scan(
            cursor,
            "MATCH",
            pattern,
            "COUNT",
            1000,
        );
        cursor = next;
        keys.push(...batch);
    } while (cursor !== "0");
    return keys;
}

/** Newest event time across `keys`' event streams, in ms; 0 when none. */
async function lastActivity(client: Redis, keys: string[]): Promise<number> {
    let newest = 0;
    for (const key of keys) {
        if (!key.endsWith(":events")) continue;
        const [entry] = await client.xrevrange(key, "+", "-", "COUNT", 1);
        const millis = Number(entry?.[0]?.split("-", 1)[0]);
        if (millis > newest) newest = millis;
    }
    return newest;
}

/**
 * Delete the queues of servers that are gone. Only servers listed in
 * {@link KNOWN_SERVERS_KEY} are considered, and one is removed only when its
 * alive key is missing *and* none of its queues has had an event for
 * `idleMs`, which spares a server that stalled past the alive TTL. The
 * caller's own queues are never touched. Any Redis error stops the sweep
 * before anything else is deleted. Returns the number of keys deleted.
 */
export async function sweepOrphanedQueues(
    client: Redis,
    ownParentId: string,
    idleMs = 60 * 60 * 1000,
    now = Date.now(),
): Promise<number> {
    let removed = 0;
    for (const parentId of await client.smembers(KNOWN_SERVERS_KEY)) {
        if (parentId === ownParentId) continue;
        if (await client.exists(buildAliveKey(parentId))) continue;
        const keys = await scanKeys(client, `${queueKeyPrefix(parentId)}*`);
        if (keys.length && now - (await lastActivity(client, keys)) < idleMs) {
            continue;
        }
        // Delete per key: a multi-key DEL would throw CROSSSLOT on a Redis
        // Cluster, where these keys hash to different slots.
        for (const key of keys) {
            removed += await client.del(key);
        }
        await client.srem(KNOWN_SERVERS_KEY, parentId);
        if (keys.length) {
            log.info(
                `removed ${keys.length} queue keys left by stopped server ${parentId}`,
            );
        }
    }
    return removed;
}
