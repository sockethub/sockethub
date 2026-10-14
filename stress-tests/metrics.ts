import type { TestConfig, TestResult } from "./types";

export interface ArtilleryReport {
    aggregate?: {
        counters?: Record<string, number>;
        summaries?: Record<
            string,
            { median?: number; p95?: number; p99?: number }
        >;
        firstCounterAt?: number;
        lastCounterAt?: number;
    };
}

/** Extract protocol metrics; missing samples remain absent rather than becoming zero. */
export function extractMetrics(
    report: ArtilleryReport,
    test: TestConfig,
): {
    metrics: TestResult["metrics"];
    duration_sec: number;
} {
    const aggregate = report.aggregate;
    const counters = aggregate?.counters || {};
    const duration_sec =
        aggregate?.firstCounterAt !== undefined &&
        aggregate.lastCounterAt !== undefined
            ? Math.max(
                  0,
                  (aggregate.lastCounterAt - aggregate.firstCounterAt) / 1000,
              )
            : 0;
    const protocol =
        test.scenario === "connection-baseline"
            ? "connection"
            : test.platform === "dummy"
              ? "echo"
              : test.platform;
    const latency = aggregate?.summaries?.[`sockethub.latency.${protocol}`];
    const successful = counters[`sockethub.success.${protocol}`] || 0;
    const attempts = counters[`sockethub.attempt.${protocol}`] || 0;
    const users = counters["vusers.created"] || 0;
    const failedUsers = counters["vusers.failed"] || 0;
    const usersWithErrors = counters["sockethub.users_with_errors"] || 0;
    const sockethubErrors = Object.entries(counters)
        .filter(([key]) => key.startsWith("sockethub.error."))
        .reduce((sum, [, value]) => sum + value, 0);
    const metrics: TestResult["metrics"] = {
        connections: counters["sockethub.connected"] || 0,
        sockethub_errors: sockethubErrors,
        error_rate:
            attempts > 0
                ? ((attempts - successful) / attempts) * 100
                : protocol === "connection" && users > 0
                  ? (Math.max(failedUsers, usersWithErrors) / users) * 100
                  : 100,
    };
    if (latency) {
        metrics.latency_p50 = latency.median;
        metrics.latency_p95 = latency.p95;
        metrics.latency_p99 = latency.p99;
    }
    if (attempts > 0 && duration_sec > 0)
        metrics.throughput = successful / duration_sec;
    return { metrics, duration_sec };
}
