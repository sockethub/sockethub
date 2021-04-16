import { ChildProcess, fork } from 'child_process';
import { join } from 'path';
import { debug, Debugger } from 'debug';
import Queue from 'bull';

import SharedResources from "./shared-resources";
import redisConfig from "./services/redis";
import crypto from "./crypto";
import { ActivityObject, Job } from "./sockethub";


export interface PlatformInstanceParams {
  identifier: string;
  platform: string;
  parentId?: string;
  actor?: string;
}

interface MessageFromPlatform extends Array<string|ActivityObject>{
  0: string, 1: ActivityObject, 2: string}
export interface MessageFromParent extends Array<string|any>{0: string, 1: any}


export default class PlatformInstance {
  flaggedForTermination: boolean = false;
  id: string;
  queue: Queue;
  readonly name: string;
  readonly process: ChildProcess;
  readonly debug: Debugger;
  readonly parentId: string;
  readonly sessions: Set<string> = new Set();
  public readonly global?: boolean = false;
  private readonly actor?: string;
  private readonly sessionCallbacks: object = {
    'close': (() => new Map())(),
    'message': (() => new Map())(),
  };

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
  public destroy() {
    this.flaggedForTermination = true;
    SharedResources.platformInstances.delete(this.id);
    try {
      this.queue.clean(0);
    } catch (e) { }
    try {
      this.process.removeAllListeners('close');
      this.process.unref();
      this.process.kill();
    } catch (e) { }
  }

  /**
   * When jobs are completed or failed, we prepare the results and send them to the client socket
   */
  public initQueue(secret: string) {
    this.queue = new Queue(this.parentId + this.id, redisConfig);
    this.queue.on('global:completed', (jobId, result) => {
      this.queue.getJob(jobId).then((job) => {
        job.data.msg = crypto.decrypt(job.data.msg, secret);
        this.handleJobResult('completed', job, result);
      });
    });
    this.queue.on('global:error', (jobId, result) => {
      this.debug("unknown queue error", jobId, result);
    });
    this.queue.on('global:failed', (jobId, result) => {
      this.queue.getJob(jobId).then((job) => {
        job.data.msg = crypto.decrypt(job.data.msg, secret);
        this.handleJobResult('failed', job, result);
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
   * @param type type of message to emit. 'message', 'completed', 'failed'
   * @param msg ActivityStream object to send to client
   */
  public sendToClient(sessionId: string, type: string, msg: ActivityObject) {
    const socket = SharedResources.sessionConnections.get(sessionId);
    if (socket) {
      try {
        // this should never be exposed externally
        delete msg.sessionSecret;
      } catch (e) {}
      msg.context = this.name;
      socket.emit(type, msg);
    }
  }

  // send message to every connected socket associated with this platform instance.
  private broadcastToSharedPeers(sessionId: string, msg: ActivityObject) {
    for (let sid of this.sessions.values()) {
      if (sid !== sessionId) {
        this.debug(`broadcasting message to ${sid}`);
        this.sendToClient(sid, 'message', msg);
      }
    }
  }

  // handle job results coming in on the queue from platform instances
  private handleJobResult(type: string, job: Job, result) {
    this.debug(`job ${job.data.title}: ${type}`);

    if ((type === 'completed') && (result)) {
      job.data.msg.object = {
        '@type': 'result',
        content: result
      };
    } else if (type === 'failed') {
      job.data.msg.object = {
        '@type': 'error',
        content: result ? result : "job failed for unknown reason"
      };
    }

    // send message to client as completed for failed job
    this.sendToClient(job.data.sessionId, type, job.data.msg);

    if (type === 'completed') {
      // let all related peers know of result as an independent message
      // (not as part of a job completion, or failure)
      this.broadcastToSharedPeers(job.data.sessionId, job.data.msg);
    }
    job.remove();
  }

  /**
   * Sends error message to client and clears all references to this class.
   * @param sessionId
   * @param errorMessage
   */
  private reportError(sessionId: string, errorMessage: any) {
    const errorObject: ActivityObject = {
      context: this.name,
      '@type': 'error',
      target: this.actor,
      object: {
        '@type': 'error',
        content: errorMessage
      }
    };
    this.sendToClient(sessionId, 'message', errorObject);
    this.sessions.clear();
    this.destroy();
  }

  /**
   * Updates the instance with a new identifier, updating the platformInstances mapping as well.
   * @param identifier
   */
  private updateIdentifier(identifier: string) {
    SharedResources.platformInstances.delete(this.id);
    this.id = identifier;
    SharedResources.platformInstances.set(this.id, this);
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
          this.sendToClient(sessionId, 'message', data[1]);
        }
      }
    };
    return funcs[listener];
  }
}
