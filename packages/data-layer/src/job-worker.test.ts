import { expect } from "chai";
import * as sinon from "sinon";

import { JobWorker } from "./index";

describe("JobWorker", () => {
    let MockBull, jobWorker, cryptoMocks, sandbox;

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

        class TestJobWorker extends JobWorker {
            init() {
                this.redisConnection = MockBull();
                this.worker = MockBull(
                    this.uid,
                    this.jobHandler.bind(this),
                    this.redisConnection,
                );
            }
            initCrypto() {
                this.crypto = cryptoMocks;
            }
        }
        jobWorker = new TestJobWorker(
            "a parent id",
            "a session id",
            "secret is 32 char long like this",
            {
                url: "redis config",
            },
        );
        jobWorker.emit = sandbox.stub();
    });

    afterEach(() => {
        sinon.restore();
        sandbox.reset();
    });

    it("returns a valid JobWorker object", () => {
        expect(typeof jobWorker).to.equal("object");
        expect(jobWorker.uid).to.equal(
            `sockethub:data-layer:worker:a parent id:a session id`,
        );
        expect(typeof jobWorker.onJob).to.equal("function");
        expect(typeof jobWorker.shutdown).to.equal("function");
    });

    describe("onJob", () => {
        it("queues the handler", () => {
            jobWorker.onJob(() => {
                throw new Error("This handler should never be called");
            });
            sinon.assert.notCalled(jobWorker.worker.on);
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
            jobWorker.onJob((job) => {
                const decryptedData = encryptedJob.data;
                decryptedData.msg = "an unencrypted message";
                expect(job).to.eql(decryptedData);
                decryptedData.msg += " handled";
                return decryptedData;
            });
            const result = await jobWorker.jobHandler(encryptedJob);
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
            expect(jobWorker.decryptJobData(jobData, secret)).to.be.eql(
                jobData.data,
            );
        });
    });

    describe("decryptActivityStream", () => {
        it("decrypts and returns expected object", () => {
            cryptoMocks.decrypt.returnsArg(0);
            const jobData = "encryptedjobdata";
            const secret = "secretstring";
            expect(jobWorker.decryptActivityStream(jobData, secret)).to.be.eql(
                jobData,
            );
        });
    });
});
