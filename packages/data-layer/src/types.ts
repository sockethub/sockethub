import type {
    ActivityStream,
    InternalActivityStream,
} from "@sockethub/schemas";

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
    msg: InternalActivityStream;
    sessionId: string;
}

export interface JobEncrypted {
    data: JobDataEncrypted;
    remove?: () => void;
}

export interface JobDecrypted {
    data: JobDataDecrypted;
    returnvalue: unknown;
    remove?: () => void;
}

export type JobHandler = (
    job: JobDataDecrypted,
) => Promise<string | void | ActivityStream>;
