/**
 * Sentry settings resolution, shared by the server process and its forked
 * platform workers.
 *
 * A worker is forked with an explicit environment allowlist rather than a copy
 * of the parent's environment, and it does not receive the parent's
 * `--config` argument either. It therefore cannot rediscover the settings the
 * parent resolved — a DSN supplied only via `SENTRY_DSN`, or any sampling and
 * redaction choice made in a config file the worker never reads. The parent
 * serializes its resolved block into `SOCKETHUB_SENTRY_CONFIG` so worker
 * errors reach the same project under the same settings.
 */

import { createLogger } from "@sockethub/logger";
import { errorMessage } from "@sockethub/util/error";
import config from "./config.js";

export type SentryConfig = {
    dsn: string;
    environment: string;
    release: string;
    enableLogs: boolean;
    logLevels: Array<"debug" | "info" | "warn" | "error">;
    enableMetrics: boolean;
    tracesSampleRate: number;
    profileSessionSampleRate: number;
    sendDefaultPii: boolean;
};

export const SENTRY_CONFIG_ENV = "SOCKETHUB_SENTRY_CONFIG";

const logger = createLogger("sentry:config");

/**
 * Serialize resolved Sentry settings for a forked platform worker. Returns
 * undefined when Sentry is not configured, so the worker's environment stays
 * as small as it is today and the worker skips Sentry entirely.
 */
export function serializeSentryConfig(
    sentryConfig: SentryConfig,
): string | undefined {
    if (!sentryConfig?.dsn) {
        return undefined;
    }
    return JSON.stringify(sentryConfig);
}

/**
 * Overlay the parent's forwarded settings onto this process's own resolved
 * block. Every key the parent sends wins; anything absent keeps the local
 * value. Throws on malformed JSON so the caller can log it rather than
 * silently reporting under different settings than the server.
 */
export function mergeForwardedSentryConfig(
    base: SentryConfig,
    rawConfig: string | undefined,
): SentryConfig {
    if (!rawConfig) {
        return base;
    }
    const parsed = JSON.parse(rawConfig);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${SENTRY_CONFIG_ENV} must be a JSON object`);
    }
    return { ...base, ...(parsed as Partial<SentryConfig>) };
}

/**
 * The Sentry settings this process should use: its own configuration in the
 * server process, overlaid with the parent's resolved block in a platform
 * worker. On malformed forwarded input, log and keep the local settings.
 */
export function resolveSentryConfig(): SentryConfig {
    const base = config.get("sentry") as SentryConfig;
    try {
        return mergeForwardedSentryConfig(base, process.env[SENTRY_CONFIG_ENV]);
    } catch (err) {
        logger.warn(
            `ignoring invalid ${SENTRY_CONFIG_ENV}: ${errorMessage(err)}`,
        );
        return base;
    }
}
