import { fork } from 'child_process';
import { debug } from 'debug';

import PlatformInstance from "./platform-instance";
import SharedResources from "./shared-resources";

jest.mock('child_process');
jest.mock('debug');
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

    pi = new PlatformInstance('platform identifier', 'a platform name', 'the parentId');

    pi.process = {
      on: jest.fn().mockName('pi.process.on'),
      removeListener: jest.fn().mockName('pi.process.removeListener'),
      removeAllListeners: jest.fn().mockName('pi.process.removeAllListeners'),
      unref: jest.fn().mockName('pi.process.unref'),
      kill: jest.fn().mockName('pi.process.kill'),
    };
  });

  it("should provided have properties set and be global", () => {
    expect(pi.id).toBe('platform identifier');
    expect(pi.name).toBe('a platform name');
    expect(pi.parentId).toBe('the parentId');
    expect(pi.flaggedForTermination).toBe(false);
    expect(pi.global).toBe(true);
    expect(fork).toBeCalledWith(FORK_PATH, [
      'the parentId', 'a platform name', 'platform identifier'
    ]);
  });

  it('should register a listener when a session is registered', () => {
    pi.registerSession('my session id');
    expect(handlers.callbackFunction).nthCalledWith(1, 'close', 'my session id');
    expect(handlers.callbackFunction).nthCalledWith(2, 'message', 'my session id');
    expect(pi.sessions.has('my session id')).toBe(true);
  });

  it('should generate a failure report', () => {
    pi.registerSession('my session id');
    expect(pi.sessions.has('my session id')).toBe(true);
    pi.reportFailure('my session id', 'an error message');
    pi.sendToClient = jest.fn();
    pi.destroy = jest.fn();
    expect(pi.sessions.size).toBe(0);
  });

  it('should destroy instance', () => {
    pi.destroy();
    expect(SharedResources.platformInstances.delete).toBeCalledWith('platform identifier');
  });

  it('should update identifier', () => {
    pi.updateIdentifier('foo bar');
    expect(pi.id).toBe('foo bar');
    expect(SharedResources.platformInstances.delete).toBeCalledWith('platform identifier');
    expect(SharedResources.platformInstances.set).toBeCalledWith('foo bar', pi);
  });

  it('should send message to client using socket', () => {
    pi.sendToClient('my session id', {foo: 'this is a message object'});
    expect(SharedResources.sessionConnections.get).toBeCalledWith('my session id');
  });
});

describe('test private instance per-actor', () => {
  it("should have actor set and be non-global when provided", () => {
    const pi = new PlatformInstance('id', 'name', 'parentId', 'actor string');
    expect(pi.global).toBe(false);
    expect(fork).toBeCalledWith(FORK_PATH, ['parentId', 'name', 'id']);
  });
});