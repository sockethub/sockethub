# Sockethub - AI Agent Instructions

This is the canonical source of project conventions for AI agents.
Tool-specific files (CLAUDE.md, copilot-instructions.md) should reference this file.

## Conventions (CI-Enforced)

### Branch Naming

Branches MUST use a conventional type prefix. CI rejects PRs with invalid branch names.

```
<type>/<short-description>
```

Valid prefixes: `feat/`, `fix/`, `docs/`, `style/`, `refactor/`, `perf/`, `test/`, `build/`,
`ci/`, `chore/`, `revert/`, `infra/`

Examples: `feat/add-matrix-platform`, `fix/irc-reconnection-loop`, `docs/update-api-guide`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
`revert`

Scopes (optional): package names (`client`, `server`, `data-layer`, `schemas`, `platform-irc`,
`platform-xmpp`, `examples`, etc.) or components (`job-queue`, `credentials`, `session`,
`middleware`, `config`). Omit scope for cross-cutting changes.

Breaking changes: add `!` after type/scope (e.g. `feat(client)!: remove deprecated method`).

### PR Titles

PR titles follow the same conventional format. The PR title becomes the squash commit message.

```
<type>(<scope>): <description>
```

### Default Branch

The default branch is `master` (not `main`).

## Development

### Prerequisites

- Bun >= 1.2.4 (runtime and package manager)
- This is a Bun workspace monorepo managed by Lerna Lite

### Commands

```bash
bun install                 # Install dependencies
bun test                    # Run unit tests across all packages
bun run lint                # Run Biome linter and markdown lint
bun run lint:fix            # Auto-fix linting issues
bun run build               # Build all packages
bun run clean               # Clean build artifacts
```

### Pre-Commit Checklist

Before committing, run:

```bash
bun install
bun run lint
bun run build
bun test
```

## Monorepo Structure

```
packages/
  server/           - Main server, middleware, Socket.IO, process management
  sockethub/        - CLI entry point and executable
  client/           - JavaScript client library for browsers/apps
  data-layer/       - Redis, BullMQ job queues, credential storage
  schemas/          - TypeScript types and AJV validators
  activity-streams/ - ActivityStreams factory and utilities
  crypto/           - Cryptographic utilities for credential encryption
  irc2as/           - IRC to ActivityStreams conversion library
  platform-irc/     - IRC protocol platform
  platform-xmpp/    - XMPP protocol platform
  platform-feeds/   - RSS/Atom feeds platform
  platform-metadata/- URL metadata extraction platform
  platform-dummy/   - Reference/test platform implementation
  examples/         - SvelteKit demo application
```

## Things NOT to Edit

- Generated reference docs such as `packages/*/API.md` or `packages/*/docs/*`.
  Edit the source JSDoc in `src/index.ts` or `src/index.js` instead, then run
  the package's `doc` script.

## Architecture

Sockethub is a protocol gateway that translates between web applications and messaging protocols
using ActivityStreams as the uniform message format.

### Core Principles

- **Process Isolation**: Each platform runs as a separate child process. Never add direct
  imports between server and platform code. Platform crashes must not affect other platforms.
- **ActivityStreams Protocol**: All messages must conform to ActivityStreams format with `type`,
  `context`, and `actor` fields. Use types from `@sockethub/schemas`.
- **Job Queue**: All platform communication goes through Redis-backed BullMQ queues.
- **Session Isolation**: Credentials are encrypted per-session. Never log credentials.

### Key Dependency Rules

- Server MUST NOT directly import platform code (platforms are child processes via IPC)
- All packages should use types from `@sockethub/schemas`
- Platforms MUST implement `PlatformInterface` from schemas

## Code Standards

- **TypeScript**: Use proper types from `@sockethub/schemas`. Avoid `any`.
- **Linting**: Biome handles formatting and style. Don't comment on style.
- **Testing**: Test files named `*.test.ts`. Use `describe` and `test` (not `it`).
  Mock external dependencies. Test error paths, not just happy paths.
- **Error Handling**: Always propagate errors to the caller. Never silently swallow errors.
  Log errors with context (session ID, platform, action).

## Platform Development

See `.github/instructions/platforms.instructions.md` for detailed platform implementation
patterns including schema definitions, credential handling, client lifecycle, and cleanup.

## Full Details

See `docs/CONTRIBUTING.md` for the complete contributor guide including version bump rules,
release process, and workflow details.
