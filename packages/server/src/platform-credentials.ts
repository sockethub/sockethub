/**
 * Credential handling shared by the server and the platform child: deriving
 * per-session secrets, validating stored credentials against the hashes a
 * connection was authorized with, and moving credentials when a platform
 * renames its actor.
 */

import {
    buildCredentialsKey,
    CredentialsMismatchError,
} from "@sockethub/data-layer";
import type { CredentialsObject } from "@sockethub/schemas";
import { crypto } from "@sockethub/util/crypto";
import { errorMessage } from "@sockethub/util/error";

export function derivePlatformCredentialsSecret(
    parentSecret: string,
    sessionSecret: string,
): string {
    return crypto.deriveSecret(parentSecret, sessionSecret);
}

/**
 * Write credentials after the platform has renamed the actor (IRC nick
 * change). The next credentialed command loads this key and compares the
 * object to `credentialsHash`; leaving Redis under the pre-rename actor
 * fails that check and detaches the session from the live connection.
 */
export async function storeActorCredentials(
    store: {
        save(key: string, creds: CredentialsObject): Promise<unknown>;
    },
    platformName: string,
    credentials: CredentialsObject,
): Promise<void> {
    const actorId = credentials.actor?.id;
    if (typeof actorId !== "string" || actorId.length === 0) {
        throw new Error(
            `cannot store updated credentials for ${platformName} without an actor id`,
        );
    }
    await store.save(buildCredentialsKey(platformName, actorId), credentials);
}

export interface CredentialStoreReader {
    get(key: string, credentialsHash?: string): Promise<CredentialsObject>;
    save(key: string, creds: CredentialsObject): Promise<unknown>;
    objectHash?(object: unknown): string;
}

/**
 * Checks a session's stored credential object against the hashes this
 * connection has been authorized with.
 *
 * `currentHash` is unset until the first credentialed call succeeds, so
 * that call is accepted as-is. After that the object must hash to the
 * current value or to one in `acceptedHashes`: the hash the connection was
 * first authorized with, plus the one each actor rename produced. A rename
 * rewrites the nick inside the object this worker holds, but a client that
 * reconnects replays the object it originally sent, keyed under the new
 * actor. That object already proved it holds the secret for this
 * connection; refusing it would detach the session from a connection it
 * owns. A different secret still fails.
 */
export function assertAcceptedCredentials(
    credentials: CredentialsObject,
    currentHash: string | undefined,
    acceptedHashes: ReadonlySet<string>,
    key: string,
): void {
    if (!currentHash) {
        return;
    }
    const hash = crypto.objectHash(credentials.object);
    if (hash === currentHash || acceptedHashes.has(hash)) {
        return;
    }
    throw new CredentialsMismatchError(`invalid credentials for ${key}`);
}

function credentialsNotFound(err: unknown): boolean {
    return (
        err instanceof Error &&
        err.message.startsWith("credentials not found for ")
    );
}

/**
 * Moves one session's stored credentials from the pre-rename actor to the new
 * actor. Skips peers that never stored the account being renamed. Refuses to
 * overwrite a different account already stored under the new actor id.
 * `dryRun` runs the same checks without writing.
 */
export async function renameActorCredentialsInStore(
    store: CredentialStoreReader,
    platformName: string,
    previousActorId: string,
    renamed: CredentialsObject,
    options?: { dryRun?: boolean },
): Promise<"migrated" | "skipped"> {
    const newActorId = renamed.actor?.id;
    if (typeof newActorId !== "string" || newActorId.length === 0) {
        throw new Error(
            `cannot rename ${platformName} credentials without a new actor id`,
        );
    }
    const oldKey = buildCredentialsKey(platformName, previousActorId);
    const newKey = buildCredentialsKey(platformName, newActorId);
    if (oldKey === newKey) {
        return "skipped";
    }

    try {
        await store.get(oldKey);
    } catch (err) {
        if (credentialsNotFound(err)) {
            return "skipped";
        }
        throw err;
    }

    const objectHash = store.objectHash ?? crypto.objectHash;
    try {
        const existingAtNew = await store.get(newKey);
        if (objectHash(existingAtNew.object) !== objectHash(renamed.object)) {
            throw new Error(
                `cannot rename ${previousActorId} to ${newActorId}: credentials already stored for ${newActorId}`,
            );
        }
        return "skipped";
    } catch (err) {
        if (!credentialsNotFound(err)) {
            throw err;
        }
    }

    if (options?.dryRun) {
        return "migrated";
    }
    await store.save(newKey, renamed);
    return "migrated";
}

export interface SessionCredentialWriter {
    sessionId: string;
    renameActorCredentials(
        previousActorId: string,
        renamed: CredentialsObject,
    ): Promise<"migrated" | "skipped">;
}

/**
 * Persists renamed credentials for every attached session except the one that
 * already stored them in the platform child before reporting the actor change.
 */
export async function migrateRenamedActorCredentials(
    platformName: string,
    previousActorId: string,
    credentials: CredentialsObject,
    writers: Iterable<SessionCredentialWriter>,
): Promise<void> {
    const failures: string[] = [];
    for (const writer of writers) {
        try {
            await writer.renameActorCredentials(previousActorId, credentials);
        } catch (err) {
            failures.push(`${writer.sessionId}: ${errorMessage(err)}`);
        }
    }
    if (failures.length > 0) {
        throw new Error(
            `failed to migrate renamed ${platformName} credentials for ${failures.length} session(s): ${failures.join("; ")}`,
        );
    }
}
