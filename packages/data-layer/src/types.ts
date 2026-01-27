import type {
    ActivityStream,
    InternalActivityStream,
} from "@sockethub/schemas";

export type RedisConfig = {
    url: string;
    connectTimeout?: number;
    disconnectTimeout?: number;
    maxRetriesPerRequest?: number | null;
    connectionName?: string;
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
    remove?: () => void;
    returnvalue: unknown;
}

export type JobHandler = (
    job: JobDataDecrypted,
) => Promise<string | undefined | ActivityStream>;
