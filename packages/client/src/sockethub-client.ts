import { ASFactory, type ASManager } from "@sockethub/activity-streams";
import type {
    ActivityObject,
    ActivityStream,
    BaseActivityObject,
} from "@sockethub/schemas";
import {
    addPlatformContext,
    addPlatformSchema,
    validateActivityStream,
    validateCredentials,
} from "@sockethub/schemas";
import EventEmitter from "eventemitter3";
import type { Socket } from "socket.io-client";

export interface EventMapping {
    credentials: Map<string, ActivityStream>;
    "activity-object": Map<string, BaseActivityObject>;
    connect: Map<string, ActivityStream>;
    join: Map<string, ActivityStream>;
}

type ReplayEventMap = {
    "activity-object": BaseActivityObject;
    credentials: ActivityStream;
    message: ActivityStream;
};

interface CustomEmitter extends EventEmitter {
    _emit(s: string, o: unknown, c?: unknown): void;
    connect(): void;
    disconnect(): void;
    connected: boolean;
    id: string;
}

interface PlatformRegistrySchemas {
    credentials?: object;
    messages?: object;
}

/**
 * Server-declared platform metadata used by the client for context generation
 * and runtime validation.
 */
export interface PlatformRegistryEntry {
    id: string;
    contextUrl: string;
    contextVersion: string;
    schemaVersion: string;
    types: Array<string>;
    schemas: PlatformRegistrySchemas;
}

export interface PlatformRegistryPayload {
    version?: string;
    contexts?: {
        as?: string;
        sockethub?: string;
    };
    platforms?: Array<PlatformRegistryEntry>;
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
    public ActivityStreams!: ASManager;
    public socket!: CustomEmitter;
    public debug = true;
    private platformRegistry = new Map<string, PlatformRegistryEntry>();
    private asContextUrl?: string;
    private sockethubContextUrl?: string;

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

    /**
     * Return the platform registry discovered from the server.
     */
    public getRegisteredPlatforms(): Array<PlatformRegistryEntry> {
        return Array.from(this.platformRegistry.values()).map((platform) => ({
            ...platform,
            types: [...platform.types],
            schemas: { ...platform.schemas },
        }));
    }

    /**
     * Indicates whether server-provided schema/context registry data is loaded.
     */
    public isSchemasReady(): boolean {
        return Boolean(
            this.asContextUrl &&
                this.sockethubContextUrl &&
                this.platformRegistry.size > 0,
        );
    }

    /**
     * Return the canonical base contexts learned from the server registry.
     */
    public getRegisteredBaseContexts(): { as: string; sockethub: string } {
        if (!this.asContextUrl || !this.sockethubContextUrl) {
            throw new Error(
                "Schema registry not loaded yet. Wait for the 'schemas' event after connect.",
            );
        }
        return {
            as: this.asContextUrl,
            sockethub: this.sockethubContextUrl,
        };
    }

    public getPlatformSchema(
        platform: string,
        schemaType: "messages" | "credentials" = "messages",
    ): object | undefined {
        const normalizedPlatform = platform?.trim();
        if (!normalizedPlatform) {
            return undefined;
        }
        return this.platformRegistry.get(normalizedPlatform)?.schemas?.[
            schemaType
        ];
    }

    /**
     * Wait for schema registry data from the server and return the normalized payload.
     */
    public async waitForSchemas(
        timeoutMs = 2000,
    ): Promise<PlatformRegistryPayload> {
        if (!this.isSchemasReady()) {
            await this.requestSchemaRegistry(timeoutMs);
        }
        if (!this.isSchemasReady()) {
            throw new Error(
                "Schema registry not loaded yet. Wait for the 'schemas' event after connect.",
            );
        }
        return {
            contexts: this.getRegisteredBaseContexts(),
            platforms: this.getRegisteredPlatforms(),
        };
    }

    /**
     * Validate an activity stream against currently registered platform schemas.
     * Returns an empty string when valid.
     */
    public validateActivity(activity: ActivityStream): string {
        if (activity.type === "credentials") {
            return validateCredentials(activity);
        }
        return validateActivityStream(activity);
    }

    /**
     * Build canonical Sockethub contexts for a platform using server-provided schema metadata.
     */
    public contextFor(platform: string): ActivityStream["@context"] {
        if (typeof platform !== "string" || platform.trim().length === 0) {
            throw new Error(
                "SockethubClient.contextFor(platform) requires a non-empty platform string",
            );
        }

        if (!this.asContextUrl || !this.sockethubContextUrl) {
            throw new Error(
                "Schema registry not loaded yet. Wait for the 'schemas' event after connect.",
            );
        }

        const normalizedPlatform = platform.trim();
        const entry = this.platformRegistry.get(normalizedPlatform);
        if (!entry) {
            const names = Array.from(this.platformRegistry.keys()).sort();
            throw new Error(
                `unknown platform '${normalizedPlatform}'. Registered platforms: ${names.join(", ")}`,
            );
        }
        return [this.asContextUrl, this.sockethubContextUrl, entry.contextUrl];
    }

    private createPublicEmitter(): CustomEmitter {
        const socket = new EventEmitter() as CustomEmitter;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        socket._emit = socket.emit;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        socket.emit = (event, content, callback): void => {
            let outgoing = content;
            if (event === "credentials" || event === "message") {
                outgoing = this.ActivityStreams.Stream(
                    content as ActivityStream,
                );
                if (outgoing && typeof outgoing === "object") {
                    const activity = outgoing as ActivityStream;
                    if (
                        activity.actor &&
                        typeof activity.actor === "object" &&
                        !activity.actor.type
                    ) {
                        // Normalize the minimal actor object shape produced from string actors
                        // so schema validation and downstream code can rely on actor.type.
                        activity.actor.type = "person";
                    }
                }
                if (this.platformRegistry.size > 0) {
                    // Once registry metadata exists, reject malformed outbound payloads
                    // before they are emitted over the socket.
                    const validationError = this.validateActivity(
                        outgoing as ActivityStream,
                    );
                    if (validationError) {
                        const errorMessage = `SockethubClient validation failed: ${validationError}`;
                        // Preserve callback-style socket semantics: surface client-side
                        // validation failures through ack callback when provided.
                        if (typeof callback === "function") {
                            callback({ error: errorMessage });
                            return;
                        }
                        throw new Error(errorMessage);
                    }
                }
            }
            if (event === "credentials") {
                this.eventCredentials(outgoing as ActivityStream);
            } else if (event === "activity-object") {
                this.eventActivityObject(outgoing as ActivityObject);
            } else if (event === "message") {
                this.eventMessage(outgoing as BaseActivityObject);
            }
            this._socket.emit(event as string, outgoing, callback);
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

    /**
     * Ask server for the latest platform/context registry via ack callback.
     * This keeps client context composition aligned with server schema state.
     */
    private requestSchemaRegistry(timeoutMs = 2000): Promise<void> {
        return new Promise((resolve) => {
            let settled = false;
            const done = () => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve();
                }
            };

            const timer = setTimeout(done, timeoutMs);
            const socketLike = this._socket as unknown as Record<
                string,
                unknown
            >;
            if (!("io" in socketLike)) {
                clearTimeout(timer);
                done();
                return;
            }

            this._socket.emit("schemas", (payload: unknown) => {
                this.applyPlatformRegistry(payload);
                done();
            });
        });
    }

    /**
     * Apply server-provided registry metadata to local runtime state.
     * Also registers platform contexts/schemas with @sockethub/schemas validators
     * so local validation uses the same canonical sources as the server.
     */
    private applyPlatformRegistry(payload: unknown) {
        if (!payload || typeof payload !== "object") {
            return;
        }
        const registry = payload as PlatformRegistryPayload;
        const asContextUrl = registry.contexts?.as;
        const sockethubContextUrl = registry.contexts?.sockethub;
        if (
            typeof asContextUrl !== "string" ||
            typeof sockethubContextUrl !== "string" ||
            !Array.isArray(registry.platforms)
        ) {
            return;
        }
        this.asContextUrl = asContextUrl;
        this.sockethubContextUrl = sockethubContextUrl;

        this.platformRegistry.clear();
        for (const platform of registry.platforms) {
            if (
                !platform ||
                typeof platform !== "object" ||
                typeof platform.id !== "string" ||
                typeof platform.contextUrl !== "string"
            ) {
                continue;
            }
            this.platformRegistry.set(platform.id, {
                ...platform,
                types: Array.isArray(platform.types) ? platform.types : [],
                schemas: platform.schemas || {},
            });
            addPlatformContext(platform.id, platform.contextUrl);
            addPlatformSchema(
                platform.schemas?.credentials || {},
                `${platform.id}/credentials`,
            );
            addPlatformSchema(
                platform.schemas?.messages || {},
                `${platform.id}/messages`,
            );
        }
        // Emit normalized registry payload so app code receives a stable shape.
        this.socket._emit("schemas", {
            version: registry.version,
            contexts: this.getRegisteredBaseContexts(),
            platforms: this.getRegisteredPlatforms(),
        } satisfies PlatformRegistryPayload);
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
                    await this.requestSchemaRegistry();
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
        this._socket.on("schemas", (payload: unknown) => {
            this.applyPlatformRegistry(payload);
        });

        // use as middleware to receive incoming Sockethub messages and unpack them
        // using the ActivityStreams library before passing them along to the app.
        this._socket.on("message", (obj) => {
            this.socket._emit("message", this.ActivityStreams.Stream(obj));
        });
    }

    /**
     * Type guard to check if an object is an ActivityStream with a valid actor.id.
     */
    private hasActorId(
        obj: ActivityStream | ActivityObject,
    ): obj is ActivityStream {
        return (
            "actor" in obj &&
            obj.actor !== null &&
            typeof obj.actor === "object" &&
            "id" in obj.actor &&
            typeof obj.actor.id === "string"
        );
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
    private replay<K extends keyof ReplayEventMap>(
        name: K,
        asMap: Map<string, ReplayEventMap[K]>,
    ): void {
        for (const obj of asMap.values()) {
            // activity-objects are raw objects, don't pass through Stream()
            // which is designed for activity streams with actor/object structure
            const isActivityObject = name === "activity-object";
            if (isActivityObject) {
                const expandedObj = obj as BaseActivityObject;
                const id = expandedObj?.id;
                this.log(`replaying ${name} for ${id}`);
                this._socket.emit(name, expandedObj);
                continue;
            }

            const expandedObj = this.ActivityStreams.Stream(
                obj as ActivityStream,
            );
            let id = expandedObj?.id;
            if (this.hasActorId(expandedObj)) {
                const actor = (expandedObj as ActivityStream).actor;
                // actor can be a string (JID) or an object with an id field
                id = typeof actor === "string" ? actor : actor.id;
            }
            this.log(`replaying ${name} for ${id}`);
            this._socket.emit(name, expandedObj);
        }
    }
}

((global: Record<string, unknown>) => {
    global.SockethubClient = SockethubClient;
})(
    typeof globalThis === "object"
        ? (globalThis as Record<string, unknown>)
        : {},
);
