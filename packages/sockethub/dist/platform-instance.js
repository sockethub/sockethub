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
        if (actor) {
            this.actor = actor;
        }
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
        const socket = shared_resources_1.default.sessionConnections.get(sessionId);
        if (socket) { // send message
            msg.context = this.name;
            // this.log(`sending message to socket ${sessionId}`);
            socket.emit('message', msg);
        }
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
    /**
     * Sends error message to client and clears all references to this class.
     * @param sessionId
     * @param errorMessage
     */
    reportFailure(sessionId, errorMessage) {
        const errorObject = {
            context: this.name,
            '@type': 'error',
            target: this.actor || {},
            object: {
                '@type': 'error',
                content: errorMessage
            }
        };
        this.sendToClient(sessionId, errorObject);
        this.sessions.clear();
        this.flaggedForTermination = true;
        shared_resources_1.default.helpers.removePlatform(this);
    }
    listenerFunction(key, sessionId) {
        const funcs = {
            'close': (e) => {
                console.log('close even triggered ' + this.id);
                this.reportFailure(sessionId, `Error: session thread closed unexpectedly`);
            },
            'message': (data) => {
                if (data[0] === 'updateCredentials') {
                    // TODO FIXME - handle the case where a user changes their credentials
                    //  (username or password). We need to update the store.
                }
                else if (data[0] === 'error') {
                    this.reportFailure(sessionId, data[1]);
                }
                else {
                    // treat like a message to clients
                    console.log("handle", data[1]);
                    this.sendToClient(sessionId, data[1]);
                }
            }
        };
        return funcs[key];
    }
}
exports.default = PlatformInstance;
//# sourceMappingURL=platform-instance.js.map