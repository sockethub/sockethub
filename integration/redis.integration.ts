import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
    CredentialsStore,
    type JobDataDecrypted,
    JobQueue,
    JobWorker,
} from "@sockethub/data-layer";
import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";

const REDIS_HOST = "localhost";
const REDIS_PORT = "16379";
const REDIS_URL = `redis://${REDIS_HOST}:${REDIS_PORT}`;

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
        worker.onJob(async (job) => {
            expect(job).toEqual({
                title: "bar-0",
                sessionId: "socket id",
                msg: as,
            });
        });
        queue.add("socket id", as).then((job) => {
            expect(job.msg.length).toEqual(193);
            expect(job.title).toEqual("bar-0");
            expect(job.sessionId).toEqual("socket id");
        });
    });

    afterEach(async () => {
        await queue.shutdown();
        await worker.shutdown();
    });
});
