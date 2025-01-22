import pino from "npm:pino@9.6.0";

/**
 * A general interface for the structure of any ActivityStream
 */
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

/**
 * A general interface for any actor property of an ActivityStream.
 * An actor can be used on the `actor` or `target` properties.
 */
export interface ActivityActor extends BaseActivityObject {
  id: string;
  type: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * A general interface for any object property of an ActivityStream
 */
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

export interface PlatformSession {
  logger: pino.Logger<never, boolean>;
  sendToClient: PlatformSendToClient;
  updateActor: PlatformUpdateActor;
}

/**
 * Structure of a credential object which should be passed to any platform
 * that requires credentials to operate.
 */
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
  requireCredentials: false;
}

export interface PersistentPlatformConfig {
  persist: true;
  requireCredentials: true;
  initialized: boolean;
}

export interface PlatformMessages {
  required: string[];
  properties: {
    type: {
      enum: string[];
    };
  };
}
export interface PlatformSchemaStruct {
  name: string;
  version: string;
  credentials?: object;
  messages: PlatformMessages;
}

export interface PlatformConstructor<T> {
  new (session: PlatformSession): T;
}

/**
 * Basic required elements of a Sockethub platform class. A platform can
 * have more properties and functions, but should at least implement these.
 */
export interface PlatformInterface {
  logger: pino.Logger<never, boolean>;
  credentialsHash?: string;
  get config(): PlatformConfig;
  get schema(): PlatformSchemaStruct;
  cleanup(cb: PlatformCallback): void;
}

/**
 * A session object which is passed from Sockethub to an initialized platform,
 * allowing the platform to conduct certain types of communication and logging.
 */
export interface PlatformSession {
  logger: pino.Logger<never, boolean>;
  sendToClient: PlatformSendToClient;
  updateActor: PlatformUpdateActor;
}
