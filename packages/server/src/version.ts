/** The running server's own version, read from the installed package manifest. */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

export const SOCKETHUB_VERSION: string = packageJson.version;

/**
 * The Sentry release identifier to report when the deployment has not set one
 * explicitly. Derived from the running package version so a deployment does
 * not have to be told, out of band, which version it is running.
 */
export function defaultSentryRelease(): string {
    return `sockethub@${SOCKETHUB_VERSION}`;
}
