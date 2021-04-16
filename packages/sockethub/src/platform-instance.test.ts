
import { fork } from 'child_process';
import Queue from 'bull';

import PlatformInstance, { PlatformInstanceParams } from "./platform-instance";
import SharedResources from "./shared-resources";

jest.mock('./crypto');
jest.mock('child_process');
jest.mock('ioredis');
jest.mock('bull');
jest.mock('./shared-resources', () => ({
  __esModule: true,
  default: {
    sessionConnections: {
      get: jest.fn().mockImplementation(() => {
        return { emit: jest.fn() };
      })
    },
    platformInstances: {
      delete: jest.fn(),
      set: jest.fn()
    }
  }
}));

const FORK_PATH = __dirname + '/platform.js';

describe("PlatformInstance", () => {
  let pi;
  let handlers = {
    'callbackFunction': undefined
  };

  beforeEach(() => {
    for (let handler of Object.keys(handlers)) {
      handlers[handler] = jest.spyOn(
        PlatformInstance.prototype as any, handler);
    }

    const params: PlatformInstanceParams = {
      identifier: 'platform identifier',
      platform: 'a platform name',
      parentId: 'the parentId'
    };
    pi = new PlatformInstance(params);

    pi.process = {
      on: jest.fn().mockName('pi.process.on'),
      removeListener: jest.fn().mockName('pi.process.removeListener'),
      removeAllListeners: jest.fn().mockName('pi.process.removeAllListeners'),
      unref: jest.fn().mockName('pi.process.unref'),
      kill: jest.fn().mockName('pi.process.kill'),
    };
  });

  afterEach(() => {
    pi.destroy();
  });

  it("has certain accessible properties", () => {
    expect(pi.id).toBe('platform identifier');
    expect(pi.name).toBe('a platform name');
    expect(pi.parentId).toBe('the parentId');
    expect(pi.flaggedForTermination).toBe(false);
    expect(pi.global).toBe(true);
    expect(fork).toBeCalledWith(FORK_PATH, [
      'the parentId', 'a platform name', 'platform identifier'
    ]);
  });

  it('adds a close and message handler when a session is registered', () => {
    pi.registerSession('my session id');
    expect(handlers.callbackFunction).nthCalledWith(1, 'close', 'my session id');
    expect(handlers.callbackFunction).nthCalledWith(2, 'message', 'my session id');
    expect(pi.sessions.has('my session id')).toBe(true);
  });

  it('is able to generate failure reports', () => {
    pi.registerSession('my session id');
    expect(pi.sessions.has('my session id')).toBe(true);
    pi.reportError('my session id', 'an error message');
    pi.sendToClient = jest.fn();
    pi.destroy = jest.fn();
    expect(pi.sessions.size).toBe(0);
  });

  it('initializes the job queue', () => {
    pi.initQueue('a secret');
    expect(pi.queue).toBeInstanceOf(Queue);
  });

  it("cleans up its references when destroyed", () => {
    pi.destroy();
    expect(SharedResources.platformInstances.delete).toBeCalledWith('platform identifier');
  });

  it("updates its identifier when changed", () => {
    pi.updateIdentifier('foo bar');
    expect(pi.id).toBe('foo bar');
    expect(SharedResources.platformInstances.delete).toBeCalledWith('platform identifier');
    expect(SharedResources.platformInstances.set).toBeCalledWith('foo bar', pi);
  });

  it('sends messages to client using socket session id', () => {
    pi.sendToClient('my session id', 'message', {foo: 'this is a message object',
      sessionSecret: 'private data'});
    expect(SharedResources.sessionConnections.get).toBeCalledWith('my session id');
  });

  it('broadcasts to peers', () => {
    pi.sessions.add('other peer');
    pi.broadcastToSharedPeers('myself', {foo: 'bar'});
    expect(SharedResources.sessionConnections.get).toBeCalledWith('other peer');
  });

  it('broadcasts to peers when handling a completed job', () => {
    pi.sessions.add('other peer');
    pi.handleJobResult('completed', {data: {msg: {foo: 'bar'}}, remove: function () {}},
      undefined);
    expect(SharedResources.sessionConnections.get).toBeCalledWith('other peer');
  });

  it('appends completed result message when present', () => {
    pi.sendToClient = jest.fn();
    pi.broadcastToSharedPeers = jest.fn();
    pi.handleJobResult('completed', {data: {msg: {foo: 'bar'}}, remove: function () {}},
      'a good result message');
    expect(pi.broadcastToSharedPeers).toHaveBeenCalled();
    expect(pi.sendToClient).toHaveBeenCalledWith(undefined, 'completed',
      {foo: 'bar', object: {'@type': 'result', content: 'a good result message'}});
  });

  it('appends failed result message when present', () => {
    pi.sendToClient = jest.fn();
    pi.broadcastToSharedPeers = jest.fn();
    pi.handleJobResult('failed', {data: {msg: {foo: 'bar'}}, remove: function () {}},
      'a bad result message');
    expect(pi.broadcastToSharedPeers).toHaveBeenCalled();
    expect(pi.sendToClient).toHaveBeenCalledWith(undefined, 'failed',
      {foo: 'bar', object: {'@type': 'error', content: 'a bad result message'}});
  });

  it('close events from platform thread are reported', () => {
    pi.reportError = jest.fn();
    const close = pi.callbackFunction('close', 'my session id');
    close('error msg');
    expect(pi.reportError).toHaveBeenCalledWith(
      'my session id', 'Error: session thread closed unexpectedly: error msg');
  });

  it('message events from platform thread are route based on command: error', () => {
    pi.reportError = jest.fn();
    const message = pi.callbackFunction('message', 'my session id');
    message(['error', 'error message']);
    expect(pi.reportError).toHaveBeenCalledWith(
      'my session id', 'error message');
  });

  it('message events from platform thread are route based on command: updateActor', () => {
    pi.updateIdentifier = jest.fn();
    const message = pi.callbackFunction('message', 'my session id');
    message(['updateActor', undefined, {foo: 'bar'}]);
    expect(pi.updateIdentifier).toHaveBeenCalledWith({foo:'bar'});
  });

  it('message events from platform thread are route based on command: else', () => {
    pi.sendToClient = jest.fn();
    const message = pi.callbackFunction('message', 'my session id');
    message(['blah', {foo: 'bar'}]);
    expect(pi.sendToClient).toHaveBeenCalledWith(
      'my session id', 'message', {foo:'bar'});
  });
});


describe('private instance per-actor', () => {
  it("is set as non-global when an actor is provided", () => {
    const params: PlatformInstanceParams = {
      identifier: 'id',
      platform: 'name',
      parentId: 'parentId',
      actor: 'actor string'
    };
    const pi = new PlatformInstance(params);
    expect(pi.global).toBe(false);
    expect(fork).toBeCalledWith(FORK_PATH, ['parentId', 'name', 'id']);
    pi.destroy();
  });
});
