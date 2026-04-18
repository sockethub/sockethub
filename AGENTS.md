# Agent Notes

Always use `bun` instead of `npm` for all commands.

## Services & Testing

**CRITICAL:** DO NOT start services or run integration tests without explicit permission

- **NEVER** start Sockethub, Redis, or any Docker containers
- **NEVER** run integration tests (unit tests via `bun test` are OK if needed)
- User controls all services - assume they're already running if needed
- If you need to see test output or logs, **ASK THE USER** for them
- Integration tests live in `integration/` (repo root) or `packages/*/integration/`
- Filenames: `*.integration.ts` (NOT `*.test.ts`)
- They are NOT run as part of `bun test`

## Completion Checklist

Before reporting task completion, always run:

1. `bun lint:fix`
2. `bun run build`
3. `bun test`

## Git Workflow

- Do not commit unless the user explicitly gives permission; otherwise report
  completion status and suggest a commit message
- Never add Co-Authored-By or credits to commits
- Never use `git add -A` or `git add .`
- Never push to remote
- Branch naming: use `fix/<short-description>` or `feat/<short-description>` (kebab-case)
- PR title: sentence case, concise, no prefix tags
- PR body: avoid a "Testing" section; use a short "Notes" section if
  needed

## Build

```bash
bun build
```

## Testing

```bash
bun test
```

## Linting

```bash
bun run lint
```

```bash
bun run lint:fix
```

## Troubleshooting

### Bun Cache Issues

If you encounter issues where bun loads an old version of a dependency
(e.g., wrong methods on a class), ask the user to clear bun's cache from the
repo root:

```bash
bun run clean:deps && bun install
```

Do not attempt to clear the cache yourself without asking.
