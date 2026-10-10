import type {
    ActivityStream,
    ServiceDescriptor,
    ServiceEndpoints,
} from "@sockethub/schemas";
import {
    normalizeActivityStream,
    validateActivityStream,
    validateCredentials,
} from "@sockethub/schemas";
import EventEmitter from "eventemitter3";
import type { ManagerOptions, Socket, SocketOptions } from "socket.io-client";
import {
    type PlatformRegistryEntry,
    type PlatformRegistryPayload,
    parsePlatformRegistry,
    registerPlatformSchemas,
} from "./client-registry";
import {
    type DiscoverOptions,
    DiscoveryError,
    discoverSockethub,
    resolveEndpoint,
    resolveSocketFactory,
    type SocketFactory,
} from "./discovery";
import {
    hasActorId,
    isActorRename,
    isErrorResult,
    ReplayStore,
} from "./replay-store";

export type { ServiceDescriptor, ServiceEndpoints };
export type {
    PlatformRegistryEntry,
    PlatformRegistryPayload,
} from "./client-registry";
export {
    type DiscoverOptions,
    DiscoveryError,
    discoverSockethub,
    resolveEndpoint,
    type SocketFactory,
} from "./discovery";
export type { EventMapping } from "./replay-store";

type ReplayEventMap = {
    credentials: ActivityStream;
    message: ActivityStream;
};

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

export interface ConnectOptions
    extends SockethubClientOptions,
        DiscoverOptions {
    /**
     * The `io()` factory to create the socket with. Defaults to the `io`
     * global set by `/socket.io.js`, then to the `socket.io-client` package
     * when it can be imported.
     */
    io?: SocketFactory;
    /**
     * Extra Socket.IO options (auth, transports, ...). `path` is always taken
     * from the discovered descriptor.
     */
    socketOptions?: Partial<ManagerOptions & SocketOptions>;
}

interface CustomEmitter extends EventEmitter {
    _emit(s: string, o: unknown, c?: unknown): void;
    connect(): void;
    disconnect(): void;
    connected: boolean;
    id: string;
}

export interface ClientReadyInfo {
    state: "ready";
    reason: ReadyReason;
    // Global Sockethub API version (the server package's SemVer major).
    apiVersion: number;
    contexts: {
        as: string;
        sockethub: string;
    };
    platforms: Array<{
        id: string;
        apiVersion: number;
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
 * When one of this client's actors is renamed (an `update` with
 * `object.type: "address"`, e.g. an IRC nick change, whether this client
 * requested it and the server acknowledged it, or the server reported it),
 * the stored entries move to the new actor so a reconnect replays the current
 * identity rather than the old one.
 *
 * @example
 * ```typescript
 * // Discover the Socket.IO endpoint from the server's base URL and connect
 * const client = await SockethubClient.connect('http://localhost:10550');
 *
 * // Or wrap a socket you created yourself
 * const client = new SockethubClient(io('http://localhost:10550', { path: '/sockethub' }));
 *
 * // Wait for schema registry before sending messages
 * await client.ready();
 *
 * // Build canonical @context for a platform
 * const ctx = client.contextFor('irc');
 *
 * // Send credentials - these will be replayed on reconnection
 * client.socket.emit('credentials', {
 *   '@context': ctx,
 *   type: 'credentials',
 *   actor: { id: 'user@example.com', type: 'person' },
 *   object: { type: 'credentials', username: 'user', password: 'pass' }
 * });
 * ```
 */
export default class SockethubClient {
    private replayStore = new ReplayStore();
    private _socket: Socket;
    public socket!: CustomEmitter;
    public debug = true;
    /**
     * The service descriptor fetched by `SockethubClient.connect()`: API
     * versions, enabled platforms, and the advertised endpoints (including
     * `endpoints.httpActions` when that transport is on). Undefined for
     * clients built from a ready-made socket.
     */
    public readonly descriptor?: ServiceDescriptor;
    /**
     * The origin the descriptor was discovered from and the socket connects
     * to. `endpointUrl()` resolves the descriptor's endpoint paths against it.
     * Undefined for clients built from a ready-made socket.
     */
    public readonly serverOrigin?: string;

    /**
     * Absolute URL of an advertised endpoint, resolved against
     * `serverOrigin`, or undefined when the server does not advertise it (for
     * example `httpActions` while HTTP actions are disabled) or when this
     * client was not created by `connect()`.
     *
     * @example
     * ```typescript
     * const url = sc.endpointUrl('httpActions');
     * if (url) {
     *   await fetch(url, { method: 'POST', body });
     * }
     * ```
     */
    public endpointUrl(name: keyof ServiceEndpoints): string | undefined {
        const path = this.descriptor?.endpoints?.[name];
        if (!this.serverOrigin || !path) {
            return undefined;
        }
        return resolveEndpoint(this.serverOrigin, path);
    }
    private readonly options: Required<SockethubClientOptions>;
    private platformRegistry = new Map<string, PlatformRegistryEntry>();
    private asContextUrl?: string;
    private sockethubContextUrl?: string;
    private apiVersion?: number;
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

    /**
     * Discover a server's endpoints from its base URL and connect to it.
     *
     * Fetches the base URL with `Accept: application/json`, validates the
     * service descriptor, and opens a Socket.IO connection to the base URL's
     * origin with the advertised path. The descriptor is exposed as
     * `client.descriptor` and the origin as `client.serverOrigin`. Rejects
     * with a `DiscoveryError` when the server is unreachable, does not answer
     * with JSON, or does not advertise a Socket.IO endpoint.
     *
     * @example
     * ```typescript
     * const sc = await SockethubClient.connect('https://sh.example.org', {
     *   initTimeoutMs: 5000,
     * });
     * await sc.ready();
     * console.log(sc.endpointUrl('httpActions')); // absolute URL, or undefined
     * ```
     */
    public static async connect(
        baseUrl: string,
        options: ConnectOptions = {},
    ): Promise<SockethubClient> {
        const {
            io,
            socketOptions,
            fetch,
            discoveryTimeoutMs,
            ...clientOptions
        } = options;
        const descriptor = await discoverSockethub(baseUrl, {
            fetch,
            discoveryTimeoutMs,
        });
        const socketPath = descriptor.endpoints?.socketIO;
        if (!socketPath) {
            throw new DiscoveryError(
                `Sockethub discovery failed: ${baseUrl} does not advertise a Socket.IO endpoint (older server?); pass a socket to the constructor instead`,
            );
        }
        // The socket goes to the origin that answered discovery; the
        // descriptor only says which path Socket.IO is mounted on there.
        const serverOrigin = new URL(baseUrl).origin;
        const createSocket = await resolveSocketFactory(io);
        const socket = createSocket(serverOrigin, {
            ...socketOptions,
            path: socketPath,
        });
        return new SockethubClient(socket, clientOptions, {
            descriptor,
            serverOrigin,
        });
    }

    constructor(
        socket: Socket,
        options: SockethubClientOptions = {},
        discovered?: { descriptor: ServiceDescriptor; serverOrigin: string },
    ) {
        if (!socket) {
            throw new Error("SockethubClient requires a socket.io instance");
        }
        this._socket = socket;
        this.descriptor = discovered?.descriptor;
        this.serverOrigin = discovered?.serverOrigin;
        this.options = {
            initTimeoutMs: options.initTimeoutMs ?? 5000,
            maxQueuedOutbound: options.maxQueuedOutbound ?? 1000,
            maxQueuedAgeMs: options.maxQueuedAgeMs ?? 30000,
        };

        this.socket = this.createPublicEmitter();
        this.registerSocketIOHandlers();

        if (this._socket.connected) {
            this.socket.connected = true;
            (this.socket as unknown as { id?: string }).id = this._socket.id;
            this.socket._emit("connect");
            this.startInitialization("initial-connect", true);
        }
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
        this.replayStore.events.credentials.clear();
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
    private requestSchemaRegistry() {
        const socketLike = this._socket as unknown as Record<string, unknown>;
        if (!("io" in socketLike)) {
            return;
        }
        // Echo the fingerprint we last applied so the server can short-circuit
        // with an "unchanged" reply on reconnect/re-request (#1117).
        this._socket.emit(
            "schemas",
            this.registryFingerprint,
            (payload: unknown) => {
                this.handleSchemasPayload(payload);
            },
        );
    }

    /**
     * Apply server-provided registry metadata to local runtime state.
     * Also registers platform contexts/schemas with @sockethub/schemas validators
     * so local validation uses the same canonical sources as the server.
     */
    private applyPlatformRegistry(
        payload: unknown,
    ): PlatformRegistryPayload | undefined {
        const parsed = parsePlatformRegistry(payload);
        if (!parsed) {
            return undefined;
        }
        this.apiVersion = parsed.apiVersion;
        this.asContextUrl = parsed.asContextUrl;
        this.sockethubContextUrl = parsed.sockethubContextUrl;
        this.platformRegistry = parsed.platforms;
        for (const platform of parsed.platforms.values()) {
            registerPlatformSchemas(platform);
        }
        const normalizedPayload = this.buildPlatformRegistryPayload();
        // Dedup only on the server's fingerprint, which is computed over the
        // full payload (including schema bodies and types). Without one we leave
        // the fingerprint unset so handleSchemasPayload never short-circuits and
        // a schema change can't be silently missed (#1117 review).
        const registry = payload as PlatformRegistryPayload;
        this.registryFingerprint =
            typeof registry.fingerprint === "string"
                ? registry.fingerprint
                : undefined;
        // Emit normalized registry payload so app code receives a stable shape.
        this.socket._emit("schemas", normalizedPayload);
        return normalizedPayload;
    }

    private buildPlatformRegistryPayload(): PlatformRegistryPayload {
        return {
            apiVersion: this.apiVersion,
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
            this.apiVersion === undefined ||
            !this.asContextUrl ||
            !this.sockethubContextUrl
        ) {
            return undefined;
        }
        return {
            state: "ready",
            reason,
            apiVersion: this.apiVersion,
            contexts: {
                as: this.asContextUrl,
                sockethub: this.sockethubContextUrl,
            },
            platforms: this.getRegisteredPlatforms().map((platform) => ({
                id: platform.id,
                apiVersion: platform.apiVersion,
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
            this.emitInitError(timeoutMsg, "timeout", false);
            this.startWaitingWarnings();
        }, this.options.initTimeoutMs);

        try {
            // Pull the latest registry from the server for this init cycle.
            this.requestSchemaRegistry();
        } catch (err) {
            this.initState = "init_error";
            const message = err instanceof Error ? err.message : String(err);
            this.emitInitError(message, "schemas-request", false);
            this.startWaitingWarnings();
        }
    }

    private markReady(reason: ReadyReason) {
        const cycle = this.initCycle;
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
            const { credentials, connect, join } = this.replayStore.events;
            this.replay("credentials", credentials);
            this.replay("message", connect);
            this.replay("message", join);
        }

        this.flushOutboundQueue();
    }

    private handleSchemasPayload(payload: unknown) {
        if (!payload || typeof payload !== "object") {
            return;
        }
        // Server short-circuit: the registry matches the fingerprint we echoed,
        // so nothing was re-sent (#1117). Only honor this when we actually hold
        // a cached registry to reuse — a malformed or empty "unchanged" reply
        // must not fast-path init to ready with no validators registered.
        if ((payload as PlatformRegistryPayload).unchanged === true) {
            const haveCachedRegistry =
                typeof this.registryFingerprint === "string" &&
                this.platformRegistry.size > 0;
            if (haveCachedRegistry) {
                if (this.initCycle) {
                    this.markReady(this.initCycle.reason);
                } else if (this.initState !== "ready") {
                    this.markReady("schemas-update");
                }
                return;
            }
            // Nothing cached to reuse: fall through so applyPlatformRegistry
            // rejects the contentless payload and surfaces an init error.
        }
        // Dedup only against the server-supplied fingerprint (which is what we
        // stored in applyPlatformRegistry); absent one, always re-apply.
        const incomingFingerprint = (payload as PlatformRegistryPayload)
            .fingerprint;
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
                outgoing = normalizeActivityStream(
                    entry.content as ActivityStream,
                );
                if (outgoing && typeof outgoing === "object") {
                    const activity = outgoing as ActivityStream;
                    if (entry.event === "credentials" && !activity.type) {
                        activity.type = "credentials";
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
            let callback = entry.callback;
            if (entry.event === "credentials") {
                this.replayStore.recordCredentials(outgoing as ActivityStream);
            } else if (entry.event === "message") {
                if (this._socket.connected) {
                    this.replayStore.recordMessage(outgoing as ActivityStream);
                }
                callback = this.rememberRequestedRename(
                    outgoing as ActivityStream,
                    callback,
                );
            }
            this._socket.emit(entry.event, outgoing, callback);
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
            }
            this.clearInitTimers();
            this.socket._emit("disconnect", obj);
        });
        this._socket.on("schemas", (payload: unknown) => {
            this.handleSchemasPayload(payload);
        });

        // use as middleware to receive incoming Sockethub messages and unpack them
        // Normalize and lint before passing them along to the app.
        this._socket.on("message", (obj) => {
            const incoming = normalizeActivityStream(obj);
            this.followActorRename(incoming);
            this.socket._emit("message", incoming);
        });
    }

    /**
     * Keeps the replay maps on the actor the server now knows after a rename
     * the server reported.
     *
     * A server-forced nick change arrives as an incoming `update` with
     * `object.type: "address"`. The stored credentials, connect, and join
     * entries are keyed by the actor at send time, so left alone a reconnect
     * would replay the old nick and open a second connection under an
     * identity this one no longer holds.
     *
     * Only entries for the renamed actor on that platform move. The maps hold
     * only this client's own actors, and `rememberRequestedRename` keeps them
     * on the nick this connection currently holds, so a rename of some other
     * user (including one who later took a nick this client released) never
     * matches a stored entry.
     *
     * A rejected nick change is not a rename. The server echoes the failed
     * job — the original update plus `error` — to every other session sharing
     * the connection. Following that echo would point those sessions at a
     * nick the server refused, so their next command misses the live worker
     * and opens a second connection.
     */
    private followActorRename(incoming: ActivityStream): void {
        if (isErrorResult(incoming)) {
            return;
        }
        if (isActorRename(incoming)) {
            this.moveReplayState(incoming);
        }
    }

    /**
     * Moves the replay maps when a nick change this client requested is
     * acknowledged. The platform consumes the server's confirmation as the
     * job's completion rather than delivering it as a message, so without
     * this the maps would stay on the released nick: a reconnect would
     * replay it, and whoever took it in the meantime could steer where
     * `followActorRename` moves this client's state.
     */
    private rememberRequestedRename(
        outgoing: ActivityStream,
        callback: unknown,
    ): unknown {
        if (!isActorRename(outgoing)) {
            return callback;
        }
        return (...args: unknown[]) => {
            // Socket.IO delivers the ack as `(result)`, or as `(err, result)`
            // when the socket was created with `ackTimeout`. A timeout or a
            // dropped socket arrives as an Error in the first slot; the
            // server reports a rejected rename as `{ error }` in whichever
            // slot carries the result.
            const [first, second] = args;
            const failed =
                first instanceof Error ||
                isErrorResult(first) ||
                isErrorResult(second);
            if (!failed) {
                this.moveReplayState(outgoing);
            }
            if (typeof callback === "function") {
                callback(...args);
            }
        };
    }

    private moveReplayState(rename: ActivityStream): void {
        for (const [previousId, nextId] of this.replayStore.moveActor(rename)) {
            this.log(`replay state moved from ${previousId} to ${nextId}`);
        }
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
     * @param name - Event name to emit ("credentials", "message")
     * @param asMap - Map of events to replay
     */
    private replay<K extends keyof ReplayEventMap>(
        name: K,
        asMap: Map<string, ReplayEventMap[K]>,
    ): void {
        for (const obj of asMap.values()) {
            const expandedObj = normalizeActivityStream(obj as ActivityStream);
            let id = expandedObj?.id;
            if (hasActorId(expandedObj)) {
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
