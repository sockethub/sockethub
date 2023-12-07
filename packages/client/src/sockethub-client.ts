import EventEmitter from "eventemitter3";
import { IActivityObject, IActivityStream } from "@sockethub/schemas";
import ASFactory, { type ASManager } from "@sockethub/activity-streams";
import type { Socket } from "socket.io-client";

export interface EventMapping {
    credentials: Map<string, IActivityStream>;
    "activity-object": Map<string, IActivityObject>;
    connect: Map<string, IActivityStream>;
    join: Map<string, IActivityStream>;
}

interface CustomEmitter extends EventEmitter {
    _emit(s: string, o: unknown, d?: string): void;
}

export default class SockethubClient {
    private events: EventMapping = {
        credentials: new Map(),
        "activity-object": new Map(),
        connect: new Map(),
        join: new Map(),
    };
    private _socket: Socket;
    public ActivityStreams: ASManager;
    public socket: CustomEmitter;
    public online = false;
    public debug = true;

    constructor(socket: Socket) {
        if (!socket) {
            throw new Error("SockethubClient requires a socket.io instance");
        }
        this._socket = socket;

        this.socket = this.createPublicEmitter();
        this.registerSocketIOHandlers();
        this.initActivityStreams();

        this.ActivityStreams.on(
            "activity-object-create",
            (obj: IActivityObject) => {
                socket.emit("activity-object", obj, (err: never) => {
                    if (err) {
                        console.error("failed to create activity-object ", err);
                    } else {
                        this.eventActivityObject(obj);
                    }
                });
            },
        );

        socket.on("activity-object", (obj) => {
            this.ActivityStreams.Object.create(obj);
        });
    }

    initActivityStreams() {
        this.ActivityStreams = ASFactory({ specialObjs: ["credentials"] });
    }

    private createPublicEmitter(): CustomEmitter {
        const socket = new EventEmitter() as CustomEmitter;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        socket._emit = socket.emit;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        socket.emit = (event, content, callback): void => {
            if (event === "credentials") {
                this.eventCredentials(content);
            } else if (event === "activity-object") {
                this.eventActivityObject(content);
            } else if (event === "message") {
                this.eventMessage(content);
            }
            this._socket.emit(event as string, content, callback);
        };
        return socket;
    }

    private eventActivityObject(content: IActivityObject) {
        if (content.id) {
            this.events["activity-object"].set(content.id, content);
        }
    }

    private eventCredentials(content: IActivityStream) {
        if (content.object && content.object.type === "credentials") {
            const key: string =
                content.actor.id || (content.actor as unknown as string);
            this.events["credentials"].set(key, content);
        }
    }

    private eventMessage(content: IActivityObject) {
        if (!this.online) {
            return;
        }
        // either stores or delete the specified content onto the storedJoins map,
        // for reply once we're back online.
        const key = SockethubClient.getKey(content as IActivityStream);
        if (content.type === "join" || content.type === "connect") {
            this.events[content.type].set(key, content as IActivityStream);
        } else if (content.type === "leave") {
            this.events["join"].delete(key);
        } else if (content.type === "disconnect") {
            this.events["connect"].delete(key);
        }
    }

    private static getKey(content: IActivityStream) {
        const actor = content.actor?.id || content.actor;
        if (!actor) {
            throw new Error(
                "actor property not present for message type: " + content?.type,
            );
        }
        const target = content.target
            ? content.target.id || content.target
            : "";
        return actor + "-" + target;
    }

    private log(msg: string, obj?: unknown) {
        if (this.debug) {
            console.log(msg, obj);
        }
    }

    private registerSocketIOHandlers() {
        // middleware for events which don't deal in AS objects
        const callHandler = (event: string) => {
            return async (obj?: unknown) => {
                if (event === "connect") {
                    this.online = true;
                    this.replay(
                        "activity-object",
                        this.events["activity-object"],
                    );
                    this.replay("credentials", this.events["credentials"]);
                    this.replay("message", this.events["connect"]);
                    this.replay("message", this.events["join"]);
                } else if (event === "disconnect") {
                    this.online = false;
                }
                this.socket._emit(event, obj);
            };
        };

        // register for events that give us information on connection status
        this._socket.on("connect", callHandler("connect"));
        this._socket.on("connect_error", callHandler("connect_error"));
        this._socket.on("disconnect", callHandler("disconnect"));

        // use as a middleware to receive incoming Sockethub messages and unpack them
        // using the ActivityStreams library before passing them along to the app.
        this._socket.on("message", (obj) => {
            this.socket._emit("message", this.ActivityStreams.Stream(obj));
        });
    }

    private replay(name: string, asMap: Map<string, unknown>) {
        asMap.forEach((obj) => {
            this.log(`replaying ${name}`, obj);
            this._socket.emit(name, obj);
        });
    }
}
