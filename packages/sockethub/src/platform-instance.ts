import { ChildProcess, fork } from 'child_process';
import { join } from 'path';
import { debug, Debugger } from 'debug';

import SharedResources from "./shared-resources";

export interface ActivityObject {
  '@type': string,
  actor: {
    '@type': string,
    '@id': string
  },
  object: {
    '@type': string
  }
}

interface MessageFromPlatform extends Array<string|ActivityObject>{
  0: string, 1: ActivityObject, 2: string}
export interface MessageFromParent extends Array<string|any>{0: string, 1: any}


export default class PlatformInstance {
  flaggedForTermination: boolean = false;
  id: string;
  readonly name: string;
  readonly process: ChildProcess;
  readonly debug: Debugger;
  readonly parentId: string;
  readonly sessions: Set<string> = new Set();
  private readonly actor?: string;
  public readonly global?: boolean = false;
  private readonly sessionCallbacks: object = {
    'close': (() => new Map())(),
    'message': (() => new Map())(),
  };

  constructor(id: string, name: string, parentId: string, actor?: string) {
    this.id = id;
    this.name = name;
    this.parentId = parentId;
    if (actor) {
      this.actor = actor;
    } else {
      this.global = true;
    }
    this.debug = debug(`sockethub:platform-instance:${this.id}`);
    // spin off a process
    this.process = fork(join(__dirname, 'platform.js'), [ parentId, name, id ]);
  }

  /**
   * Destroys all references to this platform instance, internal listeners and controlled processes
   */
  public destroy() {
    this.flaggedForTermination = true;
    SharedResources.platformInstances.delete(this.id);
    this.process.removeAllListeners('close');
    try {
      this.process.unref();
      this.process.kill();
    } catch (e) { console.log(e); }
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
  public sendToClient(sessionId: string, msg: any) {
    const socket = SharedResources.sessionConnections.get(sessionId);
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
  private reportFailure(sessionId: string, errorMessage: any) {
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
        this.debug('close even triggered ' + this.id);
        this.reportFailure(sessionId, `Error: session thread closed unexpectedly`);
      },
      'message': (data: MessageFromPlatform) => {
        if (data[0] === 'updateActor') {
          // We need to update the key to the store in order to find it in the future.
          this.updateIdentifier(data[2]);
        } else if (data[0] === 'error') {
          this.reportFailure(sessionId, data[1]);
        } else {
          // treat like a message to clients
          this.debug(`handling ${data[1]['@type']} message from platform process`);
          this.sendToClient(sessionId, data[1]);
        }
      }
    };
    return funcs[listener];
  }
}