"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const rand_token_1 = __importDefault(require("rand-token"));
const kue_1 = __importDefault(require("kue"));
const activity_streams_1 = __importDefault(require("activity-streams"));
const config_1 = __importDefault(require("./config"));
const crypto_1 = __importDefault(require("./crypto"));
const init_1 = __importDefault(require("./bootstrap/init"));
const middleware_1 = __importDefault(require("./middleware"));
const resource_manager_1 = __importDefault(require("./resource-manager"));
const services_1 = __importDefault(require("./services"));
const validate_1 = __importDefault(require("./validate"));
const shared_resources_1 = __importDefault(require("./shared-resources"));
const process_manager_1 = __importDefault(require("./process-manager"));
const common_1 = require("./common");
const log = debug_1.default('sockethub:core  '), activity = activity_streams_1.default(config_1.default.get('activity-streams:opts'));
function getMiddleware(socket, sessionLog) {
    return new middleware_1.default((err, type, msg) => {
        sessionLog('validation failed for ' + type + '. ' + err, msg);
        // called with validation fails
        if (typeof msg !== 'object') {
            msg = { context: 'error' };
        }
        msg.error = err;
        // send failure
        socket.emit('failure', msg);
    });
}
function getPlatformInstance(msg) {
    if ((typeof msg.actor !== 'object') || (!msg.actor['@id'])) {
        return;
    }
    const platformInstance = shared_resources_1.default.platformInstances.get(common_1.getPlatformId(msg.context, msg.actor['@id']));
    if (!platformInstance) {
        return false;
    }
    return platformInstance;
}
class Sockethub {
    constructor() {
        this.counter = 0;
        this.platforms = init_1.default.platforms;
        this.status = false;
        this.parentId = rand_token_1.default.generate(16);
        this.parentSecret1 = rand_token_1.default.generate(16);
        this.parentSecret2 = rand_token_1.default.generate(16);
        this.processManager = new process_manager_1.default(this.parentId, this.parentSecret1, this.parentSecret2);
        log('sockethub session id: ' + this.parentId);
    }
    /**
     * initialization of sockethub starts here
     */
    boot() {
        if (this.status) {
            return log('Sockethub.boot() called more than once');
        }
        else {
            this.status = true;
        }
        resource_manager_1.default.start();
        // start internal and external services
        this.queue = services_1.default.startQueue(this.parentId);
        this.io = services_1.default.startExternal();
        log('registering handlers');
        this.queue.on('job complete', this.handleJobResult('completed'));
        this.queue.on('job failed', this.handleJobResult('failed'));
        this.io.on('connection', this.incomingConnection.bind(this));
    }
    removeAllPlatformInstances() {
        for (let platform of shared_resources_1.default.platformInstances.values()) {
            platform.destroy();
        }
    }
    // send message to every connected socket associated with the given platform instance.
    broadcastToSharedPeers(origSocket, msg) {
        log(`broadcasting called, originating socket ${origSocket}`);
        const platformInstance = getPlatformInstance(msg);
        if (!platformInstance) {
            return;
        }
        for (let sessionId of platformInstance.sessions.values()) {
            if (sessionId !== origSocket) {
                log(`broadcasting message to ${sessionId}`);
                console.log(this.io.sockets.connected);
                if (this.io.sockets.connected[sessionId]) {
                    this.io.sockets.connected[sessionId].emit('message', msg);
                }
            }
        }
    }
    ;
    handleActivityObject(sessionLog) {
        return (obj) => {
            sessionLog('processing activity-object');
            activity.Object.create(obj);
        };
    }
    ;
    // handle job results coming in on the queue from platform instances
    handleJobResult(type) {
        return (id, result) => {
            kue_1.default.Job.get(id, (err, job) => {
                if (err) {
                    return log(`error retrieving (${type}) job #${id}`);
                }
                if (this.io.sockets.connected[job.data.socket]) {
                    job.data.msg = crypto_1.default.decrypt(job.data.msg, this.parentSecret1 + this.parentSecret2);
                    delete job.data.msg.sessionSecret;
                    if (type === 'completed') { // let all related peers know of result
                        this.broadcastToSharedPeers(job.data.socket, job.data.msg);
                    }
                    if (result) {
                        if (type === 'completed') {
                            job.data.msg.message = result;
                        }
                        else if (type === 'failed') {
                            job.data.msg.object = {
                                '@type': 'error',
                                content: result
                            };
                        }
                    }
                    log(`job #${job.id} on socket ${job.data.socket} ${type}`);
                    this.io.sockets.connected[job.data.socket].emit(type, job.data.msg);
                }
                else {
                    log(`received (${type}) job for non-existent socket ${job.data.socket}`);
                }
                job.remove((err) => {
                    if (err) {
                        log(`error removing (${type}) job #${job.id}, ${err}`);
                    }
                });
            });
        };
    }
    handleIncomingMessage(socket, store, sessionLog) {
        return (msg) => {
            const identifier = this.processManager.register(msg, socket.id);
            sessionLog(`queueing incoming job ${msg.context} for socket 
        ${socket.id} to chanel ${identifier}`);
            const job = this.queue.create(identifier, {
                title: socket.id + '-' + msg.context + '-' + (msg['@id']) ? msg['@id'] : this.counter++,
                socket: socket.id,
                msg: crypto_1.default.encrypt(msg, this.parentSecret1 + this.parentSecret2)
            }).save((err) => {
                if (err) {
                    sessionLog('error adding job [' + job.id + '] to queue: ', err);
                }
            });
        };
    }
    ;
    handleStoreCredentials(store, sessionLog) {
        return (creds) => {
            store.save(creds.actor['@id'], creds, (err) => {
                if (err) {
                    sessionLog('error saving credentials to store ' + err);
                }
                else {
                    sessionLog('credentials encrypted and saved with key: ' + creds.actor['@id']);
                }
            });
        };
    }
    ;
    incomingConnection(socket) {
        const sessionLog = debug_1.default('sockethub:core  :' + socket.id), // session-specific debug messages
        sessionSecret = rand_token_1.default.generate(16), 
        // store instance is session-specific
        store = common_1.getSessionStore(this.parentId, this.parentSecret1, socket.id, sessionSecret), middleware = getMiddleware(socket, sessionLog);
        sessionLog('connected to socket.io channel ' + socket.id);
        shared_resources_1.default.sessionConnections.set(socket.id, socket);
        socket.on('disconnect', () => {
            sessionLog('disconnect received from client.');
            shared_resources_1.default.sessionConnections.delete(socket.id);
        });
        socket.on('credentials', middleware.chain(validate_1.default('credentials'), this.handleStoreCredentials(store, sessionLog)));
        socket.on('message', middleware.chain(validate_1.default('message'), (next, msg) => {
            // middleware which attaches the sessionSecret to the message. The platform thread
            // must find the credentials on their own using the given sessionSecret, which indicates
            // that this specific session (socket connection) has provided credentials.
            msg.sessionSecret = sessionSecret;
            next(true, msg);
        }, this.handleIncomingMessage(socket, store, sessionLog)));
        // when new activity objects are created on the client side, an event is
        // fired and we receive a copy on the server side.
        socket.on('activity-object', middleware.chain(validate_1.default('activity-object'), this.handleActivityObject(sessionLog)));
    }
}
exports.default = Sockethub;
//# sourceMappingURL=sockethub.js.map