/**
 * TypeScript type definitions for Sockethub stress testing
 */

export interface SystemProfile {
    hostname: string;
    cpus: number;
    memory_gb: number;
    os: string;
    redis_version?: string;
}

export interface PerformanceMetrics {
    connection_p95_ms: number;
    message_latency_p95_ms: number;
    throughput_msg_per_sec: number;
}

export interface StressLimits {
    max_concurrent_connections: number;
    max_throughput_msg_per_sec: number;
    degradation_start_connections: number;
}

export interface Thresholds {
    latency_p95_warn_ms: number;
    latency_p95_fail_ms: number;
    error_rate_warn_pct: number;
    error_rate_fail_pct: number;
}

export interface Baseline {
    system: SystemProfile;
    sockethub_version: string;
    generated_date: string;
    performance_metrics: PerformanceMetrics;
    stress_limits: StressLimits;
    thresholds: Thresholds;
}

export interface TestResult {
    test_name: string;
    timestamp: string;
    duration_sec: number;
    metrics: {
        connections?: number;
        throughput?: number;
        latency_p50?: number;
        latency_p95?: number;
        latency_p99?: number;
        error_rate?: number;
        memory_mb?: number;
    };
    status: "pass" | "warn" | "fail";
    baseline_comparison?: {
        within_tolerance: boolean;
        deviations: Record<string, number>;
    };
}

export interface TestConfig {
    type: "performance" | "stress" | "soak";
    platform: "dummy" | "xmpp" | "feed";
    scenario: string;
    sockethub_url: string;
    tolerance_pct: number;
}
