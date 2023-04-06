import {IActivityStream} from "@sockethub/schemas";

export type RedisConfigUrl = string;

export interface RedisConfigProps {
  host: string,
  port: string
}

export type RedisConfig = RedisConfigProps | RedisConfigUrl;

export interface JobDataEncrypted {
  title?: string;
  msg: string;
  sessionId: string;
}

export interface JobDataDecrypted {
  title?: string;
  msg: IActivityStream;
  sessionId: string;
}

export interface JobEncrypted {
  data: JobDataEncrypted,
  remove?: {
    (): void;
  };
}

export interface JobDecrypted {
  data: JobDataDecrypted,
  remove: {
    (): void;
  };
}

export interface JobActivityStream extends IActivityStream {
  id: string;
}
