import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";

export interface MailServer {
    host: string;
    port?: number;
    secure?: boolean;
    username: string;
    password?: string;
    token?: string;
}
export interface EmailCredentials extends CredentialsObject {
    object: CredentialsObject["object"] & {
        imap?: MailServer;
        smtp?: MailServer;
        from: string;
    };
}
export interface EmailAttachment {
    filename?: string;
    contentType: string;
}
export interface Cursor {
    uidValidity: string;
    uid: number;
}
export interface Filter {
    from?: string[];
    to?: string[];
    match?: "any" | "all";
}
export interface FetchOptions extends Filter {
    folders?: string[];
    cursors?: Record<string, Cursor>;
    limit?: number;
}
export interface WatchOptions extends Filter {
    folder?: string;
    cursor?: Cursor;
}
export interface SendOptions {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    content?: string;
    html?: string;
    inReplyTo?: string;
    references?: string[];
}
export type EmailJob<T> = ActivityStream & {
    object?: ActivityStream["object"] & T;
};
