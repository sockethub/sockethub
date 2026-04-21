# Sockethub Code Review Instructions

Read and follow all project conventions in [AGENTS.md](../AGENTS.md).
The sections below are additional Copilot-specific code review guidance.

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
