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

export interface PlatformCallback {
    (err?: ErrorMsg, data?: ActivityStream | ActivityStream[]): void;
}

export interface CallbackInterface {
    (err?: ErrorMsg, data?: unknown): void;
}

export interface MiddlewareCallback {
    (data: ActivityStream | Error): void;
}

export interface CompletedJobHandler {
    (data: ActivityStream | undefined): void;
}

export interface PlatformSendToClient {
    (msg: ActivityStream, special?: string): void;
}

export interface PlatformUpdateActor {
    (credentials: object): Promise<void>;
}

export interface Logger {
    // eslint-disable-next-line
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

export interface StatelessPlatformConfig {
    persist: false;
    requireCredentials?: string[];
}

export interface PersistentPlatformConfig {
    persist: true;
    requireCredentials: string[];
    initialized: boolean;
}

export interface PlatformSchemaStruct {
    name: string;
    version: string;
    credentials?: object;
    messages?: object;
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
