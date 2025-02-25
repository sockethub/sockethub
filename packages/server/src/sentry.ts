/**
 * This file is only imported if sentry reporting is enabled in the Sockethub config.
 */

import * as Sentry from "@sentry/bun";
import debug from "debug";
import config from "./config";

const logger = debug("sockethub:sentry");
if (!config.get("sentry:dsn")) {
    throw new Error("Sentry attempted initialization with no DSN provided");
}
logger("initialized");
Sentry.init(config.get("sentry"));

export function reportError(err: Error): void {
    logger("reporting error");
    Sentry.captureException(err);
}
