/** Privacy-conscious Sentry observability for the server and platform workers. */

import * as Sentry from "@sentry/node";
import { createLogger, setLogSink } from "@sockethub/logger";
import {
    redactObservabilityLog,
    sanitizeObservabilityNamespace,
    setObservabilityAdapter,
} from "./observability.js";
import { resolveSentryConfig } from "./sentry-config.js";
import { defaultSentryRelease } from "./version.js";

type MetricAttributes = Record<string, string | number | boolean>;

/** How long fatal-error paths wait for queued events to reach Sentry. */
export const SENTRY_FLUSH_TIMEOUT_MS = 2000;

const logger = createLogger("sentry");
const sentryConfig = resolveSentryConfig();

if (!sentryConfig.dsn) {
    throw new Error("Sentry attempted initialization with no DSN provided");
}

const integrations = [];
if (sentryConfig.profileSessionSampleRate > 0) {
    const { nodeProfilingIntegration } = await import("@sentry/profiling-node");
    integrations.push(nodeProfilingIntegration());
}

Sentry.init({
    dsn: sentryConfig.dsn,
    environment: sentryConfig.environment,
    // Fall back to the running package version so releases are tagged
    // correctly without every deployment having to restate its own version.
    release: sentryConfig.release || defaultSentryRelease(),
    enableLogs: sentryConfig.enableLogs,
    enableMetrics: sentryConfig.enableMetrics,
    tracesSampleRate: sentryConfig.tracesSampleRate,
    profileSessionSampleRate: sentryConfig.profileSessionSampleRate,
    profileLifecycle: "trace",
    sendDefaultPii: sentryConfig.sendDefaultPii,
    // Sockethub fetches caller-controlled feed and metadata URLs. Never attach
    // project/deployment baggage or trace identifiers to outbound requests.
    tracePropagationTargets: [],
    // Do not continue arbitrary trace headers received by the public server.
    strictTraceContinuation: true,
    integrations,
});

if (sentryConfig.enableLogs) {
    const enabledLevels = new Set(sentryConfig.logLevels);
    setLogSink(({ level, message, namespace }) => {
        const normalizedLevel = level as "debug" | "info" | "warn" | "error";
        if (!enabledLevels.has(normalizedLevel)) {
            return;
        }
        Sentry.logger[normalizedLevel](redactObservabilityLog(message), {
            namespace: sanitizeObservabilityNamespace(namespace),
        });
    });
}

Sentry.setTag("service", "sockethub");
Sentry.setTag(
    "process",
    process.env.SOCKETHUB_PLATFORM_CHILD === "1" ? "platform" : "server",
);
logger.info("initialized sentry observability");

export function reportError(err: Error): void {
    logger.warn("reporting error");
    Sentry.captureException(err);
}

/**
 * Drain queued events to Sentry. `captureException` only enqueues; a process
 * that exits without flushing discards everything still in the buffer, which
 * is exactly the case for fatal-error paths that call `process.exit`.
 * Resolves `false` if the timeout elapsed with events still unsent.
 */
export function flush(timeoutMs = SENTRY_FLUSH_TIMEOUT_MS): Promise<boolean> {
    return Sentry.flush(timeoutMs);
}

export function count(
    name: string,
    value = 1,
    attributes: MetricAttributes = {},
): void {
    if (sentryConfig.enableMetrics) {
        Sentry.metrics.count(name, value, { attributes });
    }
}

export function gauge(
    name: string,
    value: number,
    attributes: MetricAttributes = {},
): void {
    if (sentryConfig.enableMetrics) {
        Sentry.metrics.gauge(name, value, { attributes });
    }
}

export function startAction(
    platform: string,
    action: string,
): (error?: boolean) => void {
    const startedAt = performance.now();
    const attributes = { platform, action };
    count("sockethub.action.started", 1, attributes);
    const span = Sentry.startInactiveSpan({
        name: `${platform}.${action}`,
        op: "sockethub.action",
        attributes,
    });
    return (error = false) => {
        const duration = performance.now() - startedAt;
        span.setStatus({ code: error ? 2 : 1 });
        span.end();
        count(
            error ? "sockethub.action.failed" : "sockethub.action.completed",
            1,
            attributes,
        );
        if (sentryConfig.enableMetrics) {
            Sentry.metrics.distribution("sockethub.action.duration", duration, {
                unit: "millisecond",
                attributes,
            });
        }
    };
}

export async function sendTestEvent(): Promise<boolean> {
    Sentry.captureMessage("Sockethub Sentry verification event", "info");
    return Sentry.flush(5000);
}

setObservabilityAdapter({ count, gauge, startAction });
