import { EventEmitter2 } from 'eventemitter2';
import { Socket } from "socket.io";
import ASFactory from 'activity-streams';

export interface ActivityObjectManager {
  create(obj: any): any;
  delete(id: string): boolean;
  list(): Array<string>,
  get(id: string, expand: boolean): any;
}

export interface ASManager {
  Stream(meta: any): any,
  Object: ActivityObjectManager,
  on(event, func): void;
  once(event, func): void;
  off(event, funcName): void;
}

class SockethubClient {
  public socket;
  private _socket;
  public ActivityStreams: ASManager;
  public online = false;
  public debug = true;
  private events = {
    'credentials': new Map(),
    'activity-object': new Map(),
    'connect': new Map(),
    'join': new Map()
  };

  constructor(socket: Socket) {
    if (! socket) { throw new Error('SockethubClient requires a socket.io instance'); }
    this._socket = socket;
    // @ts-ignore
    this.ActivityStreams = ASFactory({specialObjs: ['credentials']});

    this.socket = this.createPublicEmitter();
    this.registerSocketIOHandlers();
    // this.listenToUserActivity();

    this.ActivityStreams.on('activity-object-create', (obj) => {
      socket.emit('activity-object', obj);
    });

    socket.on('activity-object', (obj) => {
      this.ActivityStreams.Object.create(obj);
    });
  }

  public log(msg: string, obj?: any) {
    if (this.debug) {
      // eslint-disable-next-line security-node/detect-crlf
      console.log(msg, obj);
    }
  };

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
  };

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

    // do our middle-ware stuff then call the stored handler
    this._socket.on('message', this.unpackAndCallHandler('message'));
    this._socket.on('completed', this.unpackAndCallHandler('completed'));
    this._socket.on('failed', this.unpackAndCallHandler('failed'));
  }

  private eventCredentials(content: any) {
    if ((content.object) && (content.object['@type'] === 'credentials')) {
      this.events['credentials'].set(content.actor['@id'] || content.actor, content);
    }
  }

  private eventActivityObject(content: any) {
    if (content['@id']) {
      this.events['activity-object'].set(content['@id'], content);
    }
  }

  private eventMessage(content: any) {
    if (this.online) {
      // either store or delete the specified content onto the storedJoins map,
      // for reply once we're back online.
      if (content['@type'] === 'join') {
        this.events['join'].set(SockethubClient.getKey(content), content);
      } else if (content['@type'] === 'leave') {
        this.events['join'].delete(SockethubClient.getKey(content));
      }
      if (content['@type'] === 'connect') {
        this.events['connect'].set(SockethubClient.getKey(content), content);
      } else if (content['@type'] === 'disconnect') {
        this.events['connect'].delete(SockethubClient.getKey(content));
      }
    }
  }

  private replay(name: string, asMap: any) {
    asMap.forEach((obj) => {
      this.log(`replaying ${name}`, obj);
      this._socket.emit(name, obj);
    });
  };

  // use as a middleware to receive incoming Sockethub messages and unpack them
  // using the ActivityStreams library before passing them along to the app.
  private unpackAndCallHandler(event: string) {
    return (obj, cb) => {
      this.socket._emit(event, this.ActivityStreams.Stream(obj), cb);
    };
  };

  private static getKey(content: any) {
    let actor = content.actor['@id'] || content.actor;
    let target = content.target ? content.target['@id'] || content.target : '';
    return actor + '-' + target;
  };
}

if (typeof module === 'object' && module.exports) {
  module.exports = SockethubClient;
}

if (typeof exports === 'object') {
  exports = SockethubClient;
}

// @ts-ignore
if (typeof window === 'object') {
  // @ts-ignore
  window.SockethubClient = SockethubClient;
}