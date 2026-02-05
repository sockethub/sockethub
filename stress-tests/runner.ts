/**
 * Stress test runner - main CLI orchestrator
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import { compareToBaseline, loadBaseline } from "./bun/baseline-comparator";
import { getSystemProfile } from "./bun/system-profiler";
import {
    ALL_TESTS,
    ARTILLERY_ERROR_THRESHOLD_RATIO,
    CI_ERROR_RATE_THRESHOLD_PCT,
    PERFORMANCE_TESTS,
    SOAK_TESTS,
    SOCKETHUB_ERROR_THRESHOLD_PCT,
    STRESS_TESTS,
} from "./config";
import { generateConsoleSummary } from "./reporter";
import type { Baseline, TestConfig, TestResult } from "./types";

const REPORTS_DIR = join(import.meta.dir, "reports");

interface RunnerOptions {
    type?: "performance" | "stress" | "soak" | "all" | "ci";
    ciMode?: boolean;
}

const CI_TEST_TIMEOUT_MS = 2 * 60 * 1000;
const DEFAULT_TEST_TIMEOUT_MS = 20 * 60 * 1000;
const HEALTH_CHECK_INTERVAL_MS = 2000;
const HEALTH_CHECK_FAILURE_LIMIT = 2;

async function main() {
    const args = process.argv.slice(2);
    const options = parseArgs(args);

    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║  SOCKETHUB PERFORMANCE & STRESS TEST SUITE              ║");
    console.log(
        "╚══════════════════════════════════════════════════════════╝\n",
    );

    // Get system info
    const systemProfile = await getSystemProfile();
    console.log(
        `System: ${systemProfile.hostname} (${systemProfile.cpus} CPUs, ${systemProfile.memory_gb}GB RAM)`,
    );

    // Load baseline
    const baseline = await loadBaseline();
    if (baseline) {
        console.log(
            `Baseline: ✓ Found (${baseline.generated_date}, v${baseline.sockethub_version})`,
        );
    } else {
        console.log("Baseline: ⚠️  Not found (run: bun run stress:baseline)");
    }
    console.log("");

    // Select tests
    let testsToRun: TestConfig[];
    if (options.ciMode || options.type === "ci") {
        console.log(
            "Mode: CI Smoke Test (1-2 minutes, crash detection only)\n",
        );
        testsToRun = [
            {
                type: "performance",
                platform: "dummy",
                scenario: "ci/smoke-test",
                sockethub_url: "http://localhost:10550",
                tolerance_pct: 15,
            },
        ];
    } else {
        switch (options.type) {
            case "performance":
                testsToRun = PERFORMANCE_TESTS;
                break;
            case "stress":
                testsToRun = STRESS_TESTS;
                break;
            case "soak":
                testsToRun = SOAK_TESTS;
                break;
            default:
                testsToRun = ALL_TESTS;
                break;
        }
        console.log(
            `Mode: ${options.type || "all"} tests (${testsToRun.length} scenarios)\n`,
        );
    }

    // Run tests
    const results: TestResult[] = [];
    for (let i = 0; i < testsToRun.length; i++) {
        const test = testsToRun[i];
        console.log(
            `[${i + 1}/${testsToRun.length}] ${test.type}: ${test.scenario}`,
        );
        console.log(`      Platform: ${test.platform}`);

        const result = await runTest(test, baseline, options.ciMode);
        results.push(result);

        const statusIcon =
            result.status === "pass"
                ? "✓"
                : result.status === "warn"
                  ? "⚠️"
                  : "❌";
        console.log(
            `      Status: ${statusIcon} ${result.status.toUpperCase()}\n`,
        );
    }

    // Save results
    if (!existsSync(REPORTS_DIR)) {
        mkdirSync(REPORTS_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportFile = join(
        REPORTS_DIR,
        `${timestamp}-${options.type || "all"}.json`,
    );
    writeFileSync(reportFile, JSON.stringify(results, null, 2));

    // Generate summary
    generateConsoleSummary(results);
    console.log(`Report: ${reportFile}\n`);

    // Exit with error if any tests failed
    const hasFailures = results.some((r) => r.status === "fail");
    process.exit(hasFailures ? 1 : 0);
}

function parseArgs(args: string[]): RunnerOptions {
    const options: RunnerOptions = {};

    for (const arg of args) {
        if (arg.startsWith("--type=")) {
            const parts = arg.split("=");
            const type = parts.length > 1 ? parts[1] : undefined;
            if (
                type === "performance" ||
                type === "stress" ||
                type === "soak" ||
                type === "all" ||
                type === "ci"
            ) {
                options.type = type;
            }
        } else if (arg === "--all") {
            options.type = "all";
        } else if (arg === "--ci-mode" || arg === "--ci") {
            options.ciMode = true;
            options.type = "ci";
        }
    }

    return options;
}

async function runTest(
    test: TestConfig,
    baseline: Baseline | null,
    ciMode?: boolean,
): Promise<TestResult> {
    const scenarioPath = `${join(
        import.meta.dir,
        "artillery",
        "scenarios",
        test.scenario.includes("/")
            ? test.scenario
            : `${test.type}/${test.scenario}`,
    )}.yml`;

    const reportPath = join(REPORTS_DIR, `temp-${Date.now()}.json`);

    try {
        await runArtilleryWithGuards({
            scenarioPath,
            reportPath,
            sockethubUrl: test.sockethub_url,
            timeoutMs: ciMode ? CI_TEST_TIMEOUT_MS : DEFAULT_TEST_TIMEOUT_MS,
        });

        // Parse Artillery report
        const report = JSON.parse(readFileSync(reportPath, "utf-8"));

        // Extract metrics
        const vusersCreated =
            report.aggregate?.counters?.["vusers.created"] || 0;
        const vusersFailed = report.aggregate?.counters?.["vusers.failed"] || 0;
        const errorsTotal = report.aggregate?.counters?.["errors.total"] || 0;

        // Sockethub-specific error counters
        const sockethubErrors = {
            credentials:
                report.aggregate?.counters?.["sockethub.error.credentials"] ||
                0,
            echo: report.aggregate?.counters?.["sockethub.error.echo"] || 0,
            xmpp: report.aggregate?.counters?.["sockethub.error.xmpp"] || 0,
            feed: report.aggregate?.counters?.["sockethub.error.feed"] || 0,
            usersWithErrors:
                report.aggregate?.counters?.["sockethub.users_with_errors"] ||
                0,
        };

        const totalSockethubErrors = Object.values(sockethubErrors).reduce(
            (a, b) => a + b,
            0,
        );

        const metrics = {
            latency_p50:
                report.aggregate?.summaries?.["sockethub.latency.echo"]
                    ?.median || 0,
            latency_p95:
                report.aggregate?.summaries?.["sockethub.latency.echo"]?.p95 ||
                0,
            latency_p99:
                report.aggregate?.summaries?.["sockethub.latency.echo"]?.p99 ||
                0,
            throughput: report.aggregate?.rates?.["http.request_rate"] || 0,
            error_rate: calculateErrorRate(report, totalSockethubErrors),
            connections: vusersCreated - vusersFailed,
            sockethub_errors: totalSockethubErrors,
        };

        // Build result
        const result: TestResult = {
            test_name: test.scenario,
            timestamp: new Date().toISOString(),
            duration_sec: Math.round(
                (report.aggregate?.lastCounterAt || 0) / 1000,
            ),
            metrics,
            status: "pass",
        };

        // Check for connection failures
        if (vusersCreated > 0 && vusersFailed === vusersCreated) {
            result.status = "fail";
            console.error(
                `      All connections failed (${vusersFailed}/${vusersCreated})`,
            );
            return result;
        }

        if (errorsTotal > vusersCreated * ARTILLERY_ERROR_THRESHOLD_RATIO) {
            result.status = "fail";
            console.error(
                `      High Artillery error rate (${errorsTotal} errors, ${vusersCreated} users)`,
            );
            return result;
        }

        // Check for Sockethub errors (validation, malformed messages, etc.)
        if (totalSockethubErrors > 0) {
            const errorPct = (totalSockethubErrors / vusersCreated) * 100;
            if (errorPct > SOCKETHUB_ERROR_THRESHOLD_PCT) {
                result.status = "fail";
                console.error(
                    `      Sockethub errors: ${totalSockethubErrors} (${errorPct.toFixed(1)}%)`,
                );
                if (sockethubErrors.credentials > 0)
                    console.error(
                        `        - Credentials errors: ${sockethubErrors.credentials}`,
                    );
                if (sockethubErrors.echo > 0)
                    console.error(
                        `        - Echo errors: ${sockethubErrors.echo}`,
                    );
                if (sockethubErrors.xmpp > 0)
                    console.error(
                        `        - XMPP errors: ${sockethubErrors.xmpp}`,
                    );
                if (sockethubErrors.feed > 0)
                    console.error(
                        `        - Feed errors: ${sockethubErrors.feed}`,
                    );
                return result;
            }
        }

        // Compare to baseline (skip in CI mode)
        if (baseline && !ciMode) {
            const comparison = compareToBaseline(result, baseline);
            result.baseline_comparison = comparison;
            result.status = comparison.status;
        } else if (ciMode) {
            // In CI mode, only check for crashes
            if (metrics.error_rate > CI_ERROR_RATE_THRESHOLD_PCT) {
                result.status = "fail";
            }
        }

        return result;
    } catch (error) {
        console.error(`      Error: ${error}`);
        return {
            test_name: test.scenario,
            timestamp: new Date().toISOString(),
            duration_sec: 0,
            metrics: { error_rate: 100 },
            status: "fail",
        };
    }
}

interface ArtilleryReport {
    aggregate?: {
        counters?: Record<string, number>;
        rates?: Record<string, number>;
        summaries?: Record<
            string,
            { median?: number; p95?: number; p99?: number }
        >;
        lastCounterAt?: number;
    };
}

async function isServiceReachable(url: string): Promise<boolean> {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port =
        parsed.port.length > 0
            ? Number.parseInt(parsed.port, 10)
            : parsed.protocol === "https:"
              ? 443
              : 80;

    return new Promise((resolve) => {
        const socket = createConnection({ host, port });
        const done = (result: boolean) => {
            socket.removeAllListeners();
            socket.end();
            socket.destroy();
            resolve(result);
        };
        socket.once("connect", () => done(true));
        socket.once("error", () => done(false));
        socket.setTimeout(1000, () => done(false));
    });
}

async function runArtilleryWithGuards(options: {
    scenarioPath: string;
    reportPath: string;
    sockethubUrl: string;
    timeoutMs: number;
}): Promise<void> {
    const { scenarioPath, reportPath, sockethubUrl, timeoutMs } = options;
    let stdout = "";
    let stderr = "";
    let failureCount = 0;
    let completed = false;

    await new Promise<void>((resolve, reject) => {
        const cmd = spawn(
            "bunx",
            [
                "artillery",
                "run",
                scenarioPath,
                "--output",
                reportPath,
                "--quiet",
            ],
            {
                stdio: ["ignore", "pipe", "pipe"],
                env: process.env,
            },
        );

        const stopWithError = (error: Error) => {
            if (completed) return;
            completed = true;
            clearTimeout(timeoutId);
            clearInterval(healthIntervalId);
            if (!cmd.killed) {
                cmd.kill("SIGKILL");
            }
            reject(error);
        };

        cmd.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        cmd.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        cmd.once("error", (err) => {
            stopWithError(
                new Error(`Failed to start artillery: ${err.message}`),
            );
        });

        const timeoutId = setTimeout(() => {
            stopWithError(
                new Error(
                    `Stress test timed out after ${Math.round(timeoutMs / 1000)}s (scenario: ${scenarioPath})`,
                ),
            );
        }, timeoutMs);

        const healthIntervalId = setInterval(async () => {
            const reachable = await isServiceReachable(sockethubUrl);
            if (reachable) {
                failureCount = 0;
                return;
            }

            failureCount += 1;
            if (failureCount >= HEALTH_CHECK_FAILURE_LIMIT) {
                stopWithError(
                    new Error(
                        `Sockethub became unreachable at ${sockethubUrl} during stress test (scenario: ${scenarioPath})`,
                    ),
                );
            }
        }, HEALTH_CHECK_INTERVAL_MS);

        cmd.once("close", (code) => {
            if (completed) return;
            completed = true;
            clearTimeout(timeoutId);
            clearInterval(healthIntervalId);

            if (code !== 0) {
                const details =
                    stderr.trim() || stdout.trim() || `exit code ${code}`;
                reject(
                    new Error(
                        `Artillery run failed for ${scenarioPath}: ${details}`,
                    ),
                );
                return;
            }
            resolve();
        });
    });
}

function calculateErrorRate(
    report: ArtilleryReport,
    sockethubErrors = 0,
): number {
    const vusersCreated = report.aggregate?.counters?.["vusers.created"] || 0;
    const artilleryErrors = report.aggregate?.counters?.["errors.total"] || 0;

    const totalErrors = artilleryErrors + sockethubErrors;

    if (vusersCreated === 0) return 100;
    return (totalErrors / vusersCreated) * 100;
}

main().catch(console.error);
