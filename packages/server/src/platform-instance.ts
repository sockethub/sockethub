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

type EnvFormat = {
  DEBUG?: string,
  REDIS_URL?: string,
  REDIS_HOST?: string,
  REDIS_PORT?: string
}

interface MessageFromPlatform extends Array<string | IActivityStream>{
  0: string, 1: IActivityStream, 2: string}
export interface MessageFromParent extends Array<string|unknown>{0: string, 1: unknown}

interface PlatformConfig {
  persist?: boolean;
  requireCredentials?: Array<string>;
}

export default class PlatformInstance {
  id: string;
  flaggedForTermination = false;
  initialized = false;
  jobQueue: JobQueue;
  readonly global: boolean = false;
  readonly completedJobHandlers: Map<string, CompletedJobHandler> = new Map();
  readonly config: PlatformConfig = {};
  readonly name: string;
  readonly process: ChildProcess;
  readonly debug: Debugger;
  readonly parentId: string;
  readonly sessions: Set<string> = new Set();
  readonly sessionCallbacks: object = {
    'close': (() => new Map())(),
    'message': (() => new Map())()
  };
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
    const env: EnvFormat = {};
    if (process.env.DEBUG) {
      env.DEBUG = process.env.DEBUG;
    }
    if (config.get('redis:url')) {
      env.REDIS_URL = config.get('redis:url') as string;
    } else {
      env.REDIS_HOST = config.get('redis:host') as string;
      env.REDIS_PORT = config.get('redis:port') as string;
    }

    // spin off a process
    this.process = fork(
      join(__dirname, 'platform.js'),
      [this.parentId, this.name, this.id],
      { env: env }
    );
  }

  /**
   * Destroys all references to this platform instance, internal listeners and controlled processes
   */
  public async shutdown() {
    this.debug('shutdown');
    this.flaggedForTermination = true;

    try {
      this.process.removeAllListeners('close');
      this.process.unref();
      this.process.kill();
    } catch (e) {
      // needs to happen
    }

    try {
      await this.jobQueue.shutdown();
      delete this.jobQueue;
    } catch (e) {
      // this needs to happen
    }

    try {
      platformInstances.delete(this.id);
    } catch (e) {
      // this needs to happen
    }
  }

  /**
   * When jobs are completed or failed, we prepare the results and send them to the client socket
   */
  public initQueue(secret: string) {
    this.jobQueue = new JobQueue(this.parentId, this.id, secret, nconf.get('redis'));
    this.jobQueue.initResultEvents();

    this.jobQueue.on('global:completed', async (job: JobDataDecrypted, result: IActivityStream|undefined) => {
      await this.handleJobResult('completed', job, result);
    });

    this.jobQueue.on('global:failed', async (job: JobDataDecrypted, result: IActivityStream|undefined) => {
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
        this.sendToClient(sid, msg);
      }
    }
  }

  // handle job results coming in on the queue from platform instances
  private async handleJobResult(type: string, job: JobDataDecrypted, result: IActivityStream|undefined) {
    let payload = result; // some platforms return new AS objects as result
    if (type === 'failed') {
      payload = job.msg; // failures always use original AS job object
      payload.error = result ? result.toString() : "job failed for unknown reason";
      this.debug(`${job.title} ${type}: ${payload.error}`);
    }

    if (typeof payload === 'string') {
      payload = undefined;
    }

    // send result to client
    const callback = this.completedJobHandlers.get(job.title);
    if (callback) {
      callback(payload);
      this.completedJobHandlers.delete(job.title);
    }

    if (payload) {
      // let all related peers know of result as an independent message
      // (not as part of a job completion, or failure)
      this.broadcastToSharedPeers(job.sessionId, payload);
    }

    if (this.config.persist && this.config.requireCredentials.includes(job.msg.type)) {
      if (type === 'failed') {
        this.debug(`critical job type ${job.msg.type} failed, flagging for termination`);
        await this.jobQueue.pause();
        this.initialized = false;
        this.flaggedForTermination = true;
      } else {
        await this.jobQueue.resume();
        this.initialized = true;
        this.flaggedForTermination = false;
      }
    }
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
    await this.shutdown();
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
