/**
 * This file is only imported if sentry reporting is enabled in the Sockethub config.
 */

import * as Sentry from "@sentry/bun";
import config from "./config";
Sentry.init({
    dsn: config.get("sentry"),
    // Tracing
    tracesSampleRate: 1.0, // Capture 100% of the transactions
});
