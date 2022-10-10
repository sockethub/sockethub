export default class SockethubClient {
    private events;
    private _socket;
    ActivityStreams: any;
    socket: any;
    online: boolean;
    debug: boolean;
    constructor(socket: any);
    private createPublicEmitter;
    private eventActivityObject;
    private eventCredentials;
    private eventMessage;
    private static getKey;
    private log;
    private registerSocketIOHandlers;
    private replay;
}
