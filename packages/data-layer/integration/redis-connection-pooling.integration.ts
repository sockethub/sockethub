import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "vitest";

import {
    createIORedisConnection,
    getRedisConnectionCount,
    resetSharedRedisConnection,
} from "../src/job-base.js";
import type { RedisConfig } from "../src/types.js";

describe("Redis Connection Pooling Integration Tests", () => {
    let redisConfig: RedisConfig;

    beforeEach(async () => {
        await resetSharedRedisConnection();
        redisConfig = {
            url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
            connectTimeout: 10000,
            disconnectTimeout: 5000,
            maxRetriesPerRequest: null,
        };
    });

    afterEach(async () => {
        await resetSharedRedisConnection();
    });

    it("should create a shared connection on first call", async () => {
        const conn1 = createIORedisConnection(redisConfig);
        expect(conn1).to.exist;
        expect(conn1.status).to.be.oneOf(["connecting", "connect", "ready"]);
        const pong = await conn1.ping();
        expect(pong).to.equal("PONG");
    });

    it("should reuse the same connection on subsequent calls", async () => {
        const conn1 = createIORedisConnection(redisConfig);
        const conn2 = createIORedisConnection(redisConfig);
        expect(conn1).to.equal(conn2);
        const key = `sockethub:test:redis-conn:${Date.now()}`;
        await conn2.set(key, "ok");
        const value = await conn1.get(key);
        expect(value).to.equal("ok");
        await conn1.del(key);
    });

    it("should apply timeout configuration from RedisConfig", async () => {
        const customConfig: RedisConfig = {
            url: "redis://127.0.0.1:6379",
            connectTimeout: 5000,
            disconnectTimeout: 2000,
            maxRetriesPerRequest: 3,
        };

        await resetSharedRedisConnection();
        const conn = createIORedisConnection(customConfig);

        expect(conn.options.connectTimeout).to.equal(5000);
        expect(conn.options.disconnectTimeout).to.equal(2000);
        expect(conn.options.maxRetriesPerRequest).to.equal(3);
        const pong = await conn.ping();
        expect(pong).to.equal("PONG");
    });

    it("should use default timeouts when not specified", async () => {
        const minimalConfig: RedisConfig = {
            url: "redis://127.0.0.1:6379",
        };

        await resetSharedRedisConnection();
        const conn = createIORedisConnection(minimalConfig);

        expect(conn.options.connectTimeout).to.equal(10000);
        expect(conn.options.disconnectTimeout).to.equal(5000);
        expect(conn.options.maxRetriesPerRequest).to.be.null;
        const pong = await conn.ping();
        expect(pong).to.equal("PONG");
    });

    it("should disconnect and reset shared connection", async () => {
        const conn1 = createIORedisConnection(redisConfig);
        expect(conn1).to.exist;

        await resetSharedRedisConnection();

        // After reset, should create a new connection
        const conn2 = createIORedisConnection(redisConfig);
        expect(conn2).to.exist;
        expect(conn2).to.not.equal(conn1);
    });

    it("should stop retrying after 3 failed connection attempts", async () => {
        const badConfig: RedisConfig = {
            url: "redis://127.0.0.1:6399",
            connectTimeout: 200,
            disconnectTimeout: 200,
            maxRetriesPerRequest: null,
        };

        await resetSharedRedisConnection();
        const conn = createIORedisConnection(badConfig);

        let retryCount = 0;
        const retryDelays: number[] = [];
        const errors: unknown[] = [];

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(
                    new Error(
                        `Timed out waiting for retries (count=${retryCount})`,
                    ),
                );
            }, 5000);

            const onReconnecting = (delay: number) => {
                retryCount += 1;
                retryDelays.push(delay);
            };

            const onEnd = () => {
                cleanup();
                resolve();
            };

            const onError = (err: unknown) => {
                errors.push(err);
            };

            const cleanup = () => {
                clearTimeout(timeout);
                conn.off("reconnecting", onReconnecting);
                conn.off("end", onEnd);
                conn.off("error", onError);
            };

            conn.on("reconnecting", onReconnecting);
            conn.on("end", onEnd);
            conn.on("error", onError);
        });

        expect(retryCount).to.equal(3);
        expect(retryDelays).to.eql([200, 400, 800]);
        expect(errors.length).to.be.greaterThan(0);
    }, 7000);

    it("should set lazyConnect to false for immediate connection", async () => {
        const conn = createIORedisConnection(redisConfig);
        expect(conn.options.lazyConnect).to.be.false;
        const pong = await conn.ping();
        expect(pong).to.equal("PONG");
    });

    it("should set enableOfflineQueue to false for fail-fast behavior", async () => {
        const conn = createIORedisConnection(redisConfig);
        expect(conn.options.enableOfflineQueue).to.be.false;
        const pong = await conn.ping();
        expect(pong).to.equal("PONG");
    });

    it("should return 0 connection count when no connection exists", async () => {
        await resetSharedRedisConnection();
        const count = await getRedisConnectionCount();
        expect(count).to.equal(0);
    });

    it("should return connection count from Redis CLIENT LIST", async () => {
        createIORedisConnection(redisConfig);
        const count = await getRedisConnectionCount();
        // Should return a number (actual count depends on Redis state, but should be > 0)
        expect(count).to.be.a("number");
        expect(count).to.be.at.least(0);
    });
});
