/**
 * This file is only imported if sentry reporting is enabled in the Sockethub config.
 */

import * as Sentry from "@sentry/bun";
import { createLogger } from "@sockethub/logger";
import config from "./config";

const logger = createLogger("sockethub:sentry");
if (!config.get("sentry:dsn")) {
    throw new Error("Sentry attempted initialization with no DSN provided");
}
logger.info("initialized");
Sentry.init(config.get("sentry"));

export function reportError(err: Error): void {
    logger.warn("reporting error");
    Sentry.captureException(err);
}
