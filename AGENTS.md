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
`middleware`, `config`). Omit scope for cross-cutting changes. **PR titles with a scope must
use a name that has a matching `scope:*` label** — see [`.github/LABELS.md`](.github/LABELS.md).
Commit messages are not validated the same way; only PR titles trigger auto-label CI.

Breaking changes: add `!` after type/scope (e.g. `feat(client)!: remove deprecated method`).

### PR Titles

PR titles follow the same conventional format. The PR title becomes the squash commit message.

```
<type>(<scope>): <description>
```

If you include a scope, it **must** match an existing GitHub label `scope:<scope>` or the
**Auto Label PR** CI check fails (even when lint/build/tests pass). See
[`.github/LABELS.md`](.github/LABELS.md) for the canonical list. Omit the scope for
cross-cutting changes (including edits to this file or other repo-wide docs).

Examples: `docs: add Cursor Cloud environment setup notes`, `fix(server): handle reconnect`

### Default Branch

The default branch is `master` (not `main`).

## Development

### Prerequisites

- Node.js >= 20 — the **deployment runtime**. Sockethub is built and deployed to
  run on Node.js; the published bins, Docker image, and CI release validation all
  use Node.js.
- Bun >= 1.2.4 — the **development toolchain** (package manager, builder, and unit
  test runner). This is a Bun workspace monorepo managed by Lerna Lite. Bun is a
  dev/build tool only; it is not a deployment target.

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

- Generated reference docs. These are not committed to the repository.
  Edit the source JSDoc in `src/index.ts` or `src/index.js` instead, then run
  the package's `doc` script locally when you need to inspect the generated output.

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
- **Testing**: Test files named `*.test.ts`. Use `describe` and `it` (not `test`).
  Mock external dependencies. Test error paths, not just happy paths.
- **Error Handling**: Always propagate errors to the caller. Never silently swallow errors.
  Log errors with context (session ID, platform, action).

## Platform Development

See `.github/instructions/platforms.instructions.md` for detailed platform implementation
patterns including schema definitions, credential handling, client lifecycle, and cleanup.

## Full Details

See `docs/CONTRIBUTING.md` for the complete contributor guide including version bump rules,
release process, and workflow details.

## Cursor Cloud specific instructions

The startup update script already runs `bun install`. Bun is installed under
`~/.bun/bin` (on `PATH` via `~/.bashrc`); non-login shells may need the full path
`~/.bun/bin/bun`.

- **Redis is required** for anything touching the data layer (the server itself, and
  the `process`/`rate-limiter`/`integration` tests). It is NOT auto-started. Start it
  before running the app or those tests: `redis-server --daemonize yes` (verify with
  `redis-cli ping` → `PONG`). Plain unit tests (`bun test`) do not need Redis.
- **Run the app (dev):** `bun run dev` from the repo root. This rebuilds all packages
  first, then starts the server with hot reload and the examples UI at
  `http://localhost:10550` (WebSocket path `/sockethub`). A quick smoke test: open
  `http://localhost:10550/dummy` and use the `echo` action.
- **Examples must be built before serving.** `bun run dev` builds them for you, but if
  you run the server bin directly with `--examples` and `packages/examples/build` is
  missing, the server exits with an error. Run `bun run build` first in that case.
- **Standard commands** (install/build/test/lint) are documented above under
  `## Development`; use those rather than ad-hoc variants.
- **The `dummy` and `feeds` platforms work end-to-end with only Redis.** Testing the
  `irc` / `xmpp` platforms additionally needs the `ergo` (IRC, `:6667`) and `prosody`
  (XMPP, `:5222`) containers.

### Docker / IRC / XMPP integration testing

Docker is available but the daemon is not auto-started. Start it with
`sudo dockerd > /tmp/dockerd.log 2>&1 &` (the daemon is pre-configured for this VM:
`fuse-overlayfs` storage driver with the `containerd-snapshotter` feature disabled — required
for Docker 29 — and `iptables-legacy`; use `sudo` for all `docker` commands).

- **Start the test servers.** Redis already runs natively on `:6379`, so start only the
  chat servers rather than the full `docker:start:deps` (which would collide on Redis):
  `sudo docker compose up prosody ergo -d`. This also starts `mock-oauth` (an `ergo`
  dependency used by the IRC SASL/OAuth tests). Containers seed test account
  `jimmy` / `passw0rd` on both servers; all integration params live in `integration/config.js`.
- **Run the platform E2E tests** (need the sockethub server + Redis + prosody + ergo all
  running): `bun run integration:browser` runs every XMPP and IRC browser suite. These
  use `@web/test-runner` with headless Chrome (already installed) and are the canonical
  end-to-end tests for IRC/XMPP.
- **Gotcha: the examples IRC UI (`/irc`) hardcodes `secure: true`**, which forces TLS on
  `:6697`; the `ergo` container only publishes plaintext `:6667`, so the browser examples
  page cannot connect to the local IRC server. Use the `integration:browser:irc-*` tests
  (which pass `secure: false`) to exercise IRC locally. The `/xmpp` examples page works
  against local prosody.
