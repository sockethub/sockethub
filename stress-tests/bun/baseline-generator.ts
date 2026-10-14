/**
 * Baseline generator - creates system-specific performance baselines
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { io } from "socket.io-client";
import { DEFAULT_THRESHOLDS, PERFORMANCE_TESTS } from "../config";
import { extractMetrics } from "../metrics";
import type { Baseline, SystemProfile, TestResult } from "../types";
import { getBaselineFilename, getSystemProfile } from "./system-profiler";

const SOCKETHUB_URL = process.env.SOCKETHUB_URL || "http://localhost:10550";
const HEALTH_CHECK_TIMEOUT = 5000;
const MAX_HEALTH_RETRIES = 3;
const HEALTH_RETRY_DELAY = 2000;

const WARMUP_RUNS = 3;
const BASELINE_RUNS = 5;
const BASELINE_DIR = join(import.meta.dir, "..", "baselines");

/**
 * Check if Sockethub is healthy by attempting a socket.io connection
 */
async function checkSockethubHealth(): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = io(SOCKETHUB_URL, {
            path: "/sockethub",
            transports: ["websocket"],
            timeout: HEALTH_CHECK_TIMEOUT,
            reconnection: false,
        });

        const cleanup = () => {
            socket.removeAllListeners();
            socket.disconnect();
        };

        socket.on("connect", () => {
            cleanup();
            resolve(true);
        });

        socket.on("connect_error", () => {
            cleanup();
            resolve(false);
        });

        setTimeout(() => {
            cleanup();
            resolve(false);
        }, HEALTH_CHECK_TIMEOUT);
    });
}

/**
 * Ensure Sockethub is available, with retries and alerting
 */
async function ensureSockethubAvailable(): Promise<void> {
    for (let attempt = 1; attempt <= MAX_HEALTH_RETRIES; attempt++) {
        const healthy = await checkSockethubHealth();
        if (healthy) {
            return;
        }
        console.error(
            `\n⚠️  SOCKETHUB CONNECTION FAILED (attempt ${attempt}/${MAX_HEALTH_RETRIES})`,
        );
        console.error(`   URL: ${SOCKETHUB_URL}`);

        if (attempt < MAX_HEALTH_RETRIES) {
            console.error(`   Retrying in ${HEALTH_RETRY_DELAY / 1000}s...`);
            await new Promise((r) => setTimeout(r, HEALTH_RETRY_DELAY));
        }
    }

    console.error(
        "\n╔══════════════════════════════════════════════════════════╗",
    );
    console.error(
        "║  ❌ SOCKETHUB UNAVAILABLE - ABORTING STRESS TEST          ║",
    );
    console.error(
        "╚══════════════════════════════════════════════════════════╝",
    );
    console.error(`\nFailed to connect to Sockethub at ${SOCKETHUB_URL}`);
    console.error("Please ensure Sockethub is running: bun run start\n");
    process.exit(1);
}

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
        console.log(
            "Delete it explicitly to regenerate; keep it for release comparisons\n",
        );

        const existingBaseline: Baseline = JSON.parse(
            readFileSync(baselineFile, "utf-8"),
        );
        if (existingBaseline.measurement_version !== 2) {
            throw new Error(
                `Baseline uses obsolete metrics; remove ${baselineFile} explicitly and regenerate once`,
            );
        }
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

    mkdirSync(join(import.meta.dir, "..", "reports"), { recursive: true });

    // Initial health check
    console.log("Checking Sockethub connectivity...");
    await ensureSockethubAvailable();
    console.log("✓ Sockethub is available\n");

    console.log("Starting baseline generation...\n");

    console.log("Step 1: Warmup runs (discarded)");
    for (let i = 1; i <= WARMUP_RUNS; i++) {
        await ensureSockethubAvailable();
        console.log(`  Warmup ${i}/${WARMUP_RUNS} - starting...`);
        await runTest("message-throughput");
        console.log(`  Warmup ${i}/${WARMUP_RUNS} - complete`);
    }

    console.log("\nStep 2: Baseline runs (recorded)");
    const results: TestResult[] = [];
    for (let i = 1; i <= BASELINE_RUNS; i++) {
        await ensureSockethubAvailable();
        console.log(`  Run ${i}/${BASELINE_RUNS} - starting...`);
        const result = await runTest("message-throughput");
        results.push(result);
        console.log(`  Run ${i}/${BASELINE_RUNS} - complete`);
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
        `  Message Latency P95: ${baseline.performance_metrics.message_latency_p95_ms}ms`,
    );
    console.log(
        `  Throughput: ${baseline.performance_metrics.throughput_msg_per_sec} msg/sec`,
    );
}

async function runTest(scenario: string): Promise<TestResult> {
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

    try {
        console.log(`    → Running artillery scenario: ${scenario}`);
        const _output = execSync(
            `bunx artillery run ${scenarioPath} --output ${reportPath}`,
            {
                stdio: "pipe",
                maxBuffer: 50 * 1024 * 1024, // 50MB buffer
                encoding: "utf-8",
            },
        );
        console.log("    → Artillery complete");

        const report: ArtilleryReport = JSON.parse(
            readFileSync(reportPath, "utf-8"),
        );

        const extracted = extractMetrics(report, PERFORMANCE_TESTS[1]);
        if (
            extracted.metrics.latency_p95 === undefined ||
            !extracted.metrics.throughput ||
            extracted.metrics.error_rate !== 0 ||
            (report.aggregate.counters["vusers.failed"] || 0) > 0
        ) {
            throw new Error(
                "Cannot save a baseline from failed or missing measurements",
            );
        }
        return {
            test_name: scenario,
            timestamp: new Date().toISOString(),
            duration_sec: extracted.duration_sec,
            metrics: extracted.metrics,
            status: "pass",
        };
    } catch (error) {
        console.error(`Error running test: ${error}`);
        throw error;
    }
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
        measurement_version: 2,
        system: systemProfile,
        sockethub_version: sockethubVersion,
        generated_date: new Date().toISOString().split("T")[0],
        performance_metrics: {
            message_latency_p95_ms: Math.round(medianLatency),
            throughput_msg_per_sec: Math.round(medianThroughput),
        },
        thresholds: DEFAULT_THRESHOLDS,
    };
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
