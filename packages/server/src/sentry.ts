/**
 * This file is only imported if sentry reporting is enabled in the Sockethub config.
 */

import * as Sentry from "@sentry/bun";
import config from "./config";
if (!config.get("sentry:dsn")) {
    throw new Error("Sentry enabled but no DSN provided");
}
Sentry.init({
    dsn: config.get("sentry:dsn"),
    // Tracing
    tracesSampleRate: 1.0, // Capture 100% of the transactions
});
