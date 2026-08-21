/**
 * Argument handling for the flags that short-circuit startup.
 *
 * Deliberately free of imports from the config singleton: `--help` and
 * `--version` must answer even when the config file in the working directory
 * is missing or invalid, and must never reach the point of binding a port.
 */

import { SOCKETHUB_VERSION } from "./version.js";

export function renderHelp(): string {
    return `Sockethub v${SOCKETHUB_VERSION} — a protocol gateway for web applications

Usage: sockethub [options]

Options:
  -c, --config <path>       Path to a config file (default: ./sockethub.config.json,
                            or the SOCKETHUB_CONFIG environment variable)
      --write-config [path] Write a default config file and exit ("-" for stdout,
                            default: ./sockethub.config.json)
      --host <host>         Address to bind (config: sockethub.host)
      --port <port>         Port to bind (config: sockethub.port)
      --redis.url <url>     Redis connection URL (config: redis.url)
      --cors.origin <list>  Allowed CORS origin(s), comma-separated
                            (config: sockethub.cors.origin)
      --sentry.dsn <dsn>    Sentry DSN to report to (config: sentry.dsn)
      --sentry-test         Send a test event to Sentry and exit, reporting
                            whether it was accepted
      --sentry-test-crash   Report a synthetic fatal error to Sentry and exit
                            non-zero, exercising the crash-reporting path
      --examples            Serve the bundled example pages
      --info                Print runtime information
  -v, --version             Print the version and exit
  -h, --help                Print this help and exit

Every config file setting can also be set by environment variable; see
docs/configuration.md for the full list.
`;
}

/**
 * The short-circuit flag present in `argv`, if any. `--help` wins over
 * `--version` when both are given.
 */
export function parseInfoFlag(
    argv: Array<string>,
): "help" | "version" | undefined {
    if (argv.includes("--help") || argv.includes("-h")) {
        return "help";
    }
    if (argv.includes("--version") || argv.includes("-v")) {
        return "version";
    }
    return undefined;
}
