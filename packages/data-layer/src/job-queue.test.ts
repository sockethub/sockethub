import { expect } from "chai";
import * as sinon from "sinon";

import { JobQueue } from "./index";

describe("JobQueue", () => {
    let MockBull, jobQueue, cryptoMocks, sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        cryptoMocks = {
            objectHash: sandbox.stub(),
            decrypt: sandbox.stub(),
            encrypt: sandbox.stub(),
            hash: sandbox.stub(),
        };
        MockBull = sandbox.stub().returns({
            add: sandbox.stub(),
            getJob: sandbox.stub(),
            removeAllListeners: sandbox.stub(),
            pause: sandbox.stub(),
            resume: sandbox.stub(),
            isPaused: sandbox.stub(),
            obliterate: sandbox.stub(),
            isRunning: sandbox.stub(),
            close: sandbox.stub(),
            emit: sandbox.stub(),
            disconnect: sandbox.stub(),
            on: sandbox.stub().callsArgWith(1, "a job id", "a result string"),
        });

        class TestJobQueue extends JobQueue {
            initQueue() {
                this.queue = MockBull(this.uid, {
                    connection: {},
                });
            }
            initWorker() {
                // this.handler = async (data) => {
                //     this.emit("completed", data);
                //     return data;
                // };
                this.worker = MockBull(this.uid, this.jobHandler.bind(this), {
                    connection: {},
                });
            }
            initCrypto() {
                this.crypto = cryptoMocks;
            }
        }
        jobQueue = new TestJobQueue(
            "a parent id",
            "a session id",
            "secret is 32 char long like this",
            {
                url: "redis config",
            },
        );
        jobQueue.emit = sandbox.stub();
    });

    afterEach(() => {
        sinon.restore();
        sandbox.reset();
    });

    it("returns a valid JobQueue object", () => {
        sinon.assert.calledOnce(MockBull);
        sinon.assert.calledWith(
            MockBull,
            "sockethub:data-layer:job-queue:a parent id:a session id",
            {
                connection: {},
            },
        );
        expect(typeof jobQueue).to.equal("object");
        expect(jobQueue.uid).to.equal(
            `sockethub:data-layer:job-queue:a parent id:a session id`,
        );
        expect(typeof jobQueue.add).to.equal("function");
        expect(typeof jobQueue.getJob).to.equal("function");
        expect(typeof jobQueue.onJob).to.equal("function");
        expect(typeof jobQueue.shutdown).to.equal("function");
    });

    // describe("initResultEvents", () => {
    //     it("registers handlers when called", () => {
    //         bullMocks.on.reset();
    //         // jobQueue.initResultEvents();
    //         expect(bullMocks.on.callCount).to.eql(4);
    //         sinon.assert.calledWith(bullMocks.on, "global:completed");
    //         sinon.assert.calledWith(bullMocks.on, "global:error");
    //         sinon.assert.calledWith(bullMocks.on, "global:failed");
    //         sinon.assert.calledWith(bullMocks.on, "failed");
    //     });
    // });

    describe("createJob", () => {
        it("returns expected job format", () => {
            cryptoMocks.encrypt.returns("an encrypted message");
            const job = jobQueue.createJob("a socket id", {
                context: "some context",
                id: "an identifier",
            });
            expect(job).to.eql({
                title: "some context-an identifier",
                msg: "an encrypted message",
                sessionId: "a socket id",
            });
        });

        it("uses counter when no id provided", () => {
            cryptoMocks.encrypt.returns("an encrypted message");
            let job = jobQueue.createJob("a socket id", {
                context: "some context",
            });
            expect(job).to.eql({
                title: "some context-0",
                msg: "an encrypted message",
                sessionId: "a socket id",
            });
            job = jobQueue.createJob("a socket id", {
                context: "some context",
            });
            expect(job).to.eql({
                title: "some context-1",
                msg: "an encrypted message",
                sessionId: "a socket id",
            });
        });
    });

    describe("add", () => {
        it("stores encrypted job", async () => {
            cryptoMocks.encrypt.returns("encrypted foo");
            jobQueue.queue.isPaused.returns(false);
            const resultJob = {
                title: "a platform-an identifier",
                sessionId: "a socket id",
                msg: "encrypted foo",
            };
            const res = await jobQueue.add("a socket id", {
                context: "a platform",
                id: "an identifier",
            });
            sinon.assert.calledOnce(jobQueue.queue.isPaused);
            sinon.assert.notCalled(jobQueue.queue.emit);
            sinon.assert.calledOnceWithExactly(
                jobQueue.queue.add,
                "a platform-an identifier",
                resultJob,
            );
            expect(res).to.eql(resultJob);
        });
        it("fails job if queue paused", async () => {
            cryptoMocks.encrypt.returns("encrypted foo");
            jobQueue.queue.isPaused.returns(true);
            try {
                await jobQueue.add("a socket id", {
                    context: "a platform",
                    id: "an identifier",
                });
            } catch (err) {
                expect(err.toString()).to.eql("Error: queue closed");
            }
            sinon.assert.calledOnce(jobQueue.queue.isPaused);
            sinon.assert.notCalled(jobQueue.queue.add);
        });
    });

    describe("getJob", () => {
        const encryptedJob = {
            data: {
                title: "a title",
                msg: "an encrypted msg",
                sessionId: "a socket id",
            },
        };

        it("handles fetching a valid job", async () => {
            jobQueue.queue.getJob.returns(encryptedJob);
            cryptoMocks.decrypt.returns("an unencrypted message");
            const job = await jobQueue.getJob("a valid job");
            sinon.assert.calledOnceWithExactly(
                jobQueue.queue.getJob,
                "a valid job",
            );
            encryptedJob.data.msg = "an unencrypted message";
            expect(job).to.eql(encryptedJob);
        });

        it("handles fetching an invalid job", async () => {
            jobQueue.queue.getJob.returns(undefined);
            const job = await jobQueue.getJob("an invalid job");
            expect(job).to.eql(undefined);
            sinon.assert.calledOnceWithExactly(
                jobQueue.queue.getJob,
                "an invalid job",
            );
            sinon.assert.notCalled(cryptoMocks.decrypt);
        });

        it("removes sessionSecret", async () => {
            jobQueue.queue.getJob.returns(encryptedJob);
            cryptoMocks.decrypt.returns({
                foo: "bar",
                sessionSecret: "yarg",
            });
            const job = await jobQueue.getJob("a valid job");
            sinon.assert.calledOnceWithExactly(
                jobQueue.queue.getJob,
                "a valid job",
            );
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            encryptedJob.data.msg = {
                foo: "bar",
            };
            expect(job).to.eql(encryptedJob);
        });
    });

    describe("onJob", () => {
        it("queues the handler", () => {
            jobQueue.onJob(() => {
                throw new Error("This handler should never be called");
            });
            sinon.assert.calledThrice(jobQueue.worker.on);
        });
    });

    it("pause", async () => {
        await jobQueue.pause();
        sinon.assert.calledOnce(jobQueue.queue.pause);
    });

    it("resume", async () => {
        await jobQueue.resume();
        sinon.assert.calledOnce(jobQueue.queue.resume);
    });

    describe("shutdown", () => {
        it("is sure to pause when not already paused", async () => {
            sinon.assert.notCalled(jobQueue.queue.pause);
            jobQueue.initWorker();
            sinon.assert.notCalled(jobQueue.queue.pause);
            jobQueue.queue.isPaused.returns(false);
            sinon.assert.notCalled(jobQueue.queue.pause);
            await jobQueue.shutdown();
            sinon.assert.calledOnce(jobQueue.queue.pause);
            sinon.assert.calledOnce(jobQueue.queue.removeAllListeners);
            sinon.assert.calledOnce(jobQueue.queue.obliterate);
        });
        it("skips pausing when already paused", async () => {
            jobQueue.queue.isPaused.returns(true);
            sinon.assert.notCalled(jobQueue.queue.pause);
            await jobQueue.shutdown();
            sinon.assert.notCalled(jobQueue.queue.pause);
            sinon.assert.calledOnce(jobQueue.queue.removeAllListeners);
            sinon.assert.calledOnce(jobQueue.queue.obliterate);
        });
    });

    describe("jobHandler", () => {
        it("calls handler as expected", async () => {
            cryptoMocks.decrypt.returns("an unencrypted message");
            const encryptedJob = {
                data: {
                    title: "a title",
                    msg: "an encrypted message",
                    sessionId: "a socket id",
                },
            };
            jobQueue.onJob((job) => {
                const decryptedData = encryptedJob.data;
                decryptedData.msg = "an unencrypted message";
                expect(job).to.eql(decryptedData);
                decryptedData.msg += " handled";
                return decryptedData;
            });
            const result = await jobQueue.jobHandler(encryptedJob);
            expect(result.msg).to.eql("an unencrypted message handled");
        });
    });

    describe("decryptJobData", () => {
        it("decrypts and returns expected object", () => {
            cryptoMocks.decrypt.returnsArg(0);
            const jobData = {
                data: {
                    title: "foo",
                    msg: "encryptedjobdata",
                    sessionId: "foobar",
                },
            };
            const secret = "secretstring";
            expect(jobQueue.decryptJobData(jobData, secret)).to.be.eql(
                jobData.data,
            );
        });
    });

    describe("decryptActivityStream", () => {
        it("decrypts and returns expected object", () => {
            cryptoMocks.decrypt.returnsArg(0);
            const jobData = "encryptedjobdata";
            const secret = "secretstring";
            expect(jobQueue.decryptActivityStream(jobData, secret)).to.be.eql(
                jobData,
            );
        });
    });
});
