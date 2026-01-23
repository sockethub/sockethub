# Sockethub Performance & Stress Testing

Comprehensive load testing suite for Sockethub server using Artillery.

## Quick Start

```bash
# 1. Start dependencies (Redis + Prosody for XMPP tests)
bun run docker:start:deps

# 2. Start Sockethub locally
bun run start

# 3. Generate baseline (first time only)
bun run stress:baseline

# 4. Run tests
bun run stress:performance    # Performance tests (~10 min)
bun run stress:stress         # Stress tests (~15 min)
bun run stress:soak          # Soak test (30 min)
bun run stress:all           # All tests (~60 min)
bun run stress:ci            # CI smoke test (1-2 min)

# 5. View results
bun run stress:report --latest
```

## What We Test

### Performance Tests (Baseline Metrics)

**Goal**: Measure normal performance with realistic load

- **Connection Baseline**: 100 connections over 2 minutes
- **Message Throughput**: 50 clients × 10 msg/sec sustained
- **Multi-Client Broadcast**: 20 clients in shared XMPP room

**Platform**: Dummy (fast baseline), XMPP (real protocol)

### Stress Tests (Breaking Points)

**Goal**: Find maximum capacity before system fails

- **Connection Storm**: Ramp 0→1000 connections in 30 seconds
- **Message Flood**: Ramp 1→100 msg/sec with XMPP protocol
- **Feed Processing**: 50 clients requesting feeds simultaneously
- **Spike Test**: Baseline → 10x spike → baseline recovery

**Platform**: XMPP (realistic overhead), Feed (different pattern)

### Soak Test (Memory Leaks)

**Goal**: Detect resource leaks over time

- **Long Duration**: 30 minutes sustained load
- **Memory Tracking**: Heap growth monitoring
- **Platform Stability**: Process cleanup validation

**Platform**: Dummy (fast) + XMPP (real-world)

### CI Smoke Test

**Goal**: Quick crash detection (not performance measurement)

- **Duration**: 1-2 minutes
- **Purpose**: Verify server doesn't crash under basic load
- **Metrics**: Ignored (CI hardware is unreliable)

## Architecture

```
Artillery (load generator)
    ↓
@sockethub/client (real client library)
    ↓ Socket.IO connections + ActivityStreams
Sockethub Server (your code)
    ↓
Redis + Platforms (XMPP, Feed, etc.)
```

**What we test:** Full stack - client + server capacity under load
**Why @sockethub/client:**
- Ensures correct ActivityStreams message formatting
- Tests the actual client library users will use
- Proper error handling and validation

**Testing local vs Docker:**
- **Local**: `docker:start:deps` + `bun run start` (tests your working code)
- **Docker**: `docker:start` (tests Dockerized build, different use case)

## Baselines

### How Baselines Work

1. **System Profile**: Unique ID per hardware (CPUs, RAM, hostname)
2. **Generation**: 3 warmup runs + 5 baseline runs → median
3. **Storage**: `baselines/{hostname}-{cpus}c-{memory}gb.json`
4. **Comparison**: ±15% tolerance for pass/fail

### When to Regenerate

- First time running tests
- After Sockethub version upgrade
- After major refactors
- Weekly trend tracking

```bash
# Force regenerate baseline
rm stress-tests/baselines/*.json
bun run stress:baseline
```

## Results Interpretation

### Good Performance ✓

- P95 latency within 15% of baseline
- Error rate < 0.1%
- Memory/CPU stable over time
- Redis queue depth < 100

### Warning Signs ⚠️

- P95 latency 15-30% above baseline
- Error rate 0.1-0.5%
- Gradual memory growth
- Queue depth trending up

### Bad Performance ❌

- P99 latency > 2x baseline
- Error rate > 1%
- Memory leak (continuous growth)
- Platform process crashes
- Sockethub validation errors (malformed ActivityStreams)

## Error Handling

Tests automatically detect and report:

**Sockethub Errors (validation, processing):**
- Credentials errors (authentication failures)
- Echo/message errors (Dummy platform rejections)
- XMPP errors (protocol failures)
- Feed errors (fetch failures)

**Test Failures:**
- Tests fail if >5% of users encounter Sockethub errors
- Tests fail if >50% Artillery connection errors
- Tests fail if all connections fail

**Error Output:**
```
Sockethub errors: 15 (3.2%)
  - Credentials errors: 5
  - Echo errors: 10
```

All errors are logged in real-time so you can see exactly what went wrong.

## Example Output

```
╔══════════════════════════════════════════════════════════╗
║  SOCKETHUB PERFORMANCE & STRESS TEST SUITE              ║
╚══════════════════════════════════════════════════════════╝

System: dev-machine (8 CPUs, 16GB RAM)
Baseline: ✓ Found (2026-01-20, v5.0.0-alpha.10)

[1/3] Performance: message-throughput
      Platform: dummy
      Status: ✓ PASS

[2/3] Stress: connection-storm
      Platform: dummy
      Status: ✓ PASS

Results: 3/3 PASSED
Report: stress-tests/reports/2026-01-23-full-suite.json
```

## CI Integration

**Recommended:** Don't run full tests in CI (too slow, unreliable hardware)

**Option 1: No CI** (recommended)

- Run tests manually before releases
- Track trends locally

**Option 2: Smoke Test Only**

```yaml
# .github/workflows/stress-test.yml
stress-smoke:
  runs-on: ubuntu-latest
  steps:
    - run: bun run docker:start
    - run: bun run start &
    - run: bun run stress:ci  # 1-2 min, crash detection only
```

**CI Mode Behavior:**

- Ignores performance metrics (unreliable)
- Only checks: error rate > 10% = fail
- Purpose: Detect crashes, not measure speed

## File Structure

```
stress-tests/
├── artillery/
│   ├── scenarios/
│   │   ├── performance/     # Baseline tests
│   │   ├── stress/          # Capacity tests
│   │   ├── soak/            # Memory leak tests
│   │   └── ci/              # Smoke tests
│   └── processors/
│       ├── activitystreams-validator.js
│       └── metrics-collector.js
├── bun/
│   ├── system-profiler.ts
│   ├── baseline-generator.ts
│   └── baseline-comparator.ts
├── baselines/               # System-specific baselines (gitignored)
├── reports/                 # Test results (gitignored)
├── config.ts
├── runner.ts
├── reporter.ts
└── types.ts
```

## Advanced Usage

### Run Single Scenario

```bash
bunx artillery run stress-tests/artillery/scenarios/performance/message-throughput.yml
```

### Custom Sockethub URL

Edit `stress-tests/config.ts`:

```typescript
export const DEFAULT_SOCKETHUB_URL = 'http://custom-host:10550';
```

### Adjust Tolerance

Edit `stress-tests/config.ts`:

```typescript
export const TOLERANCE_PCT = 20; // ±20% instead of ±15%
```

## Troubleshooting

### "No baseline found"

```bash
bun run stress:baseline
```

### "Connection refused"

Ensure dependencies and Sockethub are running:

```bash
bun run docker:start:deps  # Start Redis + Prosody
bun run start              # Start Sockethub locally
```

### High error rates

Check Redis is running:

```bash
docker ps | grep redis
```

### Artillery not found

```bash
bun add -d artillery
```

## Best Practices

1. **Test local code** - Use `docker:start:deps` + `bun run start`, not Docker Sockethub
2. **Run on dedicated hardware** (not laptop with throttling)
3. **Clear Redis between runs** for consistency
4. **Disable debug logging** in production mode
5. **Run full suite before releases**
6. **Track trends over time** (weekly runs)
7. **Document intentional tradeoffs** that affect performance

## Limitations

- Tests server only (not @sockethub/client library)
- Uses Artillery's Socket.IO client (not @sockethub/client)
- Baseline requires consistent hardware
- CI results are unreliable (variable performance)
- Long tests (soak) are expensive

## Next Steps

- Add historical trend tracking
- Implement HTML report generation
- Add platform-specific metrics (XMPP connection pools, Feed cache hits)
- Create Docker Compose profile for stress testing
- Add profiling integration (flame graphs, heap snapshots)
