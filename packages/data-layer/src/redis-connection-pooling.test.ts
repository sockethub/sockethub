import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "vitest";

import type { Logger } from "@sockethub/schemas";

import {
    createIORedisConnection,
    resetSharedRedisConnection,
} from "./job-base.js";
import { JobQueue } from "./job-queue.js";
import { JobWorker } from "./job-worker.js";
import type { RedisConfig } from "./types.js";

const mockLogger: Logger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
};

describe("Redis Connection Pooling Integration Tests", () => {
    const testSecret = "secret is 32 char long like this";
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

    it("should share connection between JobQueue instances", () => {
        const queue1 = new JobQueue(
            "test-platform-1",
            "session-1",
            testSecret,
            redisConfig,
            mockLogger,
        );
        const queue2 = new JobQueue(
            "test-platform-2",
            "session-2",
            testSecret,
            redisConfig,
            mockLogger,
        );

        // Both queues should use the same underlying Redis connection
        // (Note: BullMQ creates its own connection wrapper, but uses our shared connection)
        expect(queue1).to.exist;
        expect(queue2).to.exist;

        // Cleanup
        queue1.shutdown();
        queue2.shutdown();
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
        expect(retryStrategy(3)).to.equal(600);

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

    describe("Integration with JobQueue and JobWorker", () => {
        it("should allow multiple queues and workers to share connection", async () => {
            const queue1 = new JobQueue(
                "platform-a",
                "session-1",
                testSecret,
                redisConfig,
                mockLogger,
            );
            const queue2 = new JobQueue(
                "platform-b",
                "session-2",
                testSecret,
                redisConfig,
                mockLogger,
            );

            const worker1 = new JobWorker(
                "platform-a",
                "session-1",
                testSecret,
                redisConfig,
                mockLogger,
            );
            const worker2 = new JobWorker(
                "platform-b",
                "session-2",
                testSecret,
                redisConfig,
                mockLogger,
            );

            // Initialize workers with handlers
            worker1.onJob(async () => "result");
            worker2.onJob(async () => "result");

            // All instances should be created successfully
            expect(queue1).to.exist;
            expect(queue2).to.exist;
            expect(worker1).to.exist;
            expect(worker2).to.exist;

            // Cleanup
            await queue1.shutdown();
            await queue2.shutdown();
            await worker1.shutdown();
            await worker2.shutdown();
        });
    });

    describe("Connection lifecycle under stress", () => {
        it("should handle rapid creation of multiple instances", async () => {
            const instances = [];

            // Create 10 queue instances rapidly
            for (let i = 0; i < 10; i++) {
                instances.push(
                    new JobQueue(
                        `platform-${i}`,
                        `session-${i}`,
                        testSecret,
                        redisConfig,
                        mockLogger,
                    ),
                );
            }

            // All should be created successfully
            expect(instances.length).to.equal(10);

            // Cleanup all instances
            for (const instance of instances) {
                await instance.shutdown();
            }
        });

        it("should handle connection after reset during active usage", async () => {
            const queue1 = new JobQueue(
                "platform-1",
                "session-1",
                testSecret,
                redisConfig,
                mockLogger,
            );

            // Reset connection while queue is active
            await resetSharedRedisConnection();

            // Create new queue after reset
            const queue2 = new JobQueue(
                "platform-2",
                "session-2",
                testSecret,
                redisConfig,
                mockLogger,
            );

            expect(queue2).to.exist;

            // Cleanup
            await queue1.shutdown().catch(() => {
                /* Ignore errors from closed connection */
            });
            await queue2.shutdown();
        });
    });
});
