# Sockethub Performance & Stress Testing

Comprehensive load testing suite for Sockethub server using Artillery.

## Quick Start

```bash
# 1. Start dependencies (Redis + Prosody for XMPP tests)
bun run docker:start:deps

# 2. Start Sockethub locally
bun run start

# For XMPP scenarios, supply a seeded test account (password from your environment):
export XMPP_USER=jimmy@prosody
export XMPP_SERVER=xmpp://localhost:5222
export XMPP_ROOM=testroom@conference.prosody
# Set XMPP_PASSWORD in your shell or secret manager.
# Feed stress requires FEED_URL pointing to a real, controlled RSS/Atom fixture.

# 3. Generate baseline (first time only)
bun run stress:baseline

# 4. Run tests
bun run stress:performance    # Performance tests (~10 min)
bun run stress:stress         # Stress tests (~15 min)
bun run stress:soak          # Soak test (30 min)
bun run stress:all           # All tests (~60 min)
bun run stress:ci            # CI smoke test (1-2 min)

# 5. View results
bun run stress:report --latest --html
```

## What We Test

### Performance Tests (Baseline Metrics)

**Goal**: Measure normal performance with realistic load

- **Connection Baseline**: 100 connections over 2 minutes
- **Message Throughput**: 50 clients, each sending up to 10 msg/sec for 3000 iterations
- **Multi-Client Broadcast**: 20 clients in shared XMPP room (action acknowledgement latency)

**Platform**: Dummy (fast baseline), XMPP (real protocol)

### Stress Tests (Breaking Points)

**Goal**: Find maximum capacity before system fails

- **Connection Storm**: Ramp 0→1000 connections in 30 seconds
- **Message Flood**: Ramp 1→100 msg/sec with XMPP protocol
- **Feed Processing**: 50 new clients/sec fetching a controlled feed fixture
- **Spike Test**: Baseline → 10x spike → baseline recovery

**Platform**: XMPP (realistic overhead), Feed (different pattern)

### Soak Test (Memory Leaks)

**Goal**: Detect resource leaks over time

- **Long Duration**: 30 minutes sustained load
- **Memory Tracking**: Server/worker resource sampling is not implemented; collect externally
- **Platform Stability**: Sustained-load error detection

**Platform**: Dummy (fast)

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

1. **System Profile**: Filename keyed by CPUs, RAM, and hostname;
   this is not a complete environment fingerprint
2. **Generation**: 3 warmup runs + 5 baseline runs → median
3. **Storage**: `baselines/{hostname}-{cpus}c-{memory}gb.json`
4. **Comparison**: 15% regression tolerance for message-throughput;
   improvements do not fail

### When to Regenerate

- First time running tests
- After runtime, dependency, workload, or hardware changes (start a new comparison series)

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
- Memory leak (continuous growth, measured with external server monitoring)
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

### Option 1: No CI (recommended)

- Run tests manually before releases
- Track trends locally

### Option 2: Smoke Test Only

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

```bash
SOCKETHUB_URL=http://custom-host:10550 bun run stress:performance
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
3. **Clear only the benchmark Redis instance between runs** for consistency
4. **Disable debug logging** in production mode
5. **Run full suite before releases**
6. **Track trends over time** (weekly runs)
7. **Document intentional tradeoffs** that affect performance

## Limitations

- Tests server capacity (uses @sockethub/client for proper ActivityStreams formatting)
- Baseline requires consistent hardware
- CI results are unreliable (variable performance)
- Long tests (soak) are expensive

## Next Steps

- Add historical trend tracking
- Extend the standalone HTML report with historical release charts
- Add platform-specific metrics (XMPP connection pools, Feed cache hits)
- Create Docker Compose profile for stress testing
- Add profiling integration (flame graphs, heap snapshots)

## Measurement contract

Latency histograms contain successful action acknowledgements only, or Socket.IO
connection establishment time for connection-baseline. XMPP action acknowledgements
do not measure recipient delivery or broadcast fan-out. Missing samples are shown
as absent, never as zero. Throughput is successful protocol actions divided by
the total scenario elapsed time (including setup and teardown); error rate is
failed protocol attempts divided by all protocol attempts. Connection-only tests
use failed-user counts instead. Sockethub error events and users with errors are
reported separately to avoid double counting.

The workload uses closed-loop pacing: each user waits for an acknowledgement and
then the configured think time. Slow responses lower the offered message rate.
The fixed-client performance scenarios use arrivalCount, whereas stress scenarios
intentionally ramp new users per second.

The baseline generator measures only message-throughput. It rejects missing or
failed measurements and does not invent connection or capacity limits. Keep the
reference unchanged when testing another release on the same environment.
Old baselines used different throughput semantics and are ignored by the loader;
regenerate them once after this correction. New baselines carry measurement_version 2.
Other scenarios are not compared against the echo baseline.

Generate a portable HTML table and latency chart with:

```bash
bun run stress:report --latest --html
bun run stress:report stress-tests/reports/<suite-report>.json --html
```

The latest-report selector excludes raw temporary Artillery and baseline files.
Reports remain local and unversioned; release history and remote automation require
the separate automated benchmarking system. Feed fixtures on private addresses
require the integration configuration's allowPrivateAddresses setting.
