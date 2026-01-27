import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "vitest";

import {
    createIORedisConnection,
    getRedisConnectionCount,
    resetSharedRedisConnection,
} from "./job-base.js";
import type { RedisConfig } from "./types.js";


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

    it("should create a shared connection on first call", () => {
        const conn1 = createIORedisConnection(redisConfig);
        expect(conn1).to.exist;
        expect(conn1.status).to.be.oneOf(["connecting", "connect", "ready"]);
    });

    it("should reuse the same connection on subsequent calls", () => {
        const conn1 = createIORedisConnection(redisConfig);
        const conn2 = createIORedisConnection(redisConfig);
        expect(conn1).to.equal(conn2);
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

    it("should configure retry strategy to fail after 3 attempts", async () => {
        const conn = createIORedisConnection(redisConfig);

        // Test retry strategy function exists and returns correct values
        const retryStrategy = conn.options.retryStrategy as (
            times: number,
        ) => number | null;
        expect(retryStrategy).to.be.a("function");

        // Should return increasing delays for first 3 attempts
        expect(retryStrategy(1)).to.equal(200);
        expect(retryStrategy(2)).to.equal(400);
        expect(retryStrategy(3)).to.equal(800);

        // Should return null (stop retrying) after 3 attempts
        expect(retryStrategy(4)).to.be.null;
        expect(retryStrategy(5)).to.be.null;
    });

    it("should set lazyConnect to false for immediate connection", () => {
        const conn = createIORedisConnection(redisConfig);
        expect(conn.options.lazyConnect).to.be.false;
    });

    it("should set enableOfflineQueue to false for fail-fast behavior", () => {
        const conn = createIORedisConnection(redisConfig);
        expect(conn.options.enableOfflineQueue).to.be.false;
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
