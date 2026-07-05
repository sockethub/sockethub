/**
 * This file is only imported if sentry reporting is enabled in the Sockethub config.
 */

import * as Sentry from "@sentry/node";
import { createLogger } from "@sockethub/logger";
import config from "./config";

const logger = createLogger("sentry");
if (!config.get("sentry:dsn")) {
    throw new Error("Sentry attempted initialization with no DSN provided");
}
Sentry.init(config.get("sentry"));
logger.info("initialized sentry");

export function reportError(err: Error): void {
    logger.warn("reporting error");
    Sentry.captureException(err);
}
