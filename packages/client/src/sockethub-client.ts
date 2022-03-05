import { EventEmitter2 } from 'eventemitter2';
import ASFactory from '@sockethub/activity-streams';

export interface ActivityObjectManager {
  create(obj: any): any;
  delete(id: string): boolean;
  list(): Array<string>,
  get(id: string, expand: boolean): any;
}

export interface ASManager {
  Stream(meta: any): any,
  Object: ActivityObjectManager,
  emit(event, obj): void;
  on(event, func): void;
  once(event, func): void;
  off(event, funcName): void;
}

class SockethubClient {
  private _socket;
  private events = {
    'credentials': new Map(),
    'activity-object': new Map(),
    'connect': new Map(),
    'join': new Map()
  };
  public socket;
  public ActivityStreams: ASManager;
  public online = false;
  public debug = true;

  constructor(socket) {
    if (! socket) { throw new Error('SockethubClient requires a socket.io instance'); }
    this._socket = socket;
    // @ts-ignore
    this.ActivityStreams = ASFactory({specialObjs: ['credentials']});

    this.socket = this.createPublicEmitter();
    this.registerSocketIOHandlers();

    this.ActivityStreams.on('activity-object-create', (obj) => {
      socket.emit('activity-object', obj, (err) => {
        if (err) { console.error('failed to create activity-object ', err); }
        else { this.eventActivityObject(obj); }
      });
    });

    socket.on('activity-object', (obj) => {
      this.ActivityStreams.Object.create(obj);
    });
  }

  private createPublicEmitter(): EventEmitter2 {
    let socket = new EventEmitter2({
      wildcard: true,
      verboseMemoryLeak: false
    });
    // @ts-ignore
    socket._emit = socket.emit;
    socket.emit = (event, content, callback): any => {
      if (event === 'credentials') {
        this.eventCredentials(content);
      } else if (event === 'activity-object') {
        this.eventActivityObject(content);
      } else if (event === 'message') {
        this.eventMessage(content);
      }
      this._socket.emit(event, content, callback);
    };
    return socket;
  }

  private eventActivityObject(content: any) {
    if (content.id) {
      this.events['activity-object'].set(content.id, content);
    }
  }

  private eventCredentials(content: any) {
    if ((content.object) && (content.object.type === 'credentials')) {
      this.events['credentials'].set(content.actor.id || content.actor, content);
    }
  }

  private eventMessage(content: any) {
    if (! this.online) { return; }
    // either store or delete the specified content onto the storedJoins map,
    // for reply once we're back online.
    const key = SockethubClient.getKey(content);
    if (content.type === 'join' || content.type === 'connect') {
      this.events[content.type].set(key, content);
    } else if (content.type === 'leave') {
      this.events['join'].delete(key);
    } else if (content.type === 'disconnect') {
      this.events['connect'].delete(key);
    }
  }

  private static getKey(content: any) {
    let actor = content.actor?.id || content.actor;
    if (! actor) {
      throw new Error("actor property not present for message type: " + content?.type);
    }
    let target = content.target ? content.target.id || content.target : '';
    return actor + '-' + target;
  }

  private log(msg: string, obj?: any) {
    if (this.debug) {
      // eslint-disable-next-line security-node/detect-crlf
      console.log(msg, obj);
    }
  }

  private registerSocketIOHandlers() {
    // middleware for events which don't deal in AS objects
    const callHandler = (event: string) => {
      return (obj, cb) => {
        if (event === 'connect') {
          this.online = true;
          this.replay('activity-object', this.events['activity-object']);
          this.replay('credentials', this.events['credentials']);
          this.replay('message', this.events['connect']);
          this.replay('message', this.events['join']);
        } else if (event === 'disconnect') {
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

  private replay(name: string, asMap: any) {
    asMap.forEach((obj) => {
      this.log(`replaying ${name}`, obj);
      this._socket.emit(name, obj);
    });
  };
}

if (typeof module === 'object' && module.exports) {
  module.exports = SockethubClient;
}

if (typeof exports === 'object') {
  exports = SockethubClient;  // lgtm [js/useless-assignment-to-local]
}

// @ts-ignore
if (typeof window === 'object') {
  // @ts-ignore
  window.SockethubClient = SockethubClient;
}