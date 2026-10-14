import { describe, expect, it } from "bun:test";
import { compareToBaseline } from "./bun/baseline-comparator";
import { DEFAULT_THRESHOLDS, PERFORMANCE_TESTS } from "./config";
import { extractMetrics } from "./metrics";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findLatestReport, generateHtmlReport } from "./reporter";
import type { Baseline, TestResult } from "./types";

const baseline: Baseline = {
    system: { hostname: "benchmark", cpus: 4, memory_gb: 8, os: "linux" },
    sockethub_version: "reference",
    generated_date: "2026-01-01",
    performance_metrics: {
        message_latency_p95_ms: 100,
        throughput_msg_per_sec: 100,
    },
    thresholds: DEFAULT_THRESHOLDS,
};
const result: TestResult = {
    test_name: "message-throughput",
    timestamp: "now",
    duration_sec: 10,
    metrics: {},
    status: "pass",
};

describe("benchmark metrics", () => {
    it("uses successful protocol actions and real elapsed time, including zero latency", () => {
        const extracted = extractMetrics(
            {
                aggregate: {
                    firstCounterAt: 1700000000000,
                    lastCounterAt: 1700000010000,
                    counters: {
                        "sockethub.attempt.xmpp": 100,
                        "sockethub.success.xmpp": 90,
                        "sockethub.connected": 20,
                        "vusers.created": 20,
                        "sockethub.error.xmpp": 10,
                        "sockethub.users_with_errors": 5,
                    },
                    summaries: {
                        "sockethub.latency.xmpp": {
                            median: 0,
                            p95: 20,
                            p99: 30,
                        },
                        "sockethub.latency.echo": { p95: 999 },
                    },
                },
            },
            PERFORMANCE_TESTS[2],
        );
        expect(extracted.duration_sec).toBe(10);
        expect(extracted.metrics).toMatchObject({
            throughput: 9,
            latency_p50: 0,
            latency_p95: 20,
            error_rate: 10,
            sockethub_errors: 10,
        });
    });
    it("keeps missing measurements absent and fails empty workloads", () => {
        expect(extractMetrics({}, PERFORMANCE_TESTS[1]).metrics).toEqual({
            connections: 0,
            sockethub_errors: 0,
            error_rate: 100,
        });
    });
    it("extracts connection latency independently of echo latency", () => {
        expect(
            extractMetrics(
                {
                    aggregate: {
                        summaries: {
                            "sockethub.latency.connection": { p95: 12 },
                        },
                    },
                },
                PERFORMANCE_TESTS[0],
            ).metrics.latency_p95,
        ).toBe(12);
    });
    it("accepts improvements and flags throughput or latency regressions", () => {
        expect(
            compareToBaseline(
                { ...result, metrics: { latency_p95: 10, throughput: 200 } },
                baseline,
            ).status,
        ).toBe("pass");
        expect(
            compareToBaseline(
                { ...result, metrics: { latency_p95: 140 } },
                baseline,
            ).status,
        ).toBe("fail");
        expect(
            compareToBaseline(
                { ...result, metrics: { throughput: 0 } },
                baseline,
            ).status,
        ).toBe("fail");
    });
    it("does not compare other workloads against the echo reference", () => {
        expect(
            compareToBaseline(
                {
                    ...result,
                    test_name: "multi-client-broadcast",
                    metrics: { throughput: 1 },
                },
                baseline,
            ).deviations,
        ).toEqual({});
    });
    it("selects suite reports instead of raw Artillery or baseline JSON", async () => {
        const directory = mkdtempSync(join(tmpdir(), "sockethub-reports-"));
        try {
            for (const name of [
                "2026-01-01-performance.json",
                "temp-999999.json",
                "baseline-999999.json",
            ])
                writeFileSync(join(directory, name), "[]");
            expect(await findLatestReport(directory)).toBe(
                join(directory, "2026-01-01-performance.json"),
            );
        } finally {
            rmSync(directory, { recursive: true });
        }
    });
    it("does not invent throughput when elapsed timestamps are missing", () => {
        expect(
            extractMetrics(
                {
                    aggregate: {
                        lastCounterAt: 1700000000000,
                        counters: {
                            "sockethub.attempt.echo": 10,
                            "sockethub.success.echo": 10,
                        },
                    },
                },
                PERFORMANCE_TESTS[1],
            ).metrics.throughput,
        ).toBeUndefined();
    });
    it("renders absent values and escapes scenario names in HTML", () => {
        const html = generateHtmlReport([
            { ...result, test_name: '<script>alert("x")</script>' },
        ]);
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
        expect(html).toContain("No latency samples");
    });
});
