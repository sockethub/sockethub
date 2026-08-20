/** Privacy-conscious Sentry observability for the server and platform workers. */

import * as Sentry from "@sentry/node";
import { createLogger, setLogSink } from "@sockethub/logger";
import config from "./config";
import {
    redactObservabilityLog,
    sanitizeObservabilityNamespace,
    setObservabilityAdapter,
} from "./observability.js";

type SentryConfig = {
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

type MetricAttributes = Record<string, string | number | boolean>;

const logger = createLogger("sentry");
const sentryConfig = config.get("sentry") as SentryConfig;

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
    release: sentryConfig.release || undefined,
    enableLogs: sentryConfig.enableLogs,
    enableMetrics: sentryConfig.enableMetrics,
    tracesSampleRate: sentryConfig.tracesSampleRate,
    profileSessionSampleRate: sentryConfig.profileSessionSampleRate,
    profileLifecycle: "trace",
    sendDefaultPii: sentryConfig.sendDefaultPii,
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
