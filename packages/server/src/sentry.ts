/**
 * This file is only imported if sentry reporting is enabled in the Sockethub config.
 */

import * as Sentry from "@sentry/bun";
import config from "./config";
if (!config.get("sentry:dsn")) {
    throw new Error("Sentry attempted initialization with no DSN provided");
}
Sentry.init(config.get("sentry"));
