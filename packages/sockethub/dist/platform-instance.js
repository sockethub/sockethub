"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const shared_resources_1 = __importDefault(require("./shared-resources"));
class PlatformInstance {
    constructor(id, name, parentId, actor) {
        this.flaggedForTermination = false;
        this.sessions = new Set();
        this.listeners = {
            'close': (() => new Map())(),
            'message': (() => new Map())(),
        };
        this.id = id;
        this.name = name;
        this.parentId = parentId;
        this.actor = actor;
        // spin off a process
        this.process = child_process_1.fork('dist/platform.js', [parentId, name, id]);
    }
    registerSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.add(sessionId);
            this.registerListeners(sessionId);
        }
    }
    deregisterSession(sessionId) {
        shared_resources_1.default.helpers.removePlatform(this);
        this.sessions.delete(sessionId);
        this.deregisterListeners(sessionId);
    }
    sendToClient(sessionId, msg) {
        // XXX TODO
        console.log('sendToClient called ', msg);
    }
    deregisterListeners(sessionId) {
        for (let key of Object.keys(this.listeners)) {
            this.process.removeListener(key, this.listeners[key].get(sessionId));
            this.listeners[key].delete(sessionId);
        }
    }
    registerListeners(sessionId) {
        for (let key of Object.keys(this.listeners)) {
            const listenerFunc = this.listenerFunction(key, sessionId);
            this.process.on(key, listenerFunc);
            this.listeners[key].set(sessionId, listenerFunc);
        }
    }
    listenerFunction(key, sessionId) {
        const funcs = {
            'close': (e) => {
                console.log('close even triggered ' + this.id);
                this.sendToClient(sessionId, {
                    context: this.name,
                    '@type': 'error',
                    target: this.actor || {},
                    object: {
                        '@type': 'error',
                        content: e
                    }
                });
                this.deregisterSession(sessionId);
            },
            'message': (msg) => {
                this.sendToClient(sessionId, msg);
            }
        };
        return funcs[key];
    }
}
exports.default = PlatformInstance;
//# sourceMappingURL=platform-instance.js.map