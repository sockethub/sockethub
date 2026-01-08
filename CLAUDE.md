# CLAUDE.md

AI-specific guidance for working with this codebase. See [README.md](README.md) for architecture overview and [Contributing](README.md#contributing) for key files.

## Pre-Commit Workflow

**ALWAYS run these commands before creating a commit:**

1. `bun install` - Ensure expected dependencies are installed
2. `bun run lint` - Check code style with Biome
3. `bun run build` - Ensure the code builds
4. `bun test` - Run unit tests to ensure nothing broke
5. Fix any failures before committing

If tests or linting fail, the commit should not be created.

## Release Process

This project uses automated releases via GitHub Actions for alpha releases.

### Alpha Releases (alpha branch)

**Manual trigger only** via GitHub Actions:

1. Ensure you're on the `alpha` branch
2. Go to Actions → "Release (Alpha)" → "Run workflow"
3. Select bump type:
   - **prerelease**: Bumps `5.0.0-alpha.4` → `5.0.0-alpha.5` (most common)
   - **preminor**: Bumps `5.0.0-alpha.4` → `5.1.0-alpha.0` (new minor features)
   - **premajor**: Bumps `5.0.0-alpha.4` → `6.0.0-alpha.0` (breaking changes)

The workflow will:
- Run lint, build, and tests
- Version packages using Lerna (independent versioning)
- Publish to npm with `@alpha` dist-tag
- Create a GitHub release

**Install alpha releases:**
```bash
bun install sockethub@alpha
bun install @sockethub/client@alpha
```

**Required secrets:**
- `NPM_TOKEN` - npm automation token with publish permissions

### Branch Strategy

- `alpha` - Alpha releases (unstable, breaking changes expected)
- `master` - Stable releases (future, not yet used for v5)

All development targeting alpha releases should be done on feature branches that PR into `alpha`.

## Code Style Preferences

### Testing
- Use **Bun test framework** (not Jest or Mocha)
- Test files named `*.test.ts`
- Use `describe` and `test` (not `it`)
- Always test error paths, not just happy paths

### TypeScript
- Avoid `any` types - use proper types from `@sockethub/schemas`
- Use `const` over `let` where applicable
- Platform implementations MUST implement `PlatformInterface` exactly

### Debugging
- Use `this.debug()` from platform session (don't create new debug instances)
- Debug patterns: `DEBUG=sockethub:*` or `DEBUG=sockethub:platform:irc`
- NEVER log credentials or sensitive data

## Common Patterns to Avoid

1. **Don't import server code in platforms** - Platforms are child processes, communicate via IPC only
2. **Don't store credentials in platforms** - Server handles encrypted storage, platforms receive as needed
3. **Don't create multiple client instances** - Reuse existing connections per actor
4. **Don't silence errors** - Always propagate errors through callbacks with context

## Code Generation Hints

When implementing platforms:
- Check `packages/platform-dummy` as reference implementation
- Schema MUST match package name (e.g., `platform-irc` → schema `name: "irc"`)
- Persistent platforms need `config.requireCredentials` array
- All protocol I/O MUST be async with callbacks/promises

When working with ActivityStreams:
- Required fields: `type`, `context`, `actor`
- Use types from `@sockethub/schemas`, don't create ad-hoc structures
- Validate incoming messages via middleware (don't re-validate in platforms)
