import type {
    ActivityActor,
    CredentialsObject,
    Logger,
    PlatformSendToClient,
    PlatformSession,
} from "@sockethub/schemas";

export interface XmppPlatformSession extends PlatformSession {
    id: string;
}

export interface XmppCredentialsObject extends CredentialsObject {
    object: {
        type: string;
        userAddress: string;
        password: string;
        server?: string;
        port?: number;
        resource: string;
    };
}

export interface XmppBuiltCredentials {
    service: string;
    username: string;
    password: string;
    resource?: string;
}

/**
 * Narrow interface for what IncomingHandlers uses from the XMPP platform instance.
 * Avoids a circular import between incoming-handlers.ts and index.ts.
 */
export interface XmppHandlerSession {
    log: Logger;
    sendToClient: PlatformSendToClient;
    __knownRooms: Set<string>;
    actor?: ActivityActor;
    connection?: { disconnect?: () => void };
}
