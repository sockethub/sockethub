/**
 * Baseline generator - creates system-specific performance baselines
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getSystemProfile, getBaselineFilename } from './system-profiler';
import type { Baseline, TestResult } from '../types';
import { DEFAULT_THRESHOLDS } from '../config';

const WARMUP_RUNS = 3;
const BASELINE_RUNS = 5;
const BASELINE_DIR = join(import.meta.dir, '..', 'baselines');

interface ArtilleryReport {
  aggregate: {
    counters: Record<string, number>;
    rates: Record<string, number>;
    summaries: Record<string, {
      min: number;
      max: number;
      median: number;
      p95: number;
      p99: number;
    }>;
  };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  SOCKETHUB BASELINE GENERATOR                            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Get system profile
  const systemProfile = await getSystemProfile();
  console.log(`System: ${systemProfile.hostname}`);
  console.log(`CPUs: ${systemProfile.cpus}`);
  console.log(`Memory: ${systemProfile.memory_gb}GB`);
  console.log(`OS: ${systemProfile.os}`);
  console.log(`Redis: ${systemProfile.redis_version || 'Not detected'}\n`);

  // Get Sockethub version
  const packageJson = JSON.parse(
    readFileSync(join(import.meta.dir, '..', '..', 'packages', 'sockethub', 'package.json'), 'utf-8')
  );
  const sockethubVersion = packageJson.version;
  console.log(`Sockethub version: ${sockethubVersion}\n`);

  // Check if baseline already exists
  const baselineFile = join(BASELINE_DIR, getBaselineFilename(systemProfile));
  if (existsSync(baselineFile)) {
    console.log(`⚠️  Baseline already exists: ${baselineFile}`);
    console.log('Delete it to regenerate, or use --force flag\n');

    const existingBaseline: Baseline = JSON.parse(readFileSync(baselineFile, 'utf-8'));
    console.log(`Existing baseline from: ${existingBaseline.generated_date}`);
    console.log(`Sockethub version: ${existingBaseline.sockethub_version}`);
    return;
  }

  // Ensure baseline directory exists
  if (!existsSync(BASELINE_DIR)) {
    mkdirSync(BASELINE_DIR, { recursive: true });
  }

  console.log('Starting baseline generation...\n');
  console.log('Step 1: Warmup runs (discarded)');
  for (let i = 1; i <= WARMUP_RUNS; i++) {
    console.log(`  Warmup ${i}/${WARMUP_RUNS}...`);
    runTest('message-throughput');
  }

  console.log('\nStep 2: Baseline runs (recorded)');
  const results: TestResult[] = [];
  for (let i = 1; i <= BASELINE_RUNS; i++) {
    console.log(`  Run ${i}/${BASELINE_RUNS}...`);
    const result = runTest('message-throughput');
    results.push(result);
  }

  // Calculate median metrics
  console.log('\nStep 3: Calculate median baseline');
  const baseline = calculateBaseline(systemProfile, sockethubVersion, results);

  // Save baseline
  writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));
  console.log(`\n✓ Baseline saved: ${baselineFile}\n`);

  // Display baseline
  console.log('Baseline Metrics:');
  console.log(`  Connection P95: ${baseline.performance_metrics.connection_p95_ms}ms`);
  console.log(`  Message Latency P95: ${baseline.performance_metrics.message_latency_p95_ms}ms`);
  console.log(`  Throughput: ${baseline.performance_metrics.throughput_msg_per_sec} msg/sec`);
}

function runTest(scenario: string): TestResult {
  const scenarioPath = join(
    import.meta.dir,
    '..',
    'artillery',
    'scenarios',
    'performance',
    `${scenario}.yml`
  );

  const reportPath = join(import.meta.dir, '..', 'reports', `baseline-${Date.now()}.json`);

  try {
    execSync(
      `bunx artillery run ${scenarioPath} --output ${reportPath} --quiet`,
      {
        stdio: 'pipe',
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        encoding: 'utf-8'
      }
    );

    const report: ArtilleryReport = JSON.parse(readFileSync(reportPath, 'utf-8'));

    return {
      test_name: scenario,
      timestamp: new Date().toISOString(),
      duration_sec: 0,
      metrics: {
        latency_p95: report.aggregate.summaries['http.response_time']?.p95 || 0,
        throughput: report.aggregate.rates['http.request_rate'] || 0,
        error_rate: calculateErrorRate(report),
      },
      status: 'pass',
    };
  } catch (error) {
    console.error(`Error running test: ${error}`);
    throw error;
  }
}

function calculateErrorRate(report: ArtilleryReport): number {
  const total = report.aggregate.counters['http.requests'] || 1;
  const errors = report.aggregate.counters['errors.total'] || 0;
  return (errors / total) * 100;
}

function calculateBaseline(
  systemProfile: any,
  sockethubVersion: string,
  results: TestResult[]
): Baseline {
  // Calculate median of each metric
  const sortedLatencies = results
    .map(r => r.metrics.latency_p95 || 0)
    .sort((a, b) => a - b);
  const sortedThroughputs = results
    .map(r => r.metrics.throughput || 0)
    .sort((a, b) => a - b);

  const medianLatency = sortedLatencies[Math.floor(sortedLatencies.length / 2)];
  const medianThroughput = sortedThroughputs[Math.floor(sortedThroughputs.length / 2)];

  return {
    system: systemProfile,
    sockethub_version: sockethubVersion,
    generated_date: new Date().toISOString().split('T')[0],
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
