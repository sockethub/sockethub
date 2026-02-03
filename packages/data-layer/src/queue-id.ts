const REDIS_QUEUE_PREFIX = "sockethub";

// Canonical ids use ':' separators; BullMQ queue names are derived by replacing
// ':' with '-' when constructing the queue name.
export function buildQueueId(parentId: string, instanceId: string): string {
    return `${REDIS_QUEUE_PREFIX}:${parentId}:data-layer:queue:${instanceId}`;
}

export function buildCredentialsStoreId(
    parentId: string,
    sessionId: string,
): string {
    return `${REDIS_QUEUE_PREFIX}:${parentId}:data-layer:credentials-store:${sessionId}`;
}
