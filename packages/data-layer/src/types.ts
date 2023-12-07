import { IActivityStream } from "@sockethub/schemas";

export type RedisConfig = {
    url: string;
};

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
    data: JobDataEncrypted;
    remove?: {
        (): void;
    };
}

export interface JobDecrypted {
    data: JobDataDecrypted;
    remove?: {
        (): void;
    };
}

export interface JobHandler {
    (job: JobDataDecrypted): Promise<string | void | IActivityStream>;
}
