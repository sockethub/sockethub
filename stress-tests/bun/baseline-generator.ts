/**
 * Baseline generator - creates system-specific performance baselines
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_THRESHOLDS } from "../config";
import type { Baseline, SystemProfile, TestResult } from "../types";
import { getBaselineFilename, getSystemProfile } from "./system-profiler";

const WARMUP_RUNS = 3;
const BASELINE_RUNS = 5;
const BASELINE_DIR = join(import.meta.dir, "..", "baselines");
const MAX_TEST_DURATION_SEC = 600; // 10 minutes max per test run
const IDLE_TIMEOUT_SEC = 120; // 2 minutes of no output = hung test

interface ArtilleryReport {
    aggregate: {
        counters: Record<string, number>;
        rates: Record<string, number>;
        summaries: Record<
            string,
            {
                min: number;
                max: number;
                median: number;
                p95: number;
                p99: number;
            }
        >;
    };
}

async function main() {
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║  SOCKETHUB BASELINE GENERATOR                            ║");
    console.log(
        "╚══════════════════════════════════════════════════════════╝\n",
    );

    // Get system profile
    const systemProfile = await getSystemProfile();
    console.log(`System: ${systemProfile.hostname}`);
    console.log(`CPUs: ${systemProfile.cpus}`);
    console.log(`Memory: ${systemProfile.memory_gb}GB`);
    console.log(`OS: ${systemProfile.os}`);
    console.log(`Redis: ${systemProfile.redis_version || "Not detected"}\n`);

    // Get Sockethub version
    const packageJson = JSON.parse(
        readFileSync(
            join(
                import.meta.dir,
                "..",
                "..",
                "packages",
                "sockethub",
                "package.json",
            ),
            "utf-8",
        ),
    );
    const sockethubVersion = packageJson.version;
    console.log(`Sockethub version: ${sockethubVersion}\n`);

    // Check if baseline already exists
    const baselineFile = join(BASELINE_DIR, getBaselineFilename(systemProfile));
    if (existsSync(baselineFile)) {
        console.log(`⚠️  Baseline already exists: ${baselineFile}`);
        console.log("Delete it to regenerate, or use --force flag\n");

        const existingBaseline: Baseline = JSON.parse(
            readFileSync(baselineFile, "utf-8"),
        );
        console.log(
            `Existing baseline from: ${existingBaseline.generated_date}`,
        );
        console.log(`Sockethub version: ${existingBaseline.sockethub_version}`);
        return;
    }

    // Ensure baseline directory exists
    if (!existsSync(BASELINE_DIR)) {
        mkdirSync(BASELINE_DIR, { recursive: true });
    }

    console.log("Starting baseline generation...\n");
    console.log("Step 1: Warmup runs (discarded)");
    for (let i = 1; i <= WARMUP_RUNS; i++) {
        try {
            await runTest("message-throughput", i, WARMUP_RUNS, true);
        } catch (error) {
            // Warmup failures are non-fatal, just log and continue
            console.log(`  Warmup ${i}/${WARMUP_RUNS} failed: ${error.message}`);
        }
    }

    console.log("\nStep 2: Baseline runs (recorded)");
    const results: TestResult[] = [];
    for (let i = 1; i <= BASELINE_RUNS; i++) {
        try {
            const result = await runTest("message-throughput", i, BASELINE_RUNS, false);
            results.push(result);
        } catch (error) {
            console.log(`  Run ${i}/${BASELINE_RUNS} failed: ${error.message}`);
        }
    }

    // Check if we have enough valid results
    if (results.length === 0) {
        console.log("\n✗ No successful baseline runs - cannot generate baseline\n");
        return;
    }
    if (results.length < 3) {
        console.log(`\n⚠️  Only ${results.length}/${BASELINE_RUNS} runs succeeded - baseline may be unreliable\n`);
    }

    // Calculate median metrics
    console.log("\nStep 3: Calculate median baseline");
    const baseline = calculateBaseline(
        systemProfile,
        sockethubVersion,
        results,
    );

    // Save baseline
    writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));
    console.log(`\n✓ Baseline saved: ${baselineFile}\n`);

    // Display baseline
    console.log("Baseline Metrics:");
    console.log(
        `  Connection P95: ${baseline.performance_metrics.connection_p95_ms}ms`,
    );
    console.log(
        `  Message Latency P95: ${baseline.performance_metrics.message_latency_p95_ms}ms`,
    );
    console.log(
        `  Throughput: ${baseline.performance_metrics.throughput_msg_per_sec} msg/sec`,
    );
}

async function runTest(scenario: string, runNumber: number, totalRuns: number, isWarmup: boolean): Promise<TestResult> {
    const scenarioPath = join(
        import.meta.dir,
        "..",
        "artillery",
        "scenarios",
        "performance",
        `${scenario}.yml`,
    );

    const reportPath = join(
        import.meta.dir,
        "..",
        "reports",
        `baseline-${Date.now()}.json`,
    );

    const errorLogPath = join(
        import.meta.dir,
        "..",
        "reports",
        `errors-${Date.now()}.log`,
    );

    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const prefix = isWarmup ? "Warmup" : "Run";
        process.stdout.write(`  ${prefix} ${runNumber}/${totalRuns}: Starting...`);

        const child = spawn(
            "bunx",
            ["artillery", "run", scenarioPath, "--output", reportPath, "--quiet"],
            {
                stdio: ["ignore", "pipe", "pipe"],
            },
        );

        let errorCount = 0;
        let lastErrorType = "";
        const errorCounts = new Map<string, number>();
        const errorLog: string[] = [];
        let lastActivityTime = Date.now();
        let testTimedOut = false;

        // Track unique errors
        child.stderr?.on("data", (data) => {
            lastActivityTime = Date.now();
            const text = data.toString();
            errorLog.push(text);

            // Count error types
            if (text.includes("websocket error")) {
                errorCounts.set("websocket", (errorCounts.get("websocket") || 0) + 1);
            } else if (text.includes("Connection timeout")) {
                errorCounts.set("timeout", (errorCounts.get("timeout") || 0) + 1);
            } else if (text.includes("Cannot send credentials")) {
                errorCounts.set("credentials", (errorCounts.get("credentials") || 0) + 1);
            }
            errorCount++;
        });

        // Track stdout activity too
        child.stdout?.on("data", () => {
            lastActivityTime = Date.now();
        });

        // Show progress spinner and check for timeouts
        const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        let spinnerIndex = 0;
        const progressInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const idleTime = Math.floor((Date.now() - lastActivityTime) / 1000);

            // Check for maximum duration timeout
            if (elapsed > MAX_TEST_DURATION_SEC) {
                clearInterval(progressInterval);
                testTimedOut = true;
                child.kill("SIGTERM");
                process.stdout.write(`\r  ${prefix} ${runNumber}/${totalRuns}: ✗ Timeout (max ${MAX_TEST_DURATION_SEC}s exceeded)                    \n`);
                return;
            }

            // Check for idle timeout (no output for too long)
            if (idleTime > IDLE_TIMEOUT_SEC) {
                clearInterval(progressInterval);
                testTimedOut = true;
                child.kill("SIGTERM");
                process.stdout.write(`\r  ${prefix} ${runNumber}/${totalRuns}: ✗ Hung (no activity for ${IDLE_TIMEOUT_SEC}s)                    \n`);
                return;
            }

            process.stdout.write(`\r  ${prefix} ${runNumber}/${totalRuns}: ${spinner[spinnerIndex]} Running (${elapsed}s)...`);
            spinnerIndex = (spinnerIndex + 1) % spinner.length;
        }, 100);

        child.on("close", (code) => {
            clearInterval(progressInterval);

            // Handle timeout cases
            if (testTimedOut) {
                writeFileSync(errorLogPath, errorLog.join(""));
                reject(new Error(`Test timed out. Check ${errorLogPath} for details.`));
                return;
            }

            // Handle abnormal exit codes (but allow SIGTERM = 143)
            if (code !== 0 && code !== 143) {
                // Save error log
                writeFileSync(errorLogPath, errorLog.join(""));
                process.stdout.write(`\r  ${prefix} ${runNumber}/${totalRuns}: ✗ Failed (exit code ${code}, see ${errorLogPath})                    \n`);
                reject(new Error(`Artillery exited with code ${code}. Check ${errorLogPath} for details.`));
                return;
            }

            // Show error summary if there were errors
            if (errorCount > 0) {
                const summary = Array.from(errorCounts.entries())
                    .map(([type, count]) => `${type}:${count}`)
                    .join(", ");
                process.stdout.write(`\r  ${prefix} ${runNumber}/${totalRuns}: ✓ Complete (${errorCount} errors: ${summary})\n`);
            } else {
                process.stdout.write(`\r  ${prefix} ${runNumber}/${totalRuns}: ✓ Complete                    \n`);
            }

            try {
                const report: ArtilleryReport = JSON.parse(
                    readFileSync(reportPath, "utf-8"),
                );

                resolve({
                    test_name: scenario,
                    timestamp: new Date().toISOString(),
                    duration_sec: Math.floor((Date.now() - startTime) / 1000),
                    metrics: {
                        latency_p95:
                            report.aggregate.summaries["sockethub.latency.echo"]?.p95 ||
                            0,
                        throughput: report.aggregate.rates["http.request_rate"] || 0,
                        error_rate: calculateErrorRate(report),
                    },
                    status: "pass",
                });
            } catch (error) {
                reject(new Error(`Failed to parse report: ${error}`));
            }
        });

        child.on("error", (error) => {
            clearInterval(progressInterval);
            process.stdout.write(`\r  ${prefix} ${runNumber}/${totalRuns}: ✗ Error\n`);
            reject(error);
        });
    });
}

function calculateErrorRate(report: ArtilleryReport): number {
    const total = report.aggregate.counters["http.requests"] || 1;
    const errors = report.aggregate.counters["errors.total"] || 0;
    return (errors / total) * 100;
}

function calculateBaseline(
    systemProfile: SystemProfile,
    sockethubVersion: string,
    results: TestResult[],
): Baseline {
    // Calculate median of each metric
    const sortedLatencies = results
        .map((r) => r.metrics.latency_p95 || 0)
        .sort((a, b) => a - b);
    const sortedThroughputs = results
        .map((r) => r.metrics.throughput || 0)
        .sort((a, b) => a - b);

    const medianLatency =
        sortedLatencies[Math.floor(sortedLatencies.length / 2)];
    const medianThroughput =
        sortedThroughputs[Math.floor(sortedThroughputs.length / 2)];

    return {
        system: systemProfile,
        sockethub_version: sockethubVersion,
        generated_date: new Date().toISOString().split("T")[0],
        performance_metrics: {
            connection_p95_ms: 50, // Default, would need connection-baseline test
            message_latency_p95_ms: Math.round(medianLatency),
            throughput_msg_per_sec: Math.round(medianThroughput),
        },
        stress_limits: {
            max_concurrent_connections: 1000, // Default, would need connection-storm test
            max_throughput_msg_per_sec: 5000, // Default, would need message-flood test
            degradation_start_connections: 800,
        },
        thresholds: DEFAULT_THRESHOLDS,
    };
}

main().catch(console.error);
