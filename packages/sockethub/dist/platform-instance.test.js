"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const platform_instance_1 = __importDefault(require("./platform-instance"));
const shared_resources_1 = __importDefault(require("./shared-resources"));
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
            handlers[handler] = jest.spyOn(platform_instance_1.default.prototype, handler);
        }
        pi = new platform_instance_1.default('platform identifier', 'a platform name', 'the parentId');
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
        expect(child_process_1.fork).toBeCalledWith(FORK_PATH, [
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
        expect(shared_resources_1.default.platformInstances.delete).toBeCalledWith('platform identifier');
    });
    it('should update identifier', () => {
        pi.updateIdentifier('foo bar');
        expect(pi.id).toBe('foo bar');
        expect(shared_resources_1.default.platformInstances.delete).toBeCalledWith('platform identifier');
        expect(shared_resources_1.default.platformInstances.set).toBeCalledWith('foo bar', pi);
    });
    it('should send message to client using socket', () => {
        pi.sendToClient('my session id', { foo: 'this is a message object' });
        expect(shared_resources_1.default.sessionConnections.get).toBeCalledWith('my session id');
    });
});
describe('test private instance per-actor', () => {
    it("should have actor set and be non-global when provided", () => {
        const pi = new platform_instance_1.default('id', 'name', 'parentId', 'actor string');
        expect(pi.global).toBe(false);
        expect(child_process_1.fork).toBeCalledWith(FORK_PATH, ['parentId', 'name', 'id']);
    });
});
//# sourceMappingURL=platform-instance.test.js.map