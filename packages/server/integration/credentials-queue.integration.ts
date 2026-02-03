import { afterEach, describe, expect, it } from "bun:test";
import { crypto } from "@sockethub/crypto";
import {
    CredentialsStore,
    type JobDataDecrypted,
    JobQueue,
    JobWorker,
} from "@sockethub/data-layer";
import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";

import { derivePlatformCredentialsSecret } from "../src/platform.js";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_URL = process.env.REDIS_URL || `redis://${REDIS_HOST}:6379`;

describe("credentials + queue integration", () => {
    const parentId = `parent-${crypto.randToken(8)}`;
    const sessionId = `session-${crypto.randToken(8)}`;
    const parentSecret1 = crypto.randToken(16);
    const parentSecret2 = crypto.randToken(16);
    const sessionSecret = crypto.randToken(16);
    const queueSecret = parentSecret1 + parentSecret2;

    const actorId = `user-${crypto.randToken(6)}@localhost`;
    const credentials: CredentialsObject = {
        type: "credentials",
        context: "xmpp",
        actor: { id: actorId, type: "person" },
        object: {
            type: "credentials",
            userAddress: actorId,
            password: "passw0rd",
            server: "xmpp://localhost:5222",
        },
    };

    let store: CredentialsStore | undefined;
    let queue: JobQueue | undefined;
    let worker: JobWorker | undefined;

    afterEach(async () => {
        if (queue) {
            queue.removeAllListeners();
            await queue.shutdown();
            queue = undefined;
        }
        if (worker) {
            await worker.shutdown();
            worker = undefined;
        }
        if (store) {
            await store.store.disconnect();
            store = undefined;
        }
    });

    it("round-trips credentials through queue + platform secret derivation", async () => {
        const credentialsSecret = crypto.deriveSecret(
            parentSecret1,
            sessionSecret,
        );
        store = new CredentialsStore(parentId, sessionId, credentialsSecret, {
            url: REDIS_URL,
        });
        await store.save(actorId, credentials);

        queue = new JobQueue(parentId, "platform-id", queueSecret, {
            url: REDIS_URL,
        });
        worker = new JobWorker(parentId, "platform-id", queueSecret, {
            url: REDIS_URL,
        });

        const message = {
            type: "connect",
            context: "xmpp",
            actor: { id: actorId, type: "person" },
            sessionSecret,
        } as ActivityStream & { sessionSecret: string };

        const processed = new Promise<void>((resolve) => {
            worker?.onJob(async (job: JobDataDecrypted) => {
                const derived = derivePlatformCredentialsSecret(
                    parentSecret1,
                    job.msg.sessionSecret as string,
                );
                const platformStore = new CredentialsStore(
                    parentId,
                    job.sessionId,
                    derived,
                    { url: REDIS_URL },
                );
                const fetched = await platformStore.get(
                    actorId,
                    crypto.objectHash(credentials.object),
                );
                expect(fetched).toEqual(credentials);
                await platformStore.store.disconnect();
                resolve();
                return undefined;
            });
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
        await queue.add(sessionId, message);
        await processed;
    });
});
