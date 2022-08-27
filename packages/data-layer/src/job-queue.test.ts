import proxyquire from 'proxyquire';
import { expect } from 'chai';
import * as sinon from 'sinon';

proxyquire.noPreserveCache();
proxyquire.noCallThru();

describe('JobQueue', () => {
  let jobQueue, MockBull, MockObjectHash, MockAdd, MockGetJob, MockObliterate, MockProcess,
    MockDecrypt, MockEncrypt, MockHash, MockClean, MockOn, sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    MockObjectHash = sandbox.stub();
    MockAdd = sandbox.stub();
    MockGetJob = sandbox.stub();
    MockProcess = sandbox.stub();
    MockClean = sandbox.stub();
    MockObliterate = sandbox.stub();
    MockDecrypt = sandbox.stub();
    MockEncrypt = sandbox.stub();
    MockHash = sandbox.stub();
    MockOn = sandbox.stub().callsArgWith(1, 'a job id', 'a result string');

    MockBull = sandbox.stub().returns({
      add: MockAdd,
      getJob: MockGetJob,
      process: MockProcess,
      obliterate: MockObliterate,
      clean: MockClean,
      on: MockOn
    });

    const JobQueueMod = proxyquire('./job-queue', {
      'bull': MockBull,
      '@sockethub/crypto': {
        objectHash: MockObjectHash,
        decrypt: MockDecrypt,
        hash: MockHash,
        encrypt: MockEncrypt
      }
    });
    const JobQueue = JobQueueMod.default;
    jobQueue = new JobQueue('a parent id', 'a session id', 'a secret', 'redis config');
    jobQueue.emit = sandbox.stub();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns a valid JobQueue object', () => {
    sinon.assert.calledOnce(MockBull);
    sinon.assert.calledWith(MockBull,
      'a parent ida session id', { redis: 'redis config' }
    );
    expect(typeof jobQueue).to.equal('object');
    expect(jobQueue.uid).to.equal(`sockethub:data-layer:job-queue:a parent id:a session id`);
    expect(typeof jobQueue.add).to.equal('function');
    expect(typeof jobQueue.getJob).to.equal('function');
    expect(typeof jobQueue.onJob).to.equal('function');
    expect(typeof jobQueue.shutdown).to.equal('function');
    sinon.assert.calledThrice(MockOn);
    sinon.assert.calledOnceWithExactly(MockGetJob, 'a job id')
  });


  describe('createJob', () => {
    it('returns expected job format', () => {
      MockEncrypt.returns('an encrypted message');
      const job = jobQueue.createJob('a socket id', {
        context: 'some context',
        id: 'an identifier'
      });
      expect(job).to.eql({
        title: 'some context-an identifier',
        msg: 'an encrypted message',
        sessionId: 'a socket id'
      })
    })
    it('uses counter when no id provided', () => {
      MockEncrypt.returns('an encrypted message');
      let job = jobQueue.createJob('a socket id', {
        context: 'some context'
      });
      expect(job).to.eql({
        title: 'some context-0',
        msg: 'an encrypted message',
        sessionId: 'a socket id'
      });
      job = jobQueue.createJob('a socket id', {
        context: 'some context'
      });
      expect(job).to.eql({
        title: 'some context-1',
        msg: 'an encrypted message',
        sessionId: 'a socket id'
      });
    })
  });

  describe('add', () => {
    it('stores encrypted job', () => {
      MockEncrypt.returns('encrypted foo')
      const res = jobQueue.add(
        'a socket id', {context: 'a platform', id: 'an identifier'}
      );
      const resultJob = {title: 'a platform-an identifier', sessionId: 'a socket id', msg: 'encrypted foo'}
      sinon.assert.calledOnceWithExactly(MockAdd,
        resultJob);
      expect(res).to.eql(resultJob);
    })
  });

  describe('getJob', () => {
    const encryptedJob = {
      data: {
        title: 'a title',
        msg: 'an encrypted msg',
        sessionId: 'a socket id'
      }
    };

    it('handles fetching a valid job', async () => {
      MockGetJob.returns(encryptedJob);
      MockDecrypt.returns('an unencrypted message')
      const job = await jobQueue.getJob('a valid job');
      sinon.assert.calledTwice(MockGetJob);
      sinon.assert.calledWith(MockGetJob, 'a valid job');
      encryptedJob.data.msg = 'an unencrypted message';
      expect(job).to.eql(encryptedJob);
    });

    it('handles fetching an invalid job', async () => {
      MockGetJob.reset();
      MockGetJob.returns(undefined);
      const job = await jobQueue.getJob('an invalid job');
      expect(job).to.eql(undefined);
      sinon.assert.calledOnceWithExactly(MockGetJob, 'an invalid job');
      sinon.assert.notCalled(MockDecrypt)
    });
  });

  describe('onJob', () => {
    it('queues the handler', () => {
      jobQueue.onJob((job, done) => {
        throw new Error('This handler should never be called');
      });
      sinon.assert.calledOnce(MockProcess);
    });
  });

  describe('shutdown', () => {
    it('calls both clean and obliterate', async () => {
      await jobQueue.shutdown()
      sinon.assert.calledOnce(MockClean);
      sinon.assert.calledOnce(MockObliterate);
    });
  });


  describe('jobHandler', () => {
    it('calls handler as expected', (done) => {
      MockDecrypt.returns('an unencrypted message');
      const encryptedJob = {
        data: {
          title: 'a title',
          msg: 'an encrypted message',
          sessionId: 'a socket id'
        }
      };
      jobQueue.onJob((job, cb) => {
        const decryptedData = encryptedJob.data;
        decryptedData.msg = 'an unencrypted message'
        expect(job).to.eql(decryptedData);
        cb();
      });
      sinon.assert.calledOnce(MockProcess);
      jobQueue.jobHandler(encryptedJob, done);
    });
  });

  describe("decryptJobData", () => {
    it("decrypts and returns expected object", () => {
      MockDecrypt.returnsArg(0);
      const jobData = {data:{title:"foo", msg:'encryptedjobdata', sessionId:'foobar'}};
      const secret = 'secretstring';
      expect(jobQueue.decryptJobData(jobData, secret)).to.be.eql(jobData.data);
    });
  });
});
