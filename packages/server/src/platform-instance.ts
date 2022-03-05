import { ChildProcess, fork } from 'child_process';
import { join } from 'path';
import { debug, Debugger } from 'debug';
import Queue from 'bull';

import config from "./config";
import { ActivityStream, JobDataDecrypted, JobEncrypted } from "./sockethub";
import { getSocket } from "./serve";
import { decryptJobData } from "./common";

// collection of platform instances, stored by `id`
export const platformInstances = new Map<string, PlatformInstance>();

export interface PlatformInstanceParams {
  identifier: string;
  platform: string;
  parentId?: string;
  actor?: string;
}

interface MessageFromPlatform extends Array<string|ActivityStream>{
  0: string, 1: ActivityStream, 2: string}
export interface MessageFromParent extends Array<string|any>{0: string, 1: any}

interface PlatformConfig {
  persist?: boolean;
  requireCredentials?: Array<string>;
}

export default class PlatformInstance {
  flaggedForTermination: boolean = false;
  id: string;
  queue: Queue;
  completedJobHandlers: Map<string, Function> = new Map();
  config: PlatformConfig = {};
  readonly name: string;
  readonly process: ChildProcess;
  readonly debug: Debugger;
  readonly parentId: string;
  readonly sessions: Set<string> = new Set();
  readonly sessionCallbacks: object = {
    'close': (() => new Map())(),
    'message': (() => new Map())()
  };
  public readonly global?: boolean = false;
  private readonly actor?: string;

  constructor(params: PlatformInstanceParams) {
    this.id = params.identifier;
    this.name = params.platform;
    this.parentId = params.parentId;
    if (params.actor) {
      this.actor = params.actor;
    } else {
      this.global = true;
    }

    this.debug = debug(`sockethub:platform-instance:${this.id}`);
    // spin off a process
    this.process = fork(join(__dirname, 'platform.js'), [this.parentId, this.name, this.id]);
  }

  /**
   * Destroys all references to this platform instance, internal listeners and controlled processes
   */
  public async destroy() {
    this.debug(`cleaning up`);
    this.flaggedForTermination = true;
    try {
      await this.queue.removeAllListeners();
    } catch (e) { }
    try {
      await this.queue.obliterate({ force: true });
    } catch (e) { }
    try {
      delete this.queue;
      await this.process.removeAllListeners('close');
      await this.process.unref();
      await this.process.kill();
    } catch (e) { }
    platformInstances.delete(this.id);
  }

  /**
   * When jobs are completed or failed, we prepare the results and send them to the client socket
   */
  public initQueue(secret: string) {
    this.queue = new Queue(this.parentId + this.id, { redis: config.get('redis') });

    this.queue.on('global:completed', (jobId, resultString) => {
      const result = resultString ? JSON.parse(resultString) : "";
      this.queue.getJob(jobId).then(async (job: JobEncrypted) => {
        await this.handleJobResult('completed', decryptJobData(job, secret), result);
        await job.remove();
      });
    });

    this.queue.on('global:error', (jobId, result) => {
      this.debug("unknown queue error", jobId, result);
    });

    this.queue.on('global:failed', (jobId, result) => {
      this.queue.getJob(jobId).then(async (job: JobEncrypted) => {
        await this.handleJobResult('failed', decryptJobData(job, secret), result);
        await job.remove();
      });
    });
  }

  /**
   * Register listener to be called when the process emits a message.
   * @param sessionId ID of socket connection that will receive messages from platform emits
   */
  public registerSession(sessionId: string) {
    if (! this.sessions.has(sessionId)) {
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
  public sendToClient(sessionId: string, msg: ActivityStream) {
    getSocket(sessionId).then((socket) => {
      try {
        // this property should never be exposed externally
        delete msg.sessionSecret;
      } catch (e) {}
      msg.context = this.name;
      if ((msg.type === 'error') && (typeof msg.actor === 'undefined') && (this.actor)) {
        // ensure an actor is present if not otherwise defined
        msg.actor = { id: this.actor };
      }
      socket.emit('message', msg);
    }, (err) => this.debug(`sendToClient ${err}`));
  }

  // send message to every connected socket associated with this platform instance.
  private async broadcastToSharedPeers(sessionId: string, msg: ActivityStream) {
    for (let sid of this.sessions.values()) {
      if (sid !== sessionId) {
        this.debug(`broadcasting message to ${sid}`);
        await this.sendToClient(sid, msg);
      }
    }
  }

  // handle job results coming in on the queue from platform instances
  private async handleJobResult(type: string, jobData: JobDataDecrypted, result) {
    this.debug(`${type} job ${jobData.title}`);
    delete jobData.msg.sessionSecret;
    let msg = jobData.msg;
    if (type === 'failed') {
      msg.error = result ? result : "job failed for unknown reason";
      if ((this.config.persist) && (this.config.requireCredentials.includes(jobData.msg.type))) {
        this.debug(`critical job type ${jobData.msg.type} failed, terminating platform instance`);
        await this.destroy();
      }
    }

    // send result to client
    const callback = this.completedJobHandlers.get(jobData.title);
    if (callback) {
      callback(msg);
      this.completedJobHandlers.delete(jobData.title);
    } else {
      await this.sendToClient(jobData.sessionId, msg);
    }

    // let all related peers know of result as an independent message
    // (not as part of a job completion, or failure)
    await this.broadcastToSharedPeers(jobData.sessionId, msg);
  }

  /**
   * Sends error message to client and clears all references to this class.
   * @param sessionId
   * @param errorMessage
   */
  private async reportError(sessionId: string, errorMessage: any) {
    const errorObject: ActivityStream = {
      context: this.name,
      type: 'error',
      actor: { id: this.actor },
      error: errorMessage
    };
    this.sendToClient(sessionId, errorObject);
    this.sessions.clear();
    await this.destroy();
  }

  /**
   * Updates the instance with a new identifier, updating the platformInstances mapping as well.
   * @param identifier
   */
  private updateIdentifier(identifier: string) {
    platformInstances.delete(this.id);
    this.id = identifier;
    platformInstances.set(this.id, this);
  }

  /**
   * Generates a function tied to a given client session (socket connection), the generated
   * function will be called for each session ID registered, for every platform emit.
   * @param listener
   * @param sessionId
   */
  private callbackFunction(listener: string, sessionId: string) {
    const funcs = {
      'close': (e: object) => {
        this.debug(`close even triggered ${this.id}: ${e}`);
        this.reportError(sessionId, `Error: session thread closed unexpectedly: ${e}`);
      },
      'message': (data: MessageFromPlatform) => {
        if (data[0] === 'updateActor') {
          // We need to update the key to the store in order to find it in the future.
          this.updateIdentifier(data[2]);
        } else if (data[0] === 'error') {
          this.reportError(sessionId, data[1]);
        } else {
          // treat like a message to clients
          this.sendToClient(sessionId, data[1]);
        }
      }
    };
    return funcs[listener];
  }
}