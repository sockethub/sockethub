/**
 * Stress test configuration and thresholds
 */
import type { TestConfig, Thresholds } from "./types";

export const DEFAULT_SOCKETHUB_URL = "http://localhost:10550";

export const TOLERANCE_PCT = 15; // ±15% baseline tolerance

// Error thresholds for test pass/fail determination
export const CI_ERROR_RATE_THRESHOLD_PCT = 10; // CI mode: fail if error rate exceeds this
export const SOCKETHUB_ERROR_THRESHOLD_PCT = 5; // Fail if Sockethub errors exceed this % of users
export const ARTILLERY_ERROR_THRESHOLD_RATIO = 0.5; // Fail if Artillery errors exceed this ratio of users

export const DEFAULT_THRESHOLDS: Thresholds = {
    latency_p95_warn_ms: 150,
    latency_p95_fail_ms: 200,
    error_rate_warn_pct: 0.5,
    error_rate_fail_pct: 1.0,
};

export const PERFORMANCE_TESTS: TestConfig[] = [
    {
        type: "performance",
        platform: "dummy",
        scenario: "connection-baseline",
        sockethub_url: DEFAULT_SOCKETHUB_URL,
        tolerance_pct: TOLERANCE_PCT,
    },
    {
        type: "performance",
        platform: "dummy",
        scenario: "message-throughput",
        sockethub_url: DEFAULT_SOCKETHUB_URL,
        tolerance_pct: TOLERANCE_PCT,
    },
    {
        type: "performance",
        platform: "xmpp",
        scenario: "multi-client-broadcast",
        sockethub_url: DEFAULT_SOCKETHUB_URL,
        tolerance_pct: TOLERANCE_PCT,
    },
];

export const STRESS_TESTS: TestConfig[] = [
    {
        type: "stress",
        platform: "dummy",
        scenario: "connection-storm",
        sockethub_url: DEFAULT_SOCKETHUB_URL,
        tolerance_pct: TOLERANCE_PCT,
    },
    {
        type: "stress",
        platform: "xmpp",
        scenario: "message-flood",
        sockethub_url: DEFAULT_SOCKETHUB_URL,
        tolerance_pct: TOLERANCE_PCT,
    },
    {
        type: "stress",
        platform: "feed",
        scenario: "feed-processing-stress",
        sockethub_url: DEFAULT_SOCKETHUB_URL,
        tolerance_pct: TOLERANCE_PCT,
    },
    {
        type: "stress",
        platform: "dummy",
        scenario: "spike-test",
        sockethub_url: DEFAULT_SOCKETHUB_URL,
        tolerance_pct: TOLERANCE_PCT,
    },
];

export const SOAK_TESTS: TestConfig[] = [
    {
        type: "soak",
        platform: "dummy",
        scenario: "long-duration-stability",
        sockethub_url: DEFAULT_SOCKETHUB_URL,
        tolerance_pct: TOLERANCE_PCT,
    },
];

export const ALL_TESTS = [...PERFORMANCE_TESTS, ...STRESS_TESTS, ...SOAK_TESTS];
