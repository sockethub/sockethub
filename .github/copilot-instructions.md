# Sockethub Code Review Instructions

## Review Philosophy

**ONLY comment when you have HIGH CONFIDENCE (>80%) that an issue exists.**

Focus on real problems that affect:
- Security vulnerabilities
- Data integrity issues
- Type safety violations
- Architectural violations
- Breaking changes to public APIs

DO NOT comment on:
- Code style preferences (Biome handles this)
- Subjective naming choices
- Minor performance micro-optimizations
- Hypothetical edge cases without evidence
- Suggestions to add comments or documentation

## Architecture Principles

Sockethub is a protocol gateway using ActivityStreams. Understanding these core patterns is critical:

### Process Isolation
- Each platform MUST run as a separate child process
- Platforms communicate with the server via IPC only
- NEVER add direct imports between server and platform code
- Platform crashes MUST NOT affect other platforms or the server

### ActivityStreams Protocol
- All messages MUST conform to ActivityStreams format
- Every ActivityStream requires: `type`, `context`, `actor`
- Use proper types from `@sockethub/schemas`
- NEVER create ad-hoc message formats

### Job Queue & Redis
- All platform communication goes through BullMQ job queues
- Jobs MUST handle failures gracefully (retries, dead letter queues)
- Queue operations MUST be atomic where data consistency matters

### Session & Credential Management
- Credentials MUST be encrypted before Redis storage
- Each Socket.IO session MUST be isolated (no credential leaking)
- NEVER log credentials or sensitive data

## Security Requirements

Flag these issues with HIGH priority:

### Credential Handling
```typescript
// WRONG - plaintext credential storage
redis.set(`creds:${sessionId}`, JSON.stringify(credentials));

// CORRECT - encrypted storage
await credentialsStore.save(sessionId, actorId, credentials);
```

### Input Validation
- ALL external inputs MUST be validated against schemas
- Use AJV validators from `@sockethub/schemas`
- NEVER trust client data without validation

### Process Boundaries
- NEVER pass sensitive data through IPC without encryption context
- Session secrets MUST NOT cross process boundaries

## Code Standards

### TypeScript Usage
```typescript
// WRONG - using any
function processMessage(msg: any) { }

// CORRECT - proper types
function processMessage(msg: ActivityStream) { }
```

- Prefer `const` over `let` where immutability applies
- Use proper types from `@sockethub/schemas`, avoid `any`
- Interface implementations MUST match exactly (e.g., `PlatformInterface`)

### Error Handling
```typescript
// WRONG - silent failures
try {
  await platformAction();
} catch (e) {}

// CORRECT - proper error propagation
try {
  await platformAction();
} catch (err) {
  this.debug(`Platform action failed: ${err.message}`);
  callback(err);
  return;
}
```

- IPC errors MUST be handled (process can crash)
- Job failures MUST be logged and reported
- Errors MUST include context (session ID, platform, action)

### Testing Standards
- Test files named `*.test.ts` using Bun test framework
- Use `describe` and `test` (not `it`)
- Mock external dependencies (Redis, network calls)
- MUST test error paths, not just happy paths

```typescript
// CORRECT pattern
describe("platform initialization", () => {
  test("connects successfully with valid credentials", async () => {
    // test implementation
  });

  test("handles connection timeout gracefully", async () => {
    // test error case
  });
});
```

## Common False Positives to Ignore

These patterns are intentional in this codebase:

1. **Biome ignore comments** - Already approved for specific cases
2. **Type assertions in tests** - Often needed for mocking
3. **Debug logging without error handling** - Debug module handles this
4. **Empty catch blocks in cleanup** - Sometimes necessary during shutdown
5. **Process.exit() calls** - Platforms are child processes and should exit on fatal errors

## Platform-Specific Patterns

See `platforms.instructions.md` for detailed platform development guidelines.

## Monorepo Structure

This is a Bun workspace monorepo managed by Lerna Lite. When reviewing changes, consider the package context:

- `packages/server/` - Main server, middleware, process management
- `packages/sockethub/` - Main executable/CLI entry point
- `packages/client/` - JavaScript client library for browsers/apps
- `packages/platform-*/` - Individual protocol implementations (IRC, XMPP, Feeds, Metadata, Dummy)
- `packages/schemas/` - Type definitions and validators
- `packages/data-layer/` - Redis, job queues, credential storage
- `packages/activity-streams/` - ActivityStreams factory and utilities
- `packages/crypto/` - Cryptographic utilities for credential encryption
- `packages/irc2as/` - IRC to ActivityStreams conversion library
- `packages/examples/` - SvelteKit demo application

### Key Dependency Rules

- Server MUST NOT directly import platform code (platforms are child processes)
- All packages should use types from `@sockethub/schemas`
- Platforms MUST implement the `PlatformInterface` from schemas
