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
    data?: ActivityStream | ActivityStream[],
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
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    // biome-ignore lint/style/useShorthandFunctionType: <explanation>
    (msg: string, data?: any): void;
}

export interface PlatformSession {
    debug: Logger;
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

export type PlatformConfig = PersistentPlatformConfig | StatelessPlatformConfig;

interface BasePlatformConfig {
    connectTimeoutMs?: number;
}
export interface StatelessPlatformConfig extends BasePlatformConfig {
    persist: false;
    requireCredentials?: string[];
}

export interface PersistentPlatformConfig extends BasePlatformConfig {
    persist: true;
    requireCredentials: string[];
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
    new (session: PlatformSession): { debug: Logger };
}

export interface PlatformInterface {
    debug: Logger;
    credentialsHash?: string;
    get config(): PlatformConfig;
    get schema(): PlatformSchemaStruct;
    cleanup(cb: PlatformCallback): void;
}

export interface PlatformSession {
    debug: Logger;
    sendToClient: PlatformSendToClient;
    updateActor: PlatformUpdateActor;
}
