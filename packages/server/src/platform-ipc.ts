/**
 * The wire protocol between the server (PlatformInstance) and a forked
 * platform child (platform.ts). Every IPC message is a tuple whose first
 * element names the command. This is the only place both sides' message
 * shapes are declared; the parent handles `MessageFromPlatform` and the
 * child handles `MessageToPlatformChild`.
 */

import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";
import {
    buildCanonicalContext,
    INTERNAL_PLATFORM_CONTEXT_URL,
} from "@sockethub/schemas";

/** Child -> parent. */
export type MessageFromPlatform =
    /**
     * The platform renamed its actor (IRC nick change). The child waits for
     * `updateActorAck` or `updateActorFailed` before continuing. With
     * `dryRun` the parent only checks for credential collisions in peer
     * sessions and writes nothing.
     */
    | [
          "updateActor",
          actorId: string | null | undefined,
          newIdentifier: string,
          credentials?: CredentialsObject,
          originatingSessionId?: string,
          dryRun?: boolean,
      ]
    /** A session failed credential validation on a running connection. */
    | ["sessionUnauthorized", null | undefined, sessionId: string]
    /** Fatal error; the child exits right after sending this. */
    | ["error", string]
    | ["heartbeat", ActivityStream]
    /** Anything else (`message`, `close`) is delivered to every session. */
    | [command: string, ActivityStream, special?: string];

/** Parent -> child. */
export type MessageToPlatformChild =
    | ["secrets", { parentSecret1: string; parentSecret2: string }]
    | ["updateActorAck"]
    | ["updateActorFailed", string];

export function heartbeatMessage(): ActivityStream {
    return {
        type: "heartbeat",
        "@context": buildCanonicalContext(INTERNAL_PLATFORM_CONTEXT_URL),
        actor: { id: "sockethub", type: "platform" },
        object: { type: "heartbeat", timestamp: Date.now() },
    } as ActivityStream;
}
