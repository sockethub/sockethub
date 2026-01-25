import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { crypto } from "@sockethub/crypto";
import {
    CredentialsStore,
    type JobDataDecrypted,
    JobQueue,
    JobWorker,
    redisCheck,
} from "@sockethub/data-layer";
import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_URL = `redis://${REDIS_HOST}:6379`;

const actor = `${(Math.random() + 1).toString(36).substring(2)}`;
const creds: CredentialsObject = {
    type: "credentials",
    context: "bar",
    actor: {
        type: "person",
        id: actor,
    },
    object: {
        type: "credentials",
    },
};
const credsHash = "e591ec978a505aee278f372354c229d165d2c096";
const testSecret = "aB3#xK9mP2qR7wZ4cT8nY6vH1jL5fD0s";

describe("CredentialsStore", () => {
    let store: CredentialsStore;
    it("initializes", () => {
        store = new CredentialsStore("foo", "bar", testSecret, {
            url: REDIS_URL,
        });
    });

    it("get non-existent value", async () => {
        expect(async () => {
            await store.get(actor, credsHash);
            expect(false).toEqual(true);
        }).toThrow(`credentials not found for ${actor}`);
    });

    it("save", async () => {
        await store.save(actor, creds);
    });

    it("get", async () => {
        expect(await store.get(actor, credsHash)).toEqual(creds);
    });

    it("handles credential updates", async () => {
        await store.save(actor, creds);

        const updatedCreds = { ...creds, object: { type: "updated" } };
        await store.save(actor, updatedCreds);

        const newHash = crypto.objectHash(updatedCreds.object);
        const retrieved = await store.get(actor, newHash);
        expect(retrieved).toEqual(updatedCreds);
    });

    it("isolates credentials by session", async () => {
        const store2 = new CredentialsStore(
            "foo",
            "different-session",
            testSecret,
            {
                url: REDIS_URL,
            },
        );

        await store.save(actor, creds);

        // Different session shouldn't see these creds
        await expect(store2.get(actor, credsHash)).rejects.toThrow();

        await store2.store.disconnect();
    });

    it("shutdown", async () => {
        await store.store.disconnect();
    });
});

describe("connect and disconnect", () => {
    interface JobInstance {
        init(): void;
        shutdown(): Promise<void>;
    }

    for (const o of [
        { name: "queue", class: JobQueue },
        { name: "worker", class: JobWorker },
    ]) {
        describe(o.name, () => {
            let i: JobInstance;
            beforeEach(() => {
                i = new o.class("testid", "sessionid", testSecret, {
                    url: REDIS_URL,
                }) as unknown as JobInstance;
                if (o.name === "worker") {
                    i.init();
                }
            });

            it("is active", () => {
                expect(typeof i.shutdown).toEqual("function");
            });

            afterEach(async () => {
                await i.shutdown();
            });
        });
    }
});

describe("JobQueue", () => {
    const as: ActivityStream = {
        type: "foo",
        context: "bar",
        actor: {
            id: "bar",
            type: "person",
        },
    };
    let queue: JobQueue;
    let worker: JobWorker;

    beforeEach(() => {
        queue = new JobQueue("testid", "sessionid", testSecret, {
            url: REDIS_URL,
        });
        worker = new JobWorker("testid", "sessionid", testSecret, {
            url: REDIS_URL,
        });
    });

    it("add job and get job on queue", async () => {
        // Set up promise that resolves when job completes
        const completedPromise = new Promise<JobDataDecrypted>((resolve) => {
            queue.on("completed", (jobData: JobDataDecrypted) => {
                expect(jobData).toEqual({
                    title: "bar-0",
                    sessionId: "socket id",
                    msg: as,
                });
                resolve(jobData);
            });
        });

        // Register job handler before adding job
        worker.onJob(
            async (
                job: JobDataDecrypted,
            ): Promise<string | undefined | ActivityStream> => {
                expect(job).toEqual({
                    title: "bar-0",
                    sessionId: "socket id",
                    msg: as,
                });
                return undefined;
            },
        );

        // Give worker time to establish Redis connection and start polling
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Add job and verify it was queued
        const job = await queue.add("socket id", as);
        expect(job.msg.length).toEqual(193);
        expect(job.title).toEqual("bar-0");
        expect(job.sessionId).toEqual("socket id");

        // Wait for job to complete
        await completedPromise;
    });

    it("handles job failures", async () => {
        // Set up promise that resolves when job fails
        const failedPromise = new Promise<void>((resolve) => {
            queue.on("failed", (jobData: JobDataDecrypted, error: string) => {
                expect(jobData.msg.type).toEqual("foo");
                expect(error).toContain("simulated error");
                resolve();
            });
        });

        // Register job handler that will fail
        worker.onJob(async (job: JobDataDecrypted) => {
            throw new Error("simulated error");
        });

        // Give worker time to establish Redis connection and start polling
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Add job and wait for it to fail
        await queue.add("socket id", as);
        await failedPromise;
    });

    it("rejects jobs when queue is paused", async () => {
        // Initialize worker first (even though we won't use it) to avoid shutdown errors
        worker.onJob(async () => undefined);

        await queue.pause();

        await expect(queue.add("socket id", as)).rejects.toThrow(
            "queue closed",
        );
    });

    it("can resume paused queue", async () => {
        await queue.pause();
        await queue.resume();

        worker.onJob(async () => undefined);

        // Should work after resume
        const job = await queue.add("socket id", as);
        expect(job.title).toBeDefined();
    });

    it("processes multiple jobs in sequence", async () => {
        const jobCount = 5;
        let completedCount = 0;

        // Set up promise that resolves when all jobs complete
        const allCompletedPromise = new Promise<void>((resolve) => {
            queue.on("completed", () => {
                completedCount++;
                if (completedCount === jobCount) {
                    resolve();
                }
            });
        });

        // Register job handler
        worker.onJob(async (job: JobDataDecrypted) => {
            return undefined;
        });

        // Give worker time to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Add all jobs
        for (let i = 0; i < jobCount; i++) {
            await queue.add("socket id", { ...as, id: `job-${i}` });
        }

        // Wait for all jobs to complete
        await allCompletedPromise;
    });

    it("handles worker returning ActivityStream", async () => {
        const returnAS: ActivityStream = {
            type: "result",
            context: "bar",
            actor: { id: "bar", type: "person" },
        };

        // Set up promise that resolves when job completes
        const completedPromise = new Promise<void>((resolve) => {
            queue.on("completed", (jobData, result) => {
                expect(result).toEqual(returnAS);
                resolve();
            });
        });

        // Register job handler
        worker.onJob(async () => returnAS);

        // Give worker time to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Add job and wait for completion
        await queue.add("socket id", as);
        await completedPromise;
    });

    it("handles worker returning undefined", async () => {
        // Set up promise that resolves when job completes
        const completedPromise = new Promise<void>((resolve) => {
            queue.on("completed", (jobData, result) => {
                // BullMQ converts undefined to null in the result
                expect(result).toBeNull();
                resolve();
            });
        });

        // Register job handler
        worker.onJob(async () => undefined);

        // Give worker time to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Add job and wait for completion
        await queue.add("socket id", as);
        await completedPromise;
    });

    it("encrypts and decrypts job data correctly", async () => {
        const complexAS: ActivityStream = {
            type: "send",
            context: "irc",
            actor: { id: "user@example.com", type: "person" },
            object: {
                type: "message",
                content: "Hello with special chars: émojis 🎉",
            },
        };

        // Set up promise that resolves when job is processed
        const processedPromise = new Promise<void>((resolve) => {
            worker.onJob(async (job: JobDataDecrypted) => {
                expect(job.msg).toEqual(complexAS);
                resolve();
                return undefined;
            });
        });

        // Give worker time to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Add job and wait for processing
        await queue.add("socket id", complexAS);
        await processedPromise;
    });

    afterEach(async () => {
        queue.removeAllListeners();
        await queue.shutdown();
        await worker.shutdown();
    });
});

/**
 * Redis connection failure tests
 *
 * These tests document a known issue: secure-store-redis (used by CredentialsStore)
 * does not properly handle Redis connection errors. Instead of returning rejected
 * promises, errors escape as unhandled exceptions, which can crash the process.
 *
 * The workaround in sockethub is to catch errors in middleware (store-credentials.ts)
 * and handle them gracefully. However, the underlying library bug remains.
 *
 * These tests are skipped because they expose unhandled exceptions that crash the
 * test runner. They serve as documentation of the issue.
 */
describe.skip("Redis connection failure", () => {
    const INVALID_REDIS_URL = "redis://localhost:6399"; // Non-existent port

    it("redisCheck throws on connection timeout", async () => {
        // BUG: secure-store-redis throws unhandled exceptions instead of rejecting
        await expect(redisCheck({ url: INVALID_REDIS_URL })).rejects.toThrow();
    }, 15000);

    it("CredentialsStore fails gracefully on unavailable Redis", async () => {
        const store = new CredentialsStore("foo", "bar", testSecret, {
            url: INVALID_REDIS_URL,
        });
        // BUG: secure-store-redis throws unhandled exceptions instead of rejecting
        await expect(store.get("actor", undefined)).rejects.toThrow();
    }, 15000);

    it("JobQueue fails on unavailable Redis", async () => {
        const queue = new JobQueue("testid", "sessionid", testSecret, {
            url: INVALID_REDIS_URL,
        });

        const as: ActivityStream = {
            type: "foo",
            context: "bar",
            actor: { id: "bar", type: "person" },
        };

        // BUG: ioredis/BullMQ may also throw unhandled errors
        await expect(queue.add("socket id", as)).rejects.toThrow();

        try {
            await queue.shutdown();
        } catch {
            // Expected to fail
        }
    }, 15000);
});
