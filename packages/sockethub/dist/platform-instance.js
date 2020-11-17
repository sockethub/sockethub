"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = require("path");
const debug_1 = require("debug");
const shared_resources_1 = __importDefault(require("./shared-resources"));
class PlatformInstance {
    constructor(id, name, parentId, actor) {
        this.flaggedForTermination = false;
        this.sessions = new Set();
        this.global = false;
        this.sessionCallbacks = {
            'close': (() => new Map())(),
            'message': (() => new Map())(),
        };
        this.id = id;
        this.name = name;
        this.parentId = parentId;
        if (actor) {
            this.actor = actor;
        }
        else {
            this.global = true;
        }
        this.debug = debug_1.debug(`sockethub:platform-instance:${this.id}`);
        // spin off a process
        this.process = child_process_1.fork(path_1.join(__dirname, 'platform.js'), [parentId, name, id]);
    }
    /**
     * Destroys all references to this platform instance, internal listeners and controlled processes
     */
    destroy() {
        this.flaggedForTermination = true;
        shared_resources_1.default.platformInstances.delete(this.id);
        this.process.removeAllListeners('close');
        try {
            this.process.unref();
            this.process.kill();
        }
        catch (e) {
            console.log(e);
        }
    }
    /**
     * Register listener to be called when the process emits a message.
     * @param sessionId ID of socket connection that will receive messages from platform emits
     */
    registerSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.add(sessionId);
            for (let type of Object.keys(this.sessionCallbacks)) {
                const cb = this.callbackFunction(type, sessionId);
                this.process.on(type, cb);
                this.sessionCallbacks[type].set(sessionId, cb);
            }
        }
    }
    /**
     * Sends a message to client (user), can be registered with an event emitted from the platform
     * process.
     * @param sessionId ID of the socket connection to send the message to
     * @param msg ActivityStream object to send to client
     */
    sendToClient(sessionId, msg) {
        const socket = shared_resources_1.default.sessionConnections.get(sessionId);
        if (socket) { // send message
            msg.context = this.name;
            // this.log(`sending message to socket ${sessionId}`);
            socket.emit('message', msg);
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
        this.destroy();
    }
    /**
     * Updates the instance with a new identifier, updating the platformInstances mapping as well.
     * @param identifier
     */
    updateIdentifier(identifier) {
        shared_resources_1.default.platformInstances.delete(this.id);
        this.id = identifier;
        shared_resources_1.default.platformInstances.set(this.id, this);
    }
    /**
     * Generates a function tied to a given client session (socket connection), the generated
     * function will be called for each session ID registered, for every platform emit.
     * @param listener
     * @param sessionId
     */
    callbackFunction(listener, sessionId) {
        const funcs = {
            'close': (e) => {
                this.debug('close even triggered ' + this.id);
                this.reportFailure(sessionId, `Error: session thread closed unexpectedly`);
            },
            'message': (data) => {
                if (data[0] === 'updateActor') {
                    // We need to update the key to the store in order to find it in the future.
                    this.updateIdentifier(data[2]);
                }
                else if (data[0] === 'error') {
                    this.reportFailure(sessionId, data[1]);
                }
                else {
                    // treat like a message to clients
                    this.debug(`handling ${data[1]['@type']} message from platform process`);
                    this.sendToClient(sessionId, data[1]);
                }
            }
        };
        return funcs[listener];
    }
}
exports.default = PlatformInstance;
//# sourceMappingURL=platform-instance.js.map