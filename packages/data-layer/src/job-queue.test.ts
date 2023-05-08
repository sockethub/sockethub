import proxyquire from 'proxyquire';
import { expect } from 'chai';
import * as sinon from 'sinon';

proxyquire.noPreserveCache();
proxyquire.noCallThru();

describe('JobQueue', () => {
  let jobQueue, MockBull, bullMocks, cryptoMocks, sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    cryptoMocks = {
      objectHash: sandbox.stub(),
      decrypt: sandbox.stub(),
      encrypt: sandbox.stub(),
      hash: sandbox.stub(),
    };
    bullMocks = {
      add: sandbox.stub(),
      getJob: sandbox.stub(),
      process: sandbox.stub(),
      removeAllListeners: sandbox.stub(),
      pause: sandbox.stub(),
      resume: sandbox.stub(),
      isPaused: sandbox.stub(),
      obliterate: sandbox.stub(),
      emit: sandbox.stub(),
      on: sandbox.stub().callsArgWith(1, 'a job id', 'a result string')
    };
    MockBull = sandbox.stub().returns(bullMocks);
    const JobQueueMod = proxyquire('./job-queue', {
      'bull': MockBull,
      '@sockethub/crypto': cryptoMocks
    });
    const JobQueue = JobQueueMod.default;
    jobQueue = new JobQueue('a parent id', 'a session id', 'a secret', 'redis config');
    jobQueue.emit = sandbox.stub();
  });

  afterEach(() => {
    sinon.restore();
    sandbox.reset();
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
  });

  describe('initResultEvents', () => {
    it('registers handlers when called', () => {
      bullMocks.on.reset();
      jobQueue.initResultEvents();
      expect(bullMocks.on.callCount).to.eql(4);
      sinon.assert.calledWith(bullMocks.on, 'global:completed');
      sinon.assert.calledWith(bullMocks.on, 'global:error');
      sinon.assert.calledWith(bullMocks.on, 'global:failed');
      sinon.assert.calledWith(bullMocks.on, 'failed');
    });
  });

  describe('createJob', () => {
    it('returns expected job format', () => {
      cryptoMocks.encrypt.returns('an encrypted message');
      const job = jobQueue.createJob('a socket id', {
        context: 'some context',
        id: 'an identifier'
      });
      expect(job).to.eql({
        title: 'some context-an identifier',
        msg: 'an encrypted message',
        sessionId: 'a socket id'
      });
    });

    it('uses counter when no id provided', () => {
      cryptoMocks.encrypt.returns('an encrypted message');
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
    });
  });

  describe('add', () => {
    it('stores encrypted job', async () => {
      cryptoMocks.encrypt.returns('encrypted foo');
      bullMocks.isPaused.returns(false);
      const resultJob = {title: 'a platform-an identifier', sessionId: 'a socket id', msg: 'encrypted foo'};
      const res = await jobQueue.add(
        'a socket id', {context: 'a platform', id: 'an identifier'}
      );
      sinon.assert.calledOnce(bullMocks.isPaused);
      sinon.assert.notCalled(bullMocks.emit);
      sinon.assert.calledOnceWithExactly(bullMocks.add,
        resultJob);
      expect(res).to.eql(resultJob);
    });
    it('fails job if queue paused', async () => {
      cryptoMocks.encrypt.returns('encrypted foo');
      bullMocks.isPaused.returns(true);
      const resultJob = {title: 'a platform-an identifier', sessionId: 'a socket id', msg: 'encrypted foo'};
      const res = await jobQueue.add(
        'a socket id', {context: 'a platform', id: 'an identifier'}
      );
      sinon.assert.calledOnce(bullMocks.isPaused);
      sinon.assert.calledOnceWithExactly(bullMocks.emit, 'failed', resultJob, 'queue closed');
      sinon.assert.notCalled(bullMocks.add);
      expect(res).to.be.undefined;
    });
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
      bullMocks.getJob.returns(encryptedJob);
      cryptoMocks.decrypt.returns('an unencrypted message');
      const job = await jobQueue.getJob('a valid job');
      sinon.assert.calledOnceWithExactly(bullMocks.getJob, 'a valid job');
      encryptedJob.data.msg = 'an unencrypted message';
      expect(job).to.eql(encryptedJob);
    });

    it('handles fetching an invalid job', async () => {
      bullMocks.getJob.returns(undefined);
      const job = await jobQueue.getJob('an invalid job');
      expect(job).to.eql(undefined);
      sinon.assert.calledOnceWithExactly(bullMocks.getJob, 'an invalid job');
      sinon.assert.notCalled(cryptoMocks.decrypt);
    });

    it('removes sessionSecret', async () => {
      bullMocks.getJob.returns(encryptedJob);
      cryptoMocks.decrypt.returns({
        foo:'bar',
        sessionSecret: 'yarg'
      });
      const job = await jobQueue.getJob('a valid job');
      sinon.assert.calledOnceWithExactly(bullMocks.getJob, 'a valid job');
      // @ts-ignore
      encryptedJob.data.msg = {
        foo:'bar'
      };
      expect(job).to.eql(encryptedJob);
    });
  });

  describe('onJob', () => {
    it('queues the handler', () => {
      jobQueue.onJob((job, done) => {
        throw new Error('This handler should never be called');
      });
      sinon.assert.calledOnce(bullMocks.process);
    });
  });

  it('pause', async () => {
    await jobQueue.pause();
    sinon.assert.calledOnce(bullMocks.pause);
  });

  it('resume', async () => {
    await jobQueue.resume();
    sinon.assert.calledOnce(bullMocks.resume);
  });

  describe('shutdown', () => {
    it('is sure to pause when not already paused', async () => {
      bullMocks.isPaused.returns(false);
      await jobQueue.shutdown();
      sinon.assert.calledOnce(bullMocks.isPaused);
      sinon.assert.calledOnce(bullMocks.pause);
      sinon.assert.calledOnce(bullMocks.removeAllListeners);
      sinon.assert.calledOnce(bullMocks.obliterate);
    });
    it('skips pausing when already paused', async () => {
      bullMocks.isPaused.returns(true);
      await jobQueue.shutdown();
      sinon.assert.calledOnce(bullMocks.isPaused);
      sinon.assert.notCalled(bullMocks.pause);
      sinon.assert.calledOnce(bullMocks.removeAllListeners);
      sinon.assert.calledOnce(bullMocks.obliterate);
    });
  });

  describe('jobHandler', () => {
    it('calls handler as expected', (done) => {
      cryptoMocks.decrypt.returns('an unencrypted message');
      const encryptedJob = {
        data: {
          title: 'a title',
          msg: 'an encrypted message',
          sessionId: 'a socket id'
        }
      };
      jobQueue.onJob((job, cb) => {
        const decryptedData = encryptedJob.data;
        decryptedData.msg = 'an unencrypted message';
        expect(job).to.eql(decryptedData);
        cb();
      });
      sinon.assert.calledOnce(bullMocks.process);
      jobQueue.jobHandler(encryptedJob, done);
    });
  });

  describe("decryptJobData", () => {
    it("decrypts and returns expected object", () => {
      cryptoMocks.decrypt.returnsArg(0);
      const jobData = {data:{title:"foo", msg:'encryptedjobdata', sessionId:'foobar'}};
      const secret = 'secretstring';
      expect(jobQueue.decryptJobData(jobData, secret)).to.be.eql(jobData.data);
    });
  });

  describe("decryptActivityStream", () => {
    it("decrypts and returns expected object", () => {
      cryptoMocks.decrypt.returnsArg(0);
      const jobData = 'encryptedjobdata';
      const secret = 'secretstring';
      expect(jobQueue.decryptActivityStream(jobData, secret)).to.be.eql(jobData);
    });
  });
});
