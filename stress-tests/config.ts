/**
 * Stress test configuration and thresholds
 */
import type { TestConfig, Thresholds } from './types';

export const DEFAULT_SOCKETHUB_URL = 'http://localhost:10550';

export const TOLERANCE_PCT = 15; // ±15% baseline tolerance

export const DEFAULT_THRESHOLDS: Thresholds = {
  latency_p95_warn_ms: 150,
  latency_p95_fail_ms: 200,
  error_rate_warn_pct: 0.5,
  error_rate_fail_pct: 1.0,
};

export const PERFORMANCE_TESTS: TestConfig[] = [
  {
    type: 'performance',
    platform: 'dummy',
    scenario: 'connection-baseline',
    sockethub_url: DEFAULT_SOCKETHUB_URL,
    tolerance_pct: TOLERANCE_PCT,
  },
  {
    type: 'performance',
    platform: 'dummy',
    scenario: 'message-throughput',
    sockethub_url: DEFAULT_SOCKETHUB_URL,
    tolerance_pct: TOLERANCE_PCT,
  },
  {
    type: 'performance',
    platform: 'xmpp',
    scenario: 'multi-client-broadcast',
    sockethub_url: DEFAULT_SOCKETHUB_URL,
    tolerance_pct: TOLERANCE_PCT,
  },
];

export const STRESS_TESTS: TestConfig[] = [
  {
    type: 'stress',
    platform: 'dummy',
    scenario: 'connection-storm',
    sockethub_url: DEFAULT_SOCKETHUB_URL,
    tolerance_pct: TOLERANCE_PCT,
  },
  {
    type: 'stress',
    platform: 'xmpp',
    scenario: 'message-flood',
    sockethub_url: DEFAULT_SOCKETHUB_URL,
    tolerance_pct: TOLERANCE_PCT,
  },
  {
    type: 'stress',
    platform: 'feed',
    scenario: 'feed-processing-stress',
    sockethub_url: DEFAULT_SOCKETHUB_URL,
    tolerance_pct: TOLERANCE_PCT,
  },
  {
    type: 'stress',
    platform: 'dummy',
    scenario: 'spike-test',
    sockethub_url: DEFAULT_SOCKETHUB_URL,
    tolerance_pct: TOLERANCE_PCT,
  },
];

export const SOAK_TESTS: TestConfig[] = [
  {
    type: 'soak',
    platform: 'dummy',
    scenario: 'long-duration-stability',
    sockethub_url: DEFAULT_SOCKETHUB_URL,
    tolerance_pct: TOLERANCE_PCT,
  },
];

export const ALL_TESTS = [...PERFORMANCE_TESTS, ...STRESS_TESTS, ...SOAK_TESTS];
