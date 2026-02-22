import { ASFactory, type ASManager } from "@sockethub/activity-streams";
import type {
    ActivityObject,
    ActivityStream,
    BaseActivityObject,
} from "@sockethub/schemas";
import {
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

// @sockethub/schemas uses a module-level AJV instance, so schema keys are process-global.
// Track which platform schemas were already registered to avoid duplicate addSchema errors.
const registeredPlatformSchemaKeys = new Set<string>();
const registeredPlatformSchemaFingerprints = new Map<string, string>();

type InitState = "idle" | "initializing" | "ready" | "init_error" | "closed";

type ReadyReason = "initial-connect" | "reconnect" | "schemas-update";

type InitErrorPhase = "schemas-request" | "schemas-apply" | "timeout";

interface PendingReadyWaiter {
    resolve: (info: ClientReadyInfo) => void;
    reject: (err: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
}

interface QueuedOutboundEvent {
    event: string;
    content: unknown;
    callback?: unknown;
    enqueuedAt: number;
    sequence: number;
}

interface InitializationCycle {
    token: number;
    reason: ReadyReason;
    startedAt: number;
    replayOnReady: boolean;
    timedOut: boolean;
}

export interface SockethubClientOptions {
    initTimeoutMs?: number;
    maxQueuedOutbound?: number;
    maxQueuedAgeMs?: number;
}

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
    version: string;
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

export interface ClientReadyInfo {
    state: "ready";
    reason: ReadyReason;
    sockethubVersion: string;
    contexts: {
        as: string;
        sockethub: string;
    };
    platforms: Array<{
        id: string;
        version: string;
        contextUrl: string;
        contextVersion: string;
        schemaVersion: string;
        types: Array<string>;
    }>;
}

export interface ClientInitError {
    error: string;
    phase: InitErrorPhase;
    retrying: boolean;
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
    private readonly options: Required<SockethubClientOptions>;
    private platformRegistry = new Map<string, PlatformRegistryEntry>();
    private asContextUrl?: string;
    private sockethubContextUrl?: string;
    private sockethubVersion?: string;
    private initState: InitState = "idle";
    private hasReadyOnce = false;
    private initCycle?: InitializationCycle;
    private initTokenCounter = 0;
    private initTimeoutTimer?: ReturnType<typeof setTimeout>;
    private waitingWarningTimer?: ReturnType<typeof setInterval>;
    private waitingWarningIntervalMs = 10000;
    private readyWaiters: Array<PendingReadyWaiter> = [];
    private outboundQueue: Array<QueuedOutboundEvent> = [];
    private outboundSequence = 0;
    private registryFingerprint?: string;
    private latestReadyInfo?: ClientReadyInfo;

    constructor(socket: Socket, options: SockethubClientOptions = {}) {
        if (!socket) {
            throw new Error("SockethubClient requires a socket.io instance");
        }
        this._socket = socket;
        this.options = {
            initTimeoutMs: options.initTimeoutMs ?? 5000,
            maxQueuedOutbound: options.maxQueuedOutbound ?? 1000,
            maxQueuedAgeMs: options.maxQueuedAgeMs ?? 30000,
        };

        this.socket = this.createPublicEmitter();
        this.registerSocketIOHandlers();
        this.initActivityStreams();

        this.ActivityStreams.on(
            "activity-object-create",
            (obj: ActivityObject) => {
                this.socket.emit("activity-object", obj, (err: never) => {
                    if (err) {
                        console.error("failed to create activity-object ", err);
                    }
                });
            },
        );

        socket.on("activity-object", (obj) => {
            this.ActivityStreams.Object.create(obj);
        });

        if (this._socket.connected) {
            this.socket.connected = true;
            this.startInitialization("initial-connect", true);
        }
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
        return this.isReady();
    }

    /**
     * Indicates whether the client has completed schema initialization.
     */
    public isReady(): boolean {
        return this.initState === "ready";
    }

    /**
     * Returns the current client initialization state.
     */
    public getInitState(): InitState {
        return this.initState;
    }

    /**
     * Return the canonical base contexts learned from the server registry.
     */
    public getRegisteredBaseContexts(): { as: string; sockethub: string } {
        if (!this.asContextUrl || !this.sockethubContextUrl) {
            throw new Error(
                "Schema registry not loaded yet. Wait for client ready state after connect.",
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
     * @deprecated Use ready(timeoutMs?) instead.
     */
    public async waitForSchemas(
        timeoutMs = 2000,
    ): Promise<PlatformRegistryPayload> {
        await this.ready(timeoutMs);
        return this.buildPlatformRegistryPayload();
    }

    /**
     * Wait until the client reaches a ready state.
     */
    public ready(
        timeoutMs = this.options.initTimeoutMs,
    ): Promise<ClientReadyInfo> {
        if (this.initState === "closed") {
            return Promise.reject(new Error("SockethubClient is closed"));
        }
        if (this.isReady() && this.latestReadyInfo) {
            return Promise.resolve(this.latestReadyInfo);
        }
        return new Promise((resolve, reject) => {
            const waiter: PendingReadyWaiter = { resolve, reject };
            if (timeoutMs > 0) {
                waiter.timer = setTimeout(() => {
                    this.readyWaiters = this.readyWaiters.filter(
                        (entry) => entry !== waiter,
                    );
                    reject(
                        new Error(
                            `SockethubClient ready() timed out after ${timeoutMs}ms`,
                        ),
                    );
                }, timeoutMs);
            }
            this.readyWaiters.push(waiter);
            if (this.socket.connected && this.initState === "idle") {
                this.startInitialization(
                    this.hasReadyOnce ? "reconnect" : "initial-connect",
                    true,
                );
            }
        });
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
                "Schema registry not loaded yet. Wait for client ready state after connect.",
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

    /**
     * Resolve a platform ID from an @context array using the loaded registry.
     */
    private platformFromContextArray(contexts: unknown): string | undefined {
        if (!Array.isArray(contexts)) {
            return undefined;
        }
        for (const entry of contexts) {
            if (typeof entry !== "string") {
                continue;
            }
            for (const [platformId, platform] of this.platformRegistry) {
                if (platform.contextUrl === entry) {
                    return platformId;
                }
            }
        }
        return undefined;
    }

    private createPublicEmitter(): CustomEmitter {
        const socket = new EventEmitter() as CustomEmitter;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        socket._emit = socket.emit;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        socket.emit = (event, content, callback): void => {
            this.handlePublicEmit(event as string, content, callback);
        };
        socket.connected = false;
        socket.disconnect = () => {
            this.initState = "closed";
            this.initCycle = undefined;
            this.clearInitTimers();
            this.rejectReadyWaiters(new Error("Sockethub client disconnected"));
            this._socket.disconnect();
        };
        socket.connect = () => {
            if (this.initState === "closed") {
                this.initState = "idle";
            }
            this._socket.connect();
        };
        return socket;
    }

    /**
     * Ask server for the latest platform/context registry via ack callback.
     * This keeps client context composition aligned with server schema state.
     */
    private requestSchemaRegistry() {
        const socketLike = this._socket as unknown as Record<string, unknown>;
        if (!("io" in socketLike)) {
            return;
        }
        this._socket.emit("schemas", (payload: unknown) => {
            this.handleSchemasPayload(payload);
        });
    }

    /**
     * Apply server-provided registry metadata to local runtime state.
     * Also registers platform contexts/schemas with @sockethub/schemas validators
     * so local validation uses the same canonical sources as the server.
     */
    private applyPlatformRegistry(
        payload: unknown,
    ): PlatformRegistryPayload | undefined {
        if (!payload || typeof payload !== "object") {
            return undefined;
        }
        const registry = payload as PlatformRegistryPayload;
        const asContextUrl = registry.contexts?.as;
        const sockethubContextUrl = registry.contexts?.sockethub;
        if (
            typeof asContextUrl !== "string" ||
            typeof sockethubContextUrl !== "string" ||
            !Array.isArray(registry.platforms)
        ) {
            return undefined;
        }
        this.sockethubVersion =
            typeof registry.version === "string" ? registry.version : "unknown";
        this.asContextUrl = asContextUrl;
        this.sockethubContextUrl = sockethubContextUrl;

        this.platformRegistry.clear();
        for (const platform of registry.platforms) {
            if (
                !platform ||
                typeof platform !== "object" ||
                typeof platform.id !== "string" ||
                typeof platform.version !== "string" ||
                typeof platform.contextUrl !== "string"
            ) {
                continue;
            }
            this.platformRegistry.set(platform.id, {
                ...platform,
                version: platform.version,
                types: Array.isArray(platform.types) ? platform.types : [],
                schemas: platform.schemas || {},
            });
            this.registerPlatformSchema(
                platform.schemas?.credentials || {},
                `${platform.id}/credentials`,
            );
            this.registerPlatformSchema(
                platform.schemas?.messages || {},
                `${platform.id}/messages`,
            );
        }
        const normalizedPayload = this.buildPlatformRegistryPayload();
        this.registryFingerprint = JSON.stringify(normalizedPayload);
        // Emit normalized registry payload so app code receives a stable shape.
        this.socket._emit("schemas", normalizedPayload);
        return normalizedPayload;
    }

    /**
     * Register platform schemas once per runtime key. The current schemas package
     * rejects duplicate addSchema calls for identical keys.
     */
    private registerPlatformSchema(schema: object, key: string): void {
        const fingerprint = JSON.stringify(schema || {});
        const existingFingerprint =
            registeredPlatformSchemaFingerprints.get(key);
        if (
            existingFingerprint !== undefined &&
            existingFingerprint !== fingerprint
        ) {
            throw new Error(
                `Conflicting schema registration for key '${key}' across clients`,
            );
        }
        if (registeredPlatformSchemaKeys.has(key)) {
            return;
        }
        addPlatformSchema(schema, key);
        registeredPlatformSchemaKeys.add(key);
        registeredPlatformSchemaFingerprints.set(key, fingerprint);
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

    private buildPlatformRegistryPayload(): PlatformRegistryPayload {
        return {
            version: this.sockethubVersion,
            contexts:
                this.asContextUrl && this.sockethubContextUrl
                    ? {
                          as: this.asContextUrl,
                          sockethub: this.sockethubContextUrl,
                      }
                    : undefined,
            platforms: this.getRegisteredPlatforms(),
        };
    }

    private buildReadyInfo(reason: ReadyReason): ClientReadyInfo | undefined {
        if (
            !this.sockethubVersion ||
            !this.asContextUrl ||
            !this.sockethubContextUrl
        ) {
            return undefined;
        }
        return {
            state: "ready",
            reason,
            sockethubVersion: this.sockethubVersion,
            contexts: {
                as: this.asContextUrl,
                sockethub: this.sockethubContextUrl,
            },
            platforms: this.getRegisteredPlatforms().map((platform) => ({
                id: platform.id,
                version: platform.version,
                contextUrl: platform.contextUrl,
                contextVersion: platform.contextVersion,
                schemaVersion: platform.schemaVersion,
                types: [...platform.types],
            })),
        };
    }

    private resolveReadyWaiters(info: ClientReadyInfo) {
        const waiters = this.readyWaiters;
        this.readyWaiters = [];
        for (const waiter of waiters) {
            if (waiter.timer) {
                clearTimeout(waiter.timer);
            }
            waiter.resolve(info);
        }
    }

    private rejectReadyWaiters(err: Error) {
        const waiters = this.readyWaiters;
        this.readyWaiters = [];
        for (const waiter of waiters) {
            if (waiter.timer) {
                clearTimeout(waiter.timer);
            }
            waiter.reject(err);
        }
    }

    private emitInitError(
        error: string,
        phase: InitErrorPhase,
        retrying: boolean,
    ) {
        this.socket._emit("init_error", {
            error,
            phase,
            retrying,
        } satisfies ClientInitError);
    }

    private emitClientError(
        event: string,
        callback: unknown,
        errorMessage: string,
    ) {
        if (typeof callback === "function") {
            callback({ error: errorMessage });
            return;
        }
        this.socket._emit("client_error", {
            event,
            error: errorMessage,
        });
    }

    private clearInitTimers() {
        if (this.initTimeoutTimer) {
            clearTimeout(this.initTimeoutTimer);
            this.initTimeoutTimer = undefined;
        }
        if (this.waitingWarningTimer) {
            clearInterval(this.waitingWarningTimer);
            this.waitingWarningTimer = undefined;
        }
    }

    private startWaitingWarnings() {
        if (this.waitingWarningTimer) {
            return;
        }
        this.waitingWarningTimer = setInterval(() => {
            if (this.isReady() || this.initState === "closed") {
                this.clearInitTimers();
                return;
            }
            const queueSize = this.outboundQueue.length;
            const oldest = this.outboundQueue[0];
            const oldestAgeSeconds = oldest
                ? ((Date.now() - oldest.enqueuedAt) / 1000).toFixed(1)
                : "0.0";
            console.warn(
                `[SockethubClient] Still waiting for schemas; queued outbound messages: ${queueSize}; oldest queued age: ${oldestAgeSeconds}s.`,
            );
        }, this.waitingWarningIntervalMs);
    }

    private startInitialization(reason: ReadyReason, replayOnReady: boolean) {
        if (!this.socket.connected || this.initState === "closed") {
            return;
        }

        const token = ++this.initTokenCounter;
        this.initCycle = {
            token,
            reason,
            startedAt: Date.now(),
            replayOnReady,
            timedOut: false,
        };
        this.initState = "initializing";
        this.clearInitTimers();

        this.initTimeoutTimer = setTimeout(() => {
            if (!this.initCycle || this.initCycle.token !== token) {
                return;
            }
            this.initCycle.timedOut = true;
            this.initState = "init_error";
            const timeoutMsg = `Initialization timed out after ${this.options.initTimeoutMs}ms waiting for schemas`;
            console.warn(
                `[SockethubClient] ${timeoutMsg}; queued outbound messages: ${this.outboundQueue.length}. Waiting for schemas event from server.`,
            );
            this.emitInitError(timeoutMsg, "timeout", true);
            this.startWaitingWarnings();
        }, this.options.initTimeoutMs);

        try {
            // Pull the latest registry from the server for this init cycle.
            this.requestSchemaRegistry();
        } catch (err) {
            this.initState = "init_error";
            const message = err instanceof Error ? err.message : String(err);
            this.emitInitError(message, "schemas-request", true);
            this.startWaitingWarnings();
        }
    }

    private markReady(reason: ReadyReason) {
        const cycle = this.initCycle;
        const recoveryDelaySeconds = cycle
            ? ((Date.now() - cycle.startedAt) / 1000).toFixed(1)
            : "0.0";
        const wasTimeoutRecovery = Boolean(cycle?.timedOut);
        const replayOnReady = Boolean(cycle?.replayOnReady);
        this.initCycle = undefined;
        this.clearInitTimers();
        this.initState = "ready";
        this.hasReadyOnce = true;

        const info = this.buildReadyInfo(reason);
        if (!info) {
            const err = new Error("Failed to build ready payload");
            this.initState = "init_error";
            this.emitInitError(err.message, "schemas-apply", true);
            this.rejectReadyWaiters(err);
            return;
        }
        this.socket._emit("ready", info);
        this.latestReadyInfo = info;
        this.resolveReadyWaiters(info);

        if (replayOnReady) {
            // Replay previously sent state before flushing newly queued outbound events.
            this.replay("activity-object", this.events["activity-object"]);
            this.replay("credentials", this.events.credentials);
            this.replay("message", this.events.connect);
            this.replay("message", this.events.join);
        }

        if (wasTimeoutRecovery) {
            console.warn(
                `[SockethubClient] Initialization recovered; flushing ${this.outboundQueue.length} queued messages after ${recoveryDelaySeconds}s delay.`,
            );
        }

        this.flushOutboundQueue();
    }

    private computePayloadFingerprint(payload: unknown): string | undefined {
        if (!payload || typeof payload !== "object") {
            return undefined;
        }
        const registry = payload as PlatformRegistryPayload;
        if (
            typeof registry.contexts?.as !== "string" ||
            typeof registry.contexts?.sockethub !== "string" ||
            !Array.isArray(registry.platforms)
        ) {
            return undefined;
        }
        const normalizedPlatforms = registry.platforms
            .map((platform) => ({
                id: platform.id,
                version: platform.version,
                contextUrl: platform.contextUrl,
                contextVersion: platform.contextVersion,
                schemaVersion: platform.schemaVersion,
            }))
            .sort((a, b) => a.id.localeCompare(b.id));
        return JSON.stringify({
            version: registry.version,
            contexts: registry.contexts,
            platforms: normalizedPlatforms,
        });
    }

    private handleSchemasPayload(payload: unknown) {
        if (!payload || typeof payload !== "object") {
            return;
        }
        const incomingFingerprint = this.computePayloadFingerprint(payload);
        if (
            this.initState === "ready" &&
            !this.initCycle &&
            incomingFingerprint &&
            incomingFingerprint === this.registryFingerprint
        ) {
            return;
        }

        if (this.initState === "ready" && !this.initCycle) {
            // A server-side schema update arrived while already running.
            this.initState = "initializing";
        }

        const normalizedPayload = this.applyPlatformRegistry(payload);
        if (!normalizedPayload) {
            this.initState = "init_error";
            this.emitInitError(
                "Received invalid schemas payload from server",
                "schemas-apply",
                true,
            );
            this.startWaitingWarnings();
            return;
        }

        if (this.initCycle) {
            this.markReady(this.initCycle.reason);
            return;
        }
        this.markReady("schemas-update");
    }

    private handlePublicEmit(
        event: string,
        content: unknown,
        callback?: unknown,
    ) {
        const queuedEvent: QueuedOutboundEvent = {
            event,
            content,
            callback,
            enqueuedAt: Date.now(),
            sequence: this.outboundSequence++,
        };

        if (!this.isReady()) {
            // Hold outbound until schemas/context metadata is loaded.
            this.enqueueOutbound(queuedEvent);
            return;
        }
        this.sendOutbound(queuedEvent);
    }

    private enqueueOutbound(queuedEvent: QueuedOutboundEvent) {
        this.outboundQueue.push(queuedEvent);
        if (this.outboundQueue.length <= this.options.maxQueuedOutbound) {
            return;
        }
        const dropped = this.outboundQueue.shift();
        if (!dropped) {
            return;
        }
        this.emitClientError(
            dropped.event,
            dropped.callback,
            "SockethubClient queue overflow before ready",
        );
    }

    private flushOutboundQueue() {
        if (!this.isReady() || this.outboundQueue.length === 0) {
            return;
        }
        const now = Date.now();
        const queued = this.outboundQueue.sort(
            (a, b) => a.sequence - b.sequence,
        );
        this.outboundQueue = [];
        for (const entry of queued) {
            if (now - entry.enqueuedAt > this.options.maxQueuedAgeMs) {
                this.emitClientError(
                    entry.event,
                    entry.callback,
                    `SockethubClient queued message expired after ${this.options.maxQueuedAgeMs}ms before initialization`,
                );
                continue;
            }
            this.sendOutbound(entry);
        }
    }

    private sendOutbound(entry: QueuedOutboundEvent) {
        let outgoing = entry.content;
        try {
            if (entry.event === "credentials" || entry.event === "message") {
                // Run canonical expansion/normalization at send time so queued and
                // immediate sends follow the exact same path.
                outgoing = this.ActivityStreams.Stream(
                    entry.content as ActivityStream,
                );
                if (outgoing && typeof outgoing === "object") {
                    const activity = outgoing as ActivityStream;
                    if (!activity.platform) {
                        if (typeof activity.context === "string") {
                            activity.platform = activity.context;
                        } else {
                            const inferredPlatform =
                                this.platformFromContextArray(
                                    activity["@context"],
                                );
                            if (inferredPlatform) {
                                activity.platform = inferredPlatform;
                            }
                        }
                    }
                    if (!activity.context && activity.platform) {
                        // Keep legacy context populated so current server/runtime code
                        // can continue to route and validate during phased migration.
                        activity.context = activity.platform;
                    }
                    if (
                        !activity["@context"] &&
                        typeof activity.platform === "string" &&
                        activity.platform.trim().length > 0
                    ) {
                        activity["@context"] = this.contextFor(
                            activity.platform,
                        );
                    }
                    if (
                        activity.actor &&
                        typeof activity.actor === "object" &&
                        !activity.actor.type
                    ) {
                        activity.actor.type = "person";
                    }
                }
                if (this.platformRegistry.size > 0) {
                    const validationError = this.validateActivity(
                        outgoing as ActivityStream,
                    );
                    if (validationError) {
                        this.emitClientError(
                            entry.event,
                            entry.callback,
                            `SockethubClient validation failed: ${validationError}`,
                        );
                        return;
                    }
                }
            }
            if (entry.event === "credentials") {
                this.eventCredentials(outgoing as ActivityStream);
            } else if (entry.event === "activity-object") {
                this.eventActivityObject(outgoing as ActivityObject);
            } else if (entry.event === "message") {
                this.eventMessage(outgoing as BaseActivityObject);
            }
            this._socket.emit(entry.event, outgoing, entry.callback);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.emitClientError(entry.event, entry.callback, message);
        }
    }

    private log(msg: string, obj?: unknown) {
        if (this.debug) {
            console.log(msg, obj);
        }
    }

    private registerSocketIOHandlers() {
        // register for events that give us information on connection status
        this._socket.on("connect", () => {
            this.socket.id = this._socket.id;
            this.socket.connected = true;
            this.socket._emit("connect");
            this.startInitialization(
                this.hasReadyOnce ? "reconnect" : "initial-connect",
                true,
            );
        });
        this._socket.on("connect_error", (obj?: unknown) => {
            this.socket._emit("connect_error", obj);
        });
        this._socket.on("disconnect", (obj?: unknown) => {
            this.socket.connected = false;
            if (this.initState !== "closed") {
                this.initState = "idle";
                this.rejectReadyWaiters(
                    new Error("Sockethub client disconnected"),
                );
            }
            this.clearInitTimers();
            this.socket._emit("disconnect", obj);
        });
        this._socket.on("schemas", (payload: unknown) => {
            this.handleSchemasPayload(payload);
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
