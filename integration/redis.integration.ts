import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { crypto } from "@sockethub/crypto";
import {
    CredentialsStore,
    type JobDataDecrypted,
    JobQueue,
    JobWorker,
} from "@sockethub/data-layer";
import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";
import config from "./config.js";

const REDIS_URL = config.redis.url;

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
const testSecret = "baz1234567890baz1234567890abcdef";

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

    it("add job and get job on queue", (done) => {
        // queue.initResultEvents();
        queue.on("completed", (jobData: JobDataDecrypted) => {
            expect(jobData).toEqual({
                title: "bar-0",
                sessionId: "socket id",
                msg: as,
            });
            done();
        });
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
        queue.add("socket id", as).then((job) => {
            expect(job.msg.length).toEqual(193);
            expect(job.title).toEqual("bar-0");
            expect(job.sessionId).toEqual("socket id");
        });
    });

    it("handles job failures", (done) => {
        queue.on("failed", (jobData: JobDataDecrypted, error: string) => {
            expect(jobData.msg.type).toEqual("foo");
            expect(error).toContain("simulated error");
            done();
        });

        worker.onJob(async (job: JobDataDecrypted) => {
            throw new Error("simulated error");
        });

        queue.add("socket id", as);
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

    it("processes multiple jobs in sequence", (done) => {
        let completedCount = 0;
        const jobCount = 5;

        queue.on("completed", () => {
            completedCount++;
            if (completedCount === jobCount) {
                done();
            }
        });

        worker.onJob(async (job: JobDataDecrypted) => {
            return undefined;
        });

        for (let i = 0; i < jobCount; i++) {
            queue.add("socket id", { ...as, id: `job-${i}` });
        }
    });

    it("handles worker returning ActivityStream", (done) => {
        const returnAS: ActivityStream = {
            type: "result",
            context: "bar",
            actor: { id: "bar", type: "person" },
        };

        queue.on("completed", (jobData, result) => {
            expect(result).toEqual(returnAS);
            done();
        });

        worker.onJob(async () => returnAS);
        queue.add("socket id", as);
    });

    it("handles worker returning undefined", (done) => {
        worker.onJob(async () => undefined);
        queue.on("completed", (jobData, result) => {
            // BullMQ converts undefined to null in the result
            expect(result).toBeNull();
            done();
        });

        queue.add("socket id", as);
    });

    it("encrypts and decrypts job data correctly", (done) => {
        const complexAS: ActivityStream = {
            type: "send",
            context: "irc",
            actor: { id: "user@example.com", type: "person" },
            object: {
                type: "message",
                content: "Hello with special chars: émojis 🎉",
            },
        };

        worker.onJob(async (job: JobDataDecrypted) => {
            expect(job.msg).toEqual(complexAS);
            done();
            return undefined;
        });

        queue.add("socket id", complexAS);
    });

    afterEach(async () => {
        queue.removeAllListeners();
        await queue.shutdown();
        await worker.shutdown();
    });
});
