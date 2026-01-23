/**
 * Baseline comparator - compares test results against system baseline
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getSystemProfile, getBaselineFilename } from './system-profiler';
import type { Baseline, TestResult } from '../types';
import { TOLERANCE_PCT } from '../config';

const BASELINE_DIR = join(import.meta.dir, '..', 'baselines');

export async function loadBaseline(): Promise<Baseline | null> {
  const systemProfile = await getSystemProfile();
  const baselineFile = join(BASELINE_DIR, getBaselineFilename(systemProfile));

  if (!existsSync(baselineFile)) {
    return null;
  }

  return JSON.parse(readFileSync(baselineFile, 'utf-8'));
}

export function compareToBaseline(
  result: TestResult,
  baseline: Baseline
): {
  within_tolerance: boolean;
  deviations: Record<string, number>;
  status: 'pass' | 'warn' | 'fail';
} {
  const deviations: Record<string, number> = {};

  // Compare latency P95
  if (result.metrics.latency_p95 && baseline.performance_metrics.message_latency_p95_ms) {
    const deviation =
      ((result.metrics.latency_p95 - baseline.performance_metrics.message_latency_p95_ms) /
        baseline.performance_metrics.message_latency_p95_ms) *
      100;
    deviations.latency_p95 = Math.round(deviation);
  }

  // Compare throughput
  if (result.metrics.throughput && baseline.performance_metrics.throughput_msg_per_sec) {
    const deviation =
      ((result.metrics.throughput - baseline.performance_metrics.throughput_msg_per_sec) /
        baseline.performance_metrics.throughput_msg_per_sec) *
      100;
    deviations.throughput = Math.round(deviation);
  }

  // Determine status
  let status: 'pass' | 'warn' | 'fail' = 'pass';

  // Check if within tolerance
  const within_tolerance = Object.values(deviations).every(
    (dev) => Math.abs(dev) <= TOLERANCE_PCT
  );

  // Check error rate
  if (result.metrics.error_rate !== undefined) {
    if (result.metrics.error_rate >= baseline.thresholds.error_rate_fail_pct) {
      status = 'fail';
    } else if (result.metrics.error_rate >= baseline.thresholds.error_rate_warn_pct) {
      status = 'warn';
    }
  }

  // Check latency thresholds
  if (result.metrics.latency_p95 !== undefined) {
    if (result.metrics.latency_p95 >= baseline.thresholds.latency_p95_fail_ms) {
      status = 'fail';
    } else if (result.metrics.latency_p95 >= baseline.thresholds.latency_p95_warn_ms) {
      status = status === 'fail' ? 'fail' : 'warn';
    }
  }

  // Check deviation tolerance
  if (!within_tolerance && status === 'pass') {
    const maxDeviation = Math.max(...Object.values(deviations).map(Math.abs));
    if (maxDeviation > TOLERANCE_PCT * 2) {
      status = 'fail';
    } else if (maxDeviation > TOLERANCE_PCT) {
      status = 'warn';
    }
  }

  return {
    within_tolerance,
    deviations,
    status,
  };
}
