/**
 * Stress test reporter - generates console and HTML reports
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { TestResult } from "./types";

const REPORTS_DIR = join(import.meta.dir, "reports");

interface ReportSummary {
    total: number;
    passed: number;
    warned: number;
    failed: number;
    results: TestResult[];
}

export function generateConsoleSummary(results: TestResult[]): void {
    const summary: ReportSummary = {
        total: results.length,
        passed: results.filter((r) => r.status === "pass").length,
        warned: results.filter((r) => r.status === "warn").length,
        failed: results.filter((r) => r.status === "fail").length,
        results,
    };

    console.log(
        "\n╔══════════════════════════════════════════════════════════╗",
    );
    console.log("║  TEST RESULTS SUMMARY                                    ║");
    console.log(
        "╚══════════════════════════════════════════════════════════╝\n",
    );

    results.forEach((result, index) => {
        const statusIcon = getStatusIcon(result.status);
        const baselineInfo = result.baseline_comparison
            ? formatDeviations(result.baseline_comparison.deviations)
            : "";

        console.log(`[${index + 1}/${results.length}] ${result.test_name}`);
        console.log(
            `      Status: ${statusIcon} ${result.status.toUpperCase()}`,
        );

        if (result.metrics.latency_p95) {
            console.log(
                `      Latency P95: ${result.metrics.latency_p95}ms ${baselineInfo}`,
            );
        }
        if (result.metrics.throughput) {
            console.log(
                `      Throughput: ${result.metrics.throughput} msg/sec`,
            );
        }
        if (result.metrics.error_rate !== undefined) {
            const errorIcon = result.metrics.error_rate > 1 ? "❌" : "✓";
            console.log(
                `      Error Rate: ${result.metrics.error_rate.toFixed(2)}% ${errorIcon}`,
            );
        }
        if (
            result.metrics.sockethub_errors !== undefined &&
            result.metrics.sockethub_errors > 0
        ) {
            console.log(
                `      Sockethub Errors: ${result.metrics.sockethub_errors} ❌`,
            );
        }
        console.log("");
    });

    console.log(`Results: ${summary.passed}/${summary.total} PASSED`);
    if (summary.warned > 0) {
        console.log(`⚠️  ${summary.warned} WARNING(S)`);
    }
    if (summary.failed > 0) {
        console.log(`❌ ${summary.failed} FAILED`);
    }
    console.log("");
}

function getStatusIcon(status: string): string {
    switch (status) {
        case "pass":
            return "✓";
        case "warn":
            return "⚠️";
        case "fail":
            return "❌";
        default:
            return "?";
    }
}

function formatDeviations(deviations: Record<string, number>): string {
    const parts = Object.entries(deviations).map(([key, value]) => {
        const sign = value >= 0 ? "+" : "";
        return `${sign}${value}%`;
    });
    return parts.length > 0 ? `(${parts.join(", ")})` : "";
}

export async function findLatestReport(): Promise<string | null> {
    if (!existsSync(REPORTS_DIR)) {
        return null;
    }

    const files = readdirSync(REPORTS_DIR)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse();

    return files.length > 0 ? join(REPORTS_DIR, files[0]) : null;
}

async function main() {
    const args = process.argv.slice(2);
    const showLatest = args.includes("--latest");

    if (showLatest) {
        const latestReport = await findLatestReport();
        if (!latestReport) {
            console.error("No reports found in stress-tests/reports/");
            process.exit(1);
        }

        const results: TestResult[] = JSON.parse(
            readFileSync(latestReport, "utf-8"),
        );
        generateConsoleSummary(results);
    } else {
        console.log("Usage: bun run stress:report --latest");
    }
}

if (import.meta.main) {
    main().catch(console.error);
}
