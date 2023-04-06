export interface IActivityStream {
  type: string;
  context: string;
  actor: IActivityObjectActor;
  object?: IActivityObjectObject;
  target?: IActivityObjectActor;
  error?: string;
  sessionSecret?: string;
}

export interface IActivityObject {
  id?: string;
  type: string;
}

export interface IActivityObjectActor extends IActivityObject {
  id: string;
  name?: string;
}

export interface IActivityObjectObject extends IActivityObject {
  content?: string;
}

type ErrorMsg = string | Error;

export interface CallbackInterface {
  (err?: ErrorMsg, data?: unknown): void;
}

export interface CallbackActivityStreamInterface {
  (data: IActivityStream | Error): void;
}

export interface CompletedJobHandler {
  (data: IActivityStream|undefined): void;
}

export interface LogInterface {
  (msg: string): void;
}

export type ObjectRefs = Array<Record<string, string>>;
