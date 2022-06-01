import {IActivityStream} from "@sockethub/schemas";

type ErrorMsg = string | Error;

export interface CallbackInterface {
  (err?: ErrorMsg, data?: unknown): void;
}

export interface CallbackActivityStreamInterface {
  (data: IActivityStream | Error): void;
}

export interface CompletedJobHandler {
  (data: IActivityStream): void;
}

export interface LogInterface {
  (msg: string): void;
}

export interface BasicFunctionInterface {
  (): void;
}
