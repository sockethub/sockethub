import { describe, it } from "mocha";
import { expect } from "chai";
import {
    CredentialsStore,
    CredentialsObject,
    JobQueue,
    JobDataDecrypted,
} from "@sockethub/data-layer";
import { IActivityStream } from "@sockethub/schemas";

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
            url: "redis://localhost:10651",
        });
    });

    it("get non-existent value", async () => {
        expect(await store.get(actor, credsHash)).to.eql(undefined);
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

describe("JobQueue", () => {
    const as: IActivityStream = {
        type: "foo",
        context: "bar",
        actor: {
            id: "bar",
            type: "person",
        },
    };
    let queue: JobQueue;

    beforeEach("initialized", () => {
        queue = new JobQueue("testid", "sessionid", testSecret, {
            url: "redis://localhost:10651",
        });
    });

    it("add job and get job on queue", (done) => {
        // queue.initResultEvents();
        queue.on("completed", (jobData: JobDataDecrypted) => {
            console.log("-1 ", jobData);
            expect(jobData).to.eql({
                title: "bar-0",
                sessionId: "socket id",
                msg: as,
            });
            console.log("-1b");
            console.log("job done");
            done();
        });
        queue.onJob(async (job) => {
            console.log("-2 ", job);
        });
        queue.add("socket id", as).then((job) => {
            console.log("-3");
            expect(job.msg.length).to.eql(193);
            expect(job.title).to.eql("bar-0");
            expect(job.sessionId).to.eql("socket id");
        });
        console.log("-0");
    });

    afterEach("shutdown", async () => {
        await queue.shutdown();
    });
});
