"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const eventemitter2_1 = require("eventemitter2");
const activity_streams_1 = __importDefault(require("@sockethub/activity-streams"));
class SockethubClient {
    constructor(socket) {
        this.events = {
            'credentials': new Map(),
            'activity-object': new Map(),
            'connect': new Map(),
            'join': new Map()
        };
        this.ActivityStreams = (0, activity_streams_1.default)({ specialObjs: ['credentials'] });
        this.online = false;
        this.debug = true;
        if (!socket) {
            throw new Error('SockethubClient requires a socket.io instance');
        }
        this._socket = socket;
        this.socket = this.createPublicEmitter();
        this.registerSocketIOHandlers();
        this.ActivityStreams.on('activity-object-create', (obj) => {
            socket.emit('activity-object', obj, (err) => {
                if (err) {
                    console.error('failed to create activity-object ', err);
                }
                else {
                    this.eventActivityObject(obj);
                }
            });
        });
        socket.on('activity-object', (obj) => {
            this.ActivityStreams.Object.create(obj);
        });
    }
    createPublicEmitter() {
        const socket = new eventemitter2_1.EventEmitter2({
            wildcard: true,
            verboseMemoryLeak: false
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        socket._emit = socket.emit;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        socket.emit = (event, content, callback) => {
            if (event === 'credentials') {
                this.eventCredentials(content);
            }
            else if (event === 'activity-object') {
                this.eventActivityObject(content);
            }
            else if (event === 'message') {
                this.eventMessage(content);
            }
            this._socket.emit(event, content, callback);
        };
        return socket;
    }
    eventActivityObject(content) {
        if (content.id) {
            this.events['activity-object'].set(content.id, content);
        }
    }
    eventCredentials(content) {
        if ((content.object) && (content.object.type === 'credentials')) {
            const key = content.actor.id || content.actor;
            this.events['credentials'].set(key, content);
        }
    }
    eventMessage(content) {
        if (!this.online) {
            return;
        }
        // either store or delete the specified content onto the storedJoins map,
        // for reply once we're back online.
        const key = SockethubClient.getKey(content);
        if (content.type === 'join' || content.type === 'connect') {
            this.events[content.type].set(key, content);
        }
        else if (content.type === 'leave') {
            this.events['join'].delete(key);
        }
        else if (content.type === 'disconnect') {
            this.events['connect'].delete(key);
        }
    }
    static getKey(content) {
        var _a;
        const actor = ((_a = content.actor) === null || _a === void 0 ? void 0 : _a.id) || content.actor;
        if (!actor) {
            throw new Error("actor property not present for message type: " + (content === null || content === void 0 ? void 0 : content.type));
        }
        const target = content.target ? content.target.id || content.target : '';
        return actor + '-' + target;
    }
    log(msg, obj) {
        if (this.debug) {
            // eslint-disable-next-line security-node/detect-crlf
            console.log(msg, obj);
        }
    }
    registerSocketIOHandlers() {
        // middleware for events which don't deal in AS objects
        const callHandler = (event) => {
            return (obj, cb) => {
                if (event === 'connect') {
                    this.online = true;
                    this.replay('activity-object', this.events['activity-object']);
                    this.replay('credentials', this.events['credentials']);
                    this.replay('message', this.events['connect']);
                    this.replay('message', this.events['join']);
                }
                else if (event === 'disconnect') {
                    this.online = false;
                }
                this.socket._emit(event, obj, cb);
            };
        };
        // register for events that give us information on connection status
        this._socket.on('connect', callHandler('connect'));
        this._socket.on('connect_error', callHandler('connect_error'));
        this._socket.on('disconnect', callHandler('disconnect'));
        // use as a middleware to receive incoming Sockethub messages and unpack them
        // using the ActivityStreams library before passing them along to the app.
        this._socket.on('message', (obj, cb) => {
            this.socket._emit('message', this.ActivityStreams.Stream(obj), cb);
        });
    }
    replay(name, asMap) {
        asMap.forEach((obj) => {
            this.log(`replaying ${name}`, obj);
            this._socket.emit(name, obj);
        });
    }
}
exports.default = SockethubClient;
//# sourceMappingURL=/sockethub-client.js.map