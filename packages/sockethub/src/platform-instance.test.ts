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
    helpers: {
      removePlatform: jest.fn()
    }
  }
}));

const FORK_PATH = __dirname + '/platform.js';

describe("PlatformInstance", () => {
  let pi;
  let handlers = {
    'registerListeners': undefined,
    'deregisterListeners': undefined,
    'listenerFunction': undefined
  };

  beforeEach(() => {
    for (let handler of Object.keys(handlers)) {
      handlers[handler] = jest.spyOn(
        PlatformInstance.prototype as any, handler);
    }

    pi = new PlatformInstance('id', 'name', 'parentId');

    pi.process = {
      on: jest.fn().mockName('pi.process.on'),
      removeListener: jest.fn().mockName('pi.process.removeListener')
    };
  });

  it("should provided have properties set and be global", () => {
    expect(pi.id).toBe('id');
    expect(pi.name).toBe('name');
    expect(pi.parentId).toBe('parentId');
    expect(pi.flaggedForTermination).toBe(false);
    expect(pi.global).toBe(true);
    expect(fork).toBeCalledWith(FORK_PATH, ['parentId', 'name', 'id']);
  });

  it('should register a listener when a session is registered', () => {
    pi.registerSession('my session id');
    expect(handlers.registerListeners).toBeCalledWith('my session id');
    expect(handlers.listenerFunction).nthCalledWith(1, 'close', 'my session id');
    expect(handlers.listenerFunction).nthCalledWith(2, 'message', 'my session id');
  });

  it('should deregister listener when a session is given', () => {
    pi.deregisterSession('my session id');
    expect(handlers.deregisterListeners).toBeCalledWith('my session id');
    expect(handlers.listenerFunction).nthCalledWith(1, 'close', 'my session id');
    expect(handlers.listenerFunction).nthCalledWith(2, 'message', 'my session id');
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