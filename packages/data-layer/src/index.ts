import CredentialsStore, {
    CredentialsObject,
    CredentialsStoreInstance,
    verifySecureStore,
} from "./credentials-store";
import JobQueue, { verifyJobQueue } from "./job-queue";
export * from "./types";
import debug from "debug";
import { RedisConfig } from "./types";

const log = debug("sockethub:data-layer");

async function redisCheck(config: RedisConfig): Promise<void> {
    log(`checking redis connection ${config.url}`);
    await verifySecureStore(config);
    await verifyJobQueue(config);
}

export {
    redisCheck,
    JobQueue,
    CredentialsStore,
    CredentialsObject,
    CredentialsStoreInstance,
};
