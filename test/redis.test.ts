import { describe, it } from "mocha";
import { expect } from "chai";
import {
    CredentialsStore,
    JobQueue,
    JobWorker,
    JobDataDecrypted,
} from "@sockethub/data-layer";
import { ActivityStream, CredentialsObject } from "@sockethub/schemas";

const actor = "" + (Math.random() + 1).toString(36).substring(2);
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
            url: "redis://localhost:16379",
        });
    });

    it("get non-existent value", async () => {
        try {
            await store.get(actor, credsHash);
            expect(false).to.eql(true);
        } catch (err) {
            expect(err.toString()).to.eql(
                `Error: credentials not found for ${actor}`,
            );
        }
    });

    it("save", async () => {
        await store.save(actor, creds);
    });

    it("get", async () => {
        expect(await store.get(actor, credsHash)).to.eql(creds);
    });

    it("shutdown", async () => {
        await store.store.disconnect();
    });
});

describe("connect and disconnect", () => {
    [
        { name: "queue", class: JobQueue },
        { name: "worker", class: JobWorker },
    ].forEach((o) => {
        describe(o.name, () => {
            let i;
            beforeEach("init", () => {
                i = new o.class("testid", "sessionid", testSecret, {
                    url: "redis://localhost:16379",
                });
                if (o.name === "worker") {
                    i.init();
                }
            });

            it("is active", () => {
                expect(typeof i.shutdown).to.eql("function");
            });

            afterEach("shutdown", async () => {
                await i.shutdown();
            });
        });
    });
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

    beforeEach("initialized", () => {
        queue = new JobQueue("testid", "sessionid", testSecret, {
            url: "redis://localhost:16379",
        });
        worker = new JobWorker("testid", "sessionid", testSecret, {
            url: "redis://localhost:16379",
        });
    });

    it("add job and get job on queue", (done) => {
        // queue.initResultEvents();
        queue.on("completed", (jobData: JobDataDecrypted) => {
            expect(jobData).to.eql({
                title: "bar-0",
                sessionId: "socket id",
                msg: as,
            });
            done();
        });
        worker.onJob(async (job) => {
            console.log("worker got job: ", job);
        });
        queue.add("socket id", as).then((job) => {
            expect(job.msg.length).to.eql(193);
            expect(job.title).to.eql("bar-0");
            expect(job.sessionId).to.eql("socket id");
        });
    });

    afterEach("shutdown", async () => {
        await queue.shutdown();
        await worker.shutdown();
    });
});
