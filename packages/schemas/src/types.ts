export interface ASCollection {
    context: string;
    id?: string;
    summary: string;
    type: "collection";
    totalItems: number;
    items: Array<ActivityStream>;
}

export interface ActivityStream {
    id?: string;
    type: string;
    context: string;
    actor: ActivityActor;
    object?: ActivityObject;
    target?: ActivityActor;
    error?: string;
}

export interface InternalActivityStream extends ActivityStream {
    sessionSecret?: string;
}

export interface BaseActivityObject {
    id?: string;
    type: string;
}

export interface ActivityActor extends BaseActivityObject {
    id: string;
    type: string;
    name?: string;
    [key: string]: unknown;
}

export interface ActivityObject extends BaseActivityObject {
    content?: string;
    [key: string]: unknown;
}

type ErrorMsg = string | Error;

export type PlatformCallback = (
    err?: ErrorMsg,
    data?: ActivityStream | ASCollection,
) => void;

export type CallbackInterface = (err?: ErrorMsg, data?: unknown) => void;

export type MiddlewareCallback = (data: ActivityStream | Error) => void;

export type CompletedJobHandler = (data: ActivityStream | undefined) => void;

export type PlatformSendToClient = (
    msg: ActivityStream,
    special?: string,
) => void;

export type PlatformUpdateActor = (credentials: object) => Promise<void>;

export interface Logger {
    error(message: string, meta?: object): void;
    warn(message: string, meta?: object): void;
    info(message: string, meta?: object): void;
    debug(message: string, meta?: object): void;
}

export interface PlatformSession {
    log: Logger;
    sendToClient: PlatformSendToClient;
    updateActor: PlatformUpdateActor;
}

export interface CredentialsObject {
    context: string;
    type: "credentials";
    actor: ActivityActor;
    object: {
        type: "credentials";
        [x: string | number | symbol]: unknown;
    };
    target?: ActivityActor;
}

/**
 * Platform configuration discriminated union.
 *
 * Sockethub platforms are either stateless or persistent:
 *
 * **Stateless (persist: false):**
 * - Process starts per-request and exits when complete
 * - May require credentials for individual operations
 * - No state maintained between requests
 * - Example: Feeds, Metadata
 *
 * **Persistent (persist: true):**
 * - Process maintains long-running connection state
 * - Always requires credentials (connection tied to actor identity)
 * - Single actor per instance (credentialsHash validates requests)
 * - Example: IRC, XMPP
 */
export type PlatformConfig = StatelessPlatformConfig | PersistentPlatformConfig;

interface BasePlatformConfig {
    connectTimeoutMs?: number;
}

/** Configuration for stateless platforms that start/stop per-request */
export interface StatelessPlatformConfig extends BasePlatformConfig {
    persist: false;
    requireCredentials?: string[];
}

/**
 * Configuration for persistent platforms with long-running connections.
 * These always require credentials because persistent state is actor-specific.
 */
export interface PersistentPlatformConfig extends BasePlatformConfig {
    persist: true;
    /** Message types requiring credentials (must be non-empty for persistent platforms) */
    requireCredentials: string[];
    /** Whether the platform has completed initialization */
    initialized: boolean;
}

export interface PlatformSchemaStruct {
    name: string;
    version: string;
    credentials?: object;
    messages?: {
        required?: string[];
        properties?: {
            type?: {
                enum?: string[];
            };
        };
    };
}

export interface PlatformConstructor {
    new (session: PlatformSession): { log: Logger };
}

/**
 * Base interface for all Sockethub platforms.
 * Platforms implement protocol-specific logic for ActivityStreams messages.
 */
export interface PlatformInterface {
    log: Logger;
    get config(): PlatformConfig;
    get schema(): PlatformSchemaStruct;
    cleanup(cb: PlatformCallback): void;
}

/**
 * Interface for persistent platforms with long-running connections.
 *
 * Persistent platforms maintain state tied to a single actor's credentials.
 * The credentialsHash property tracks which credentials this instance is bound to,
 * ensuring that all requests to this platform instance come from the same actor.
 */
export interface PersistentPlatformInterface extends PlatformInterface {
    /**
     * Hash of the credentials object this platform instance is bound to.
     * Used to validate that incoming requests match the actor this instance serves.
     * Prevents credential mismatches and ensures single-actor per instance.
     *
     * May be undefined before credentials are established. Callers should handle both cases.
     */
    credentialsHash: string | undefined;
    get config(): PersistentPlatformConfig;
    connect(
        job: ActivityStream,
        credentials: CredentialsObject,
        done: PlatformCallback,
    ): void;
}

export interface PlatformSession {
    log: Logger;
    sendToClient: PlatformSendToClient;
    updateActor: PlatformUpdateActor;
}
