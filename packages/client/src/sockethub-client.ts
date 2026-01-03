import { ASFactory, type ASManager } from "@sockethub/activity-streams";
import type {
    ActivityObject,
    ActivityStream,
    BaseActivityObject,
} from "@sockethub/schemas";
import EventEmitter from "eventemitter3";
import type { Socket } from "socket.io-client";

export interface EventMapping {
    credentials: Map<string, ActivityStream>;
    "activity-object": Map<string, BaseActivityObject>;
    connect: Map<string, ActivityStream>;
    join: Map<string, ActivityStream>;
}

interface CustomEmitter extends EventEmitter {
    _emit(s: string, o: unknown, c?: unknown): void;
    connect(): void;
    disconnect(): void;
    connected: boolean;
    id: string;
}

/**
 * SockethubClient - Client library for Sockethub protocol gateway
 *
 * A JavaScript client for connecting to Sockethub servers. Provides a high-level
 * API for sending and receiving ActivityStreams messages over Socket.IO, with
 * automatic state management and reconnection handling.
 *
 * Sockethub acts as a protocol gateway, translating ActivityStreams messages into
 * various protocols (XMPP, IRC, RSS, etc.). This client handles the communication
 * with the Sockethub server, including credential management, connection state,
 * and automatic reconnection.
 *
 * ## Automatic Reconnection & State Replay
 *
 * This client automatically handles transient network disconnections by storing
 * connection state in memory and replaying it when the socket reconnects.
 *
 * ### Security Model
 *
 * **Storage Location:**
 * - All credentials and state are stored ONLY in JavaScript memory (heap)
 * - Nothing is persisted to localStorage, sessionStorage, cookies, or disk
 * - Memory is cleared when the browser tab closes or page refreshes
 *
 * **Replay Triggers:**
 * - Automatic replay occurs on Socket.IO reconnection events
 * - Typically triggered by brief network interruptions (WiFi switching, mobile network blips)
 * - Does NOT occur on page refresh (new SockethubClient instance = empty state)
 *
 * **Server Restart Behavior:**
 * - If server restarts, client socket will reconnect and replay credentials
 * - Server must handle replayed credentials appropriately (validate, reject stale sessions, etc.)
 * - Applications should implement proper session validation server-side
 *
 * **Lifetime:**
 * - Credentials exist only during the browser tab's lifetime
 * - Cleared on page reload, tab close, or manual disconnect
 * - Not accessible across tabs or after browser restart
 *
 * **What Gets Replayed:**
 * - Credentials (username/password/tokens sent via credentials event)
 * - Activity Objects (actor definitions)
 * - Connect commands (platform connections)
 * - Join commands (room/channel joins)
 *
 * @example
 * ```typescript
 * // Create client
 * const socket = io('http://localhost:10550');
 * const client = new SockethubClient(socket);
 *
 * // Send credentials - these will be replayed on reconnection
 * client.socket.emit('credentials', {
 *   actor: 'user@example.com',
 *   object: { username: 'user', password: 'pass' }
 * });
 *
 * // If network disconnects and reconnects, credentials are automatically replayed
 * // If page refreshes, credentials are lost and must be resent
 * ```
 */
export default class SockethubClient {
    /**
     * In-memory storage for client state that should be replayed on reconnection.
     *
     * Security: Stored ONLY in JavaScript heap memory. Never persisted to disk,
     * localStorage, or any permanent storage. Cleared on page reload.
     */
    private events: EventMapping = {
        credentials: new Map(),
        "activity-object": new Map(),
        connect: new Map(),
        join: new Map(),
    };
    private _socket: Socket;
    public ActivityStreams: ASManager;
    public socket: CustomEmitter;
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
            (obj: ActivityObject) => {
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

    /**
     * Clear stored credentials to prevent automatic replay on reconnection.
     *
     * This method removes all stored credentials from memory. Useful for
     * security-sensitive applications that want to prevent automatic credential
     * replay when the socket reconnects.
     *
     * @example
     * ```typescript
     * // Clear credentials on disconnect
     * sc.socket.on('disconnect', () => {
     *   sc.clearCredentials();
     * });
     * ```
     */
    public clearCredentials(): void {
        this.events.credentials.clear();
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
        socket.connected = false;
        socket.disconnect = () => {
            this._socket.disconnect();
        };
        socket.connect = () => {
            this._socket.connect();
        };
        return socket;
    }

    private eventActivityObject(content: ActivityObject) {
        if (content.id) {
            this.events["activity-object"].set(content.id, content);
        }
    }

    private eventCredentials(content: ActivityStream) {
        if (content.object && content.object.type === "credentials") {
            const key: string =
                content.actor.id || (content.actor as unknown as string);
            this.events.credentials.set(key, content);
        }
    }

    private eventMessage(content: BaseActivityObject) {
        if (!this._socket.connected) {
            return;
        }
        // either stores or delete the specified content onto the storedJoins map,
        // for reply once we're back online.
        const key = SockethubClient.getKey(content as ActivityStream);
        if (content.type === "join" || content.type === "connect") {
            this.events[content.type].set(key, content as ActivityStream);
        } else if (content.type === "leave") {
            this.events.join.delete(key);
        } else if (content.type === "disconnect") {
            this.events.connect.delete(key);
        }
    }

    private static getKey(content: ActivityStream) {
        const actor = content.actor?.id || content.actor;
        if (!actor) {
            throw new Error(
                `actor property not present for message type: ${content?.type}`,
            );
        }
        const target = content.target
            ? content.target.id || content.target
            : "";
        return `${actor}-${target}`;
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
                    this.socket.id = this._socket.id;
                    this.socket.connected = true;

                    /**
                     * Automatic state replay on reconnection.
                     *
                     * When Socket.IO reconnects after a network interruption, we automatically
                     * replay all stored state to restore the session seamlessly:
                     *
                     * 1. Activity Objects (actor definitions)
                     * 2. Credentials (authentication)
                     * 3. Connect commands (platform connections)
                     * 4. Join commands (room/channel memberships)
                     *
                     * This allows the client to survive brief network blips without requiring
                     * user intervention. However, the server must properly validate replayed
                     * credentials as they may be stale or revoked.
                     */
                    this.replay(
                        "activity-object",
                        this.events["activity-object"],
                    );
                    this.replay("credentials", this.events.credentials);
                    this.replay("message", this.events.connect);
                    this.replay("message", this.events.join);
                } else if (event === "disconnect") {
                    this.socket.connected = false;
                }
                this.socket._emit(event, obj);
            };
        };

        // register for events that give us information on connection status
        this._socket.on("connect", callHandler("connect"));
        this._socket.on("connect_error", callHandler("connect_error"));
        this._socket.on("disconnect", callHandler("disconnect"));

        // use as middleware to receive incoming Sockethub messages and unpack them
        // using the ActivityStreams library before passing them along to the app.
        this._socket.on("message", (obj) => {
            this.socket._emit("message", this.ActivityStreams.Stream(obj));
        });
    }

    /**
     * Replays previously sent events to the server after reconnection.
     *
     * This method is called automatically when the Socket.IO connection is
     * re-established after a transient network interruption. It resends
     * credentials and connection state so the user doesn't need to manually
     * re-authenticate or rejoin channels.
     *
     * Security considerations:
     * - Only replays events stored in memory during this session
     * - Does not replay after page refresh (memory cleared)
     * - Server should validate replayed credentials (may be stale/revoked)
     *
     * @param name - Event name to emit ("credentials", "activity-object", "message")
     * @param asMap - Map of events to replay
     */
    private replay(
        name: string,
        asMap: Map<string, ActivityStream | BaseActivityObject>,
    ) {
        for (const obj of asMap.values()) {
            const expandedObj = this.ActivityStreams.Stream(obj);
            let id = expandedObj?.id;
            if ("actor" in expandedObj) {
                id = expandedObj.actor.id;
            }
            this.log(`replaying ${name} for ${id}`);
            this._socket.emit(name, expandedObj);
        }
    }
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
((global: any) => {
    global.SockethubClient = SockethubClient;
    // @ts-ignore
})(typeof window === "object" ? window : {});
