/**
 * Stress test reporter - generates console and HTML reports
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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

        if (result.metrics.latency_p95 !== undefined) {
            console.log(
                `      Latency P95: ${result.metrics.latency_p95}ms ${baselineInfo}`,
            );
        }
        if (result.metrics.throughput !== undefined) {
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
    const parts = Object.entries(deviations).map(([_key, value]) => {
        const sign = value >= 0 ? "+" : "";
        return `${sign}${value}%`;
    });
    return parts.length > 0 ? `(${parts.join(", ")})` : "";
}

export async function findLatestReport(
    directory = REPORTS_DIR,
): Promise<string | null> {
    if (!existsSync(directory)) {
        return null;
    }

    const files = readdirSync(directory)
        .filter(
            (f) =>
                f.endsWith(".json") &&
                !f.startsWith("temp-") &&
                !f.startsWith("baseline-"),
        )
        .sort()
        .reverse();

    return files.length > 0 ? join(directory, files[0]) : null;
}

function escapeHtml(value: string): string {
    return value.replace(
        /[&<>"']/g,
        (character) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[character] || character,
    );
}

export function generateHtmlReport(results: TestResult[]): string {
    const rows = results
        .map((result) => {
            const metrics = result.metrics;
            const number = (value: number | undefined) =>
                value === undefined ? "—" : value.toFixed(2);
            return `<tr><td>${escapeHtml(result.test_name)}</td><td>${escapeHtml(result.status)}</td><td>${number(metrics.latency_p50)}</td><td>${number(metrics.latency_p95)}</td><td>${number(metrics.latency_p99)}</td><td>${number(metrics.throughput)}</td><td>${number(metrics.error_rate)}</td></tr>`;
        })
        .join("");
    const maximum = Math.max(
        1,
        ...results.map((result) => result.metrics.latency_p95 || 0),
    );
    const bars = results
        .map((result, index) => {
            const value = result.metrics.latency_p95;
            const y = index * 40 + 25;
            return `<text x="10" y="${y}">${escapeHtml(result.test_name)}</text>${value === undefined ? `<text x="250" y="${y}">No latency samples</text>` : `<rect x="250" y="${y - 15}" width="${(value / maximum) * 300}" height="20" fill="#2563eb"/><text x="${260 + (value / maximum) * 300}" y="${y}">${value.toFixed(2)} ms</text>`}`;
        })
        .join("");
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sockethub benchmark report</title><style>body{font:16px system-ui;margin:2rem}table{border-collapse:collapse}th,td{padding:.6rem;border-bottom:1px solid #ccc;text-align:left}svg{max-width:100%;height:auto}</style><h1>Sockethub benchmark report</h1><p>Latency measures connection establishment or successful action acknowledgements; XMPP acknowledgements do not measure recipient delivery. Throughput is successful actions divided by total scenario elapsed time.</p><svg role="img" aria-label="P95 latency by scenario" viewBox="0 0 700 ${Math.max(40, results.length * 40)}">${bars}</svg><table><thead><tr><th>Scenario</th><th>Status</th><th>p50 ms</th><th>p95 ms</th><th>p99 ms</th><th>Actions/sec</th><th>Error %</th></tr></thead><tbody>${rows}</tbody></table></html>`;
}

async function main() {
    const args = process.argv.slice(2);
    const showLatest = args.includes("--latest");
    const reportPath = args.find((arg) => !arg.startsWith("--"));

    if (showLatest || reportPath) {
        const latestReport = reportPath || (await findLatestReport());
        if (!latestReport) {
            console.error("No reports found in stress-tests/reports/");
            process.exit(1);
        }

        const results: TestResult[] = JSON.parse(
            readFileSync(latestReport, "utf-8"),
        );
        generateConsoleSummary(results);
        if (args.includes("--html")) {
            const output = `${latestReport.replace(/\.json$/, "")}.html`;
            writeFileSync(output, generateHtmlReport(results));
            console.log(`HTML report: ${output}`);
        }
    } else {
        console.log(
            "Usage: bun run stress:report [--latest | report.json] [--html]",
        );
    }
}

if (import.meta.main) {
    main().catch(console.error);
}
