"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const rand_token_1 = __importDefault(require("rand-token"));
const kue_1 = __importDefault(require("kue"));
const secure_store_redis_1 = __importDefault(require("secure-store-redis"));
const activity_streams_1 = __importDefault(require("activity-streams"));
const config_1 = __importDefault(require("./config"));
const crypto_1 = __importDefault(require("./crypto"));
const init_1 = __importDefault(require("./bootstrap/init"));
const middleware_1 = __importDefault(require("./middleware"));
const resource_manager_1 = __importDefault(require("./resource-manager"));
const services_1 = __importDefault(require("./services"));
const validate_1 = __importDefault(require("./validate"));
const worker_1 = __importDefault(require("./worker"));
const shared_resources_1 = __importDefault(require("./shared-resources"));
const log = debug_1.default('sockethub:core  '), activity = activity_streams_1.default(config_1.default.get('activity-streams:opts'));
class Sockethub {
    constructor() {
        this.counter = 0;
        this.platforms = init_1.default.platforms;
        this.status = false;
        this.parentId = rand_token_1.default.generate(16);
        this.parentSecret1 = rand_token_1.default.generate(16);
        this.parentSecret2 = rand_token_1.default.generate(16);
        log('sockethub session id: ' + this.parentId);
    }
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
        this.queue.on('job complete', this.__processJobResult('completed'));
        this.queue.on('job failed', this.__processJobResult('failed'));
        this.io.on('connection', this.__handleNewConnection.bind(this));
    }
    // send message to every connected socket associated with the given platform instance.
    __broadcastToSharedPeers(origSocket, msg) {
        log(`broadcasting called, originating socket ${origSocket}`);
        const platformInstance = Sockethub.__getPlatformInstance(msg);
        if (!platformInstance) {
            return;
        }
        for (let socketId of platformInstance.sockets.values()) {
            if (socketId !== origSocket) {
                log(`broadcasting message to ${socketId}`);
                this.io.sockets.connected[socketId].emit('message', msg);
            }
        }
    }
    ;
    __getMiddleware(socket, sessionLog) {
        return new middleware_1.default((err, type, msg) => {
            sessionLog('validation failed for ' + type + '. ' + err, msg);
            // called with validation fails
            if (typeof msg !== 'object') {
                msg = {};
            }
            msg.error = err;
            // send failure
            socket.emit('failure', msg);
        });
    }
    ;
    static __getPlatformInstance(msg) {
        if ((typeof msg.actor !== 'object') || (!msg.actor['@id'])) {
            return;
        }
        const platformInstanceId = shared_resources_1.default.platformMappings.get(msg.actor['@id']);
        if (!platformInstanceId) {
            return false;
        }
        const platformInstance = shared_resources_1.default.platformInstances.get(platformInstanceId);
        if (!platformInstance) {
            return false;
        }
        return platformInstance;
    }
    ;
    __getStore(socket, workerSecret) {
        return new secure_store_redis_1.default({
            namespace: 'sockethub:' + this.parentId + ':worker:' + socket.id + ':store',
            secret: this.parentSecret1 + workerSecret,
            redis: config_1.default.get('redis')
        });
    }
    ;
    __getWorker(socket, workerSecret) {
        return new worker_1.default({
            parentId: this.parentId,
            parentSecret1: this.parentSecret1,
            parentSecret2: this.parentSecret2,
            workerSecret: workerSecret,
            socket: socket,
            platforms: [...this.platforms.keys()]
        });
    }
    ;
    __handlerActivityObject(sessionLog) {
        return (obj) => {
            sessionLog('processing activity-object');
            activity.Object.create(obj);
        };
    }
    ;
    // init worker, store and register listeners for a new client connection
    __handleNewConnection(socket) {
        const sessionLog = debug_1.default('sockethub:core  :' + socket.id), // session-specific debug messages
        workerSecret = rand_token_1.default.generate(16), worker = this.__getWorker(socket, workerSecret), store = this.__getStore(socket, workerSecret), // store instance is session-specific
        middleware = this.__getMiddleware(socket, sessionLog);
        sessionLog('connected to socket.io channel ' + socket.id);
        shared_resources_1.default.socketConnections.set(socket.id, socket);
        worker.boot();
        worker.onFailure((err) => {
            sessionLog('worker ' + socket.id + ' failure detected ' + err);
            shared_resources_1.default.socketConnections.delete(socket.id);
            sessionLog('disconnecting client socket');
            socket.disconnect(err);
        });
        socket.on('disconnect', () => {
            sessionLog('disconnect received from client.');
            worker.shutdown();
            shared_resources_1.default.socketConnections.delete(socket.id);
        });
        socket.on('credentials', middleware.chain(validate_1.default('credentials'), this.__handlerStoreCredentials(store, sessionLog)));
        socket.on('message', middleware.chain(validate_1.default('message'), this.__handlerQueueJob(socket, sessionLog)));
        // when new activity objects are created on the client side, an event is
        // fired and we receive a copy on the server side.
        socket.on('activity-object', middleware.chain(validate_1.default('activity-object'), this.__handlerActivityObject(sessionLog)));
    }
    ;
    __handlerQueueJob(socket, sessionLog) {
        return (msg) => {
            sessionLog('queueing incoming job ' + msg.context + ' for socket ' + socket.id);
            const job = this.queue.create(socket.id, {
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
    __handlerStoreCredentials(store, sessionLog) {
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
    // handle job results, from workers, in the queue
    __processJobResult(type) {
        return (id, result) => {
            kue_1.default.Job.get(id, (err, job) => {
                if (err) {
                    return log(`error retrieving (${type}) job #${id}`);
                }
                if (this.io.sockets.connected[job.data.socket]) {
                    job.data.msg = crypto_1.default.decrypt(job.data.msg, this.parentSecret1 + this.parentSecret2);
                    if (type === 'completed') { // let all related peers know of result
                        this.__broadcastToSharedPeers(job.data.socket, job.data.msg);
                    }
                    if (result) {
                        if (type === 'completed') {
                            job.data.msg.message = result;
                        }
                        else if (type === 'failed') {
                            job.data.msg.error = result;
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
}
exports.default = Sockethub;
//# sourceMappingURL=sockethub.js.map