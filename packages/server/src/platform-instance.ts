import {ChildProcess, fork } from 'child_process';
import { join } from 'path';
import { debug, Debugger } from 'debug';
import {IActivityStream, CompletedJobHandler} from "@sockethub/schemas";
import {JobQueue, JobDataDecrypted} from "@sockethub/data-layer";

import config from "./config";
import { getSocket } from "./listener";
import nconf from "nconf";

// collection of platform instances, stored by `id`
export const platformInstances = new Map<string, PlatformInstance>();

export interface PlatformInstanceParams {
  identifier: string;
  platform: string;
  parentId?: string;
  actor?: string;
}

interface MessageFromPlatform extends Array<string | IActivityStream>{
  0: string, 1: IActivityStream, 2: string}
export interface MessageFromParent extends Array<string|unknown>{0: string, 1: unknown}

interface PlatformConfig {
  persist?: boolean;
  requireCredentials?: Array<string>;
}

export default class PlatformInstance {
  flaggedForTermination = false;
  id: string;
  jobQueue: JobQueue;
  completedJobHandlers: Map<string, CompletedJobHandler> = new Map();
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

    this.debug = debug(`sockethub:server:platform-instance:${this.id}`);
    // spin off a process
    this.process = fork(
      join(__dirname, 'platform.js'),
      [this.parentId, this.name, this.id],
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      { env: config.get('redis:url') ? { REDIS_URL: config.get('redis:url') }
        : { REDIS_HOST: config.get('redis:host'), REDIS_PORT: config.get('redis:port') }}
    );
  }

  /**
   * Destroys all references to this platform instance, internal listeners and controlled processes
   */
  public async destroy() {
    this.debug(`cleaning up`);
    this.flaggedForTermination = true;
    try {
      await this.jobQueue.shutdown();
    } catch (e) {
      // this needs to happen
    }
    try {
      delete this.jobQueue;
      await this.process.removeAllListeners('close');
      await this.process.unref();
      this.process.kill();
    } finally {
      platformInstances.delete(this.id);
    }
  }

  /**
   * When jobs are completed or failed, we prepare the results and send them to the client socket
   */
  public initQueue(secret: string) {
    this.jobQueue = new JobQueue(this.parentId, this.id, secret, nconf.get('redis'));

    this.jobQueue.on('global:completed', async (job: JobDataDecrypted, result: string) => {
      await this.handleJobResult('completed', job, result);
    });

    this.jobQueue.on('global:failed', async (job: JobDataDecrypted, result: string) => {
      await this.handleJobResult('failed', job, result);
    });
  }

  /**
   * Register listener to be called when the process emits a message.
   * @param sessionId ID of socket connection that will receive messages from platform emits
   */
  public registerSession(sessionId: string) {
    if (! this.sessions.has(sessionId)) {
      this.sessions.add(sessionId);
      for (const type of Object.keys(this.sessionCallbacks)) {
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
  public sendToClient(sessionId: string, msg: IActivityStream) {
    getSocket(sessionId).then((socket) => {
      try {
        // this property should never be exposed externally
        delete msg.sessionSecret;
      } finally {
        msg.context = this.name;
        if ((msg.type === 'error') && (typeof msg.actor === 'undefined') && (this.actor)) {
          // ensure an actor is present if not otherwise defined
          msg.actor = { id: this.actor, type: 'unknown' };
        }
        socket.emit('message', msg);
      }
    }, (err) => this.debug(`sendToClient ${err}`));
  }

  // send message to every connected socket associated with this platform instance.
  private async broadcastToSharedPeers(sessionId: string, msg: IActivityStream) {
    for (const sid of this.sessions.values()) {
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
    const msg = jobData.msg;
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
  private async reportError(sessionId: string, errorMessage: string) {
    const errorObject: IActivityStream = {
      context: this.name,
      type: 'error',
      actor: { id: this.actor, type: 'unknown' },
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
      'close': async (e: object) => {
        this.debug(`close even triggered ${this.id}: ${e}`);
        await this.reportError(sessionId, `Error: session thread closed unexpectedly: ${e}`);
      },
      'message': async ([first, second, third]: MessageFromPlatform) => {
        if (first === 'updateActor') {
          // We need to update the key to the store in order to find it in the future.
          this.updateIdentifier(third);
        } else if ((first === 'error') && (typeof second === "string")) {
          await this.reportError(sessionId, second);
        } else {
          // treat like a message to clients
          this.sendToClient(sessionId, second);
        }
      }
    };
    return funcs[listener];
  }
}
