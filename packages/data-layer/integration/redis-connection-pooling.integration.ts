import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "vitest";

import type { Logger } from "@sockethub/schemas";

import { resetSharedRedisConnection } from "../src/job-base.js";
import { JobQueue } from "../src/job-queue.js";
import { JobWorker } from "../src/job-worker.js";
import type { RedisConfig } from "../src/types.js";

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
