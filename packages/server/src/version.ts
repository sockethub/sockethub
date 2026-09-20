/** The running server's own version, read from the installed package manifest. */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

export const SOCKETHUB_VERSION: string = packageJson.version;

/**
 * Derive a public API version from a package SemVer string: the major version.
 * Breaking API changes always require a major bump (prereleases included), so
 * the major is the compatibility number clients check, and the exact release
 * never has to be published. `5.2.1` and `5.0.0-alpha.24` both report `5`.
 */
export function apiVersionFromSemver(version: string): number {
    const match = /^v?(\d+)(?:[.+-]|$)/.exec(version.trim());
    if (!match) {
        throw new Error(`cannot derive API version from "${version}"`);
    }
    return Number(match[1]);
}

/** The global Sockethub API version published to clients. */
export const SOCKETHUB_API_VERSION: number =
    apiVersionFromSemver(SOCKETHUB_VERSION);

/**
 * The Sentry release identifier to report when the deployment has not set one
 * explicitly. Derived from the running package version so a deployment does
 * not have to be told, out of band, which version it is running.
 */
export function defaultSentryRelease(): string {
    return `sockethub@${SOCKETHUB_VERSION}`;
}
