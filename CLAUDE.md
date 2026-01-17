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

### Commit Messages
- Follow [Conventional Commits](https://www.conventionalcommits.org/)
- Common types: `feat`, `fix`, `docs`, `test`, `chore`, `ci`
- Format: `type(scope): description` or `type: description`
- Breaking changes: `type(scope)!: description` + footer with `BREAKING CHANGE:`
- See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for complete guide

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

## Release Process

Sockethub uses a simplified single-branch release workflow. See [docs/RELEASING.md](docs/RELEASING.md) for complete documentation.

### Quick Release Guide

**For AI assistants performing releases:**

1. **Never manually edit version numbers** - Always use the GitHub Actions workflow
2. **Never commit directly to release branches** - Only merge prepared PRs
3. **Never push release tags manually** - Tags are created automatically on publish

### Triggering a Release

To prepare a new release:

```bash
# Navigate to GitHub Actions → "Prepare Release" → Run workflow
# OR use gh CLI:
gh workflow run release-prepare.yml \
  -f bump=prerelease \
  -f preid=alpha
```

**Bump types:**
- `prerelease` - Increment prerelease (5.0.0-alpha.4 → 5.0.0-alpha.5)
- `prepatch` - New patch prerelease (5.0.0 → 5.0.1-alpha.0)
- `preminor` - New minor prerelease (5.0.0 → 5.1.0-alpha.0)
- `premajor` - New major prerelease (5.0.0 → 6.0.0-alpha.0)
- `patch` - Stable patch (5.0.0 → 5.0.1)
- `minor` - Stable minor (5.0.0 → 5.1.0)
- `major` - Stable major (5.0.0 → 6.0.0)

**Prerelease identifiers:**
- `alpha` - Early unstable releases → npm dist-tag `@alpha`
- `beta` - Feature-complete stabilization → npm dist-tag `@beta`
- `rc` - Release candidates → npm dist-tag `@next`
- *(empty)* - Stable release → npm dist-tag `@latest`

### Release Workflow Steps

1. **Prepare** (automated):
   - Workflow creates branch `release/vX.Y.Z`
   - Bumps versions in all changed packages
   - Generates/updates changelogs from conventional commits
   - Creates PR to master

2. **Review** (manual):
   - Review PR for correct versions and changelog
   - Edit changelog for clarity if needed (only edit docs, not code)
   - Ensure CI passes
   - Merge when ready

3. **Publish** (automated on merge):
   - Runs lint, build, tests
   - Publishes to npm with correct dist-tag
   - Verifies packages on npm registry
   - Creates git tag
   - Creates GitHub Release
   - If anything fails: creates issue with rollback instructions

### Conventional Commits

Changelog quality depends on commit message format:

```
type(scope): description

Examples:
feat(client): add automatic reconnection
fix(server): handle platform crash during job
docs: update installation guide
chore(deps): bump bullmq to v5
```

**Important types:**
- `feat`: New feature (triggers minor bump, appears in changelog)
- `fix`: Bug fix (triggers patch bump, appears in changelog)
- `docs`, `chore`, `test`, `refactor`: No version bump, may appear in changelog

### Dist-Tag Strategy

Tags are automatically determined from version:

| Version | Dist-Tag | Install Command |
|---------|----------|-----------------|
| `5.0.0-alpha.5` | `@alpha` | `npm install sockethub@alpha` |
| `5.0.0-beta.1` | `@beta` | `npm install sockethub@beta` |
| `5.0.0-rc.1` | `@next` | `npm install sockethub@next` |
| `5.0.0` | `@latest` | `npm install sockethub` |

### Common Release Scenarios

**Next alpha release:**
```bash
gh workflow run release-prepare.yml -f bump=prerelease -f preid=alpha
```

**First beta from alpha:**
```bash
# Change preid from alpha to beta, keep prerelease bump
gh workflow run release-prepare.yml -f bump=prerelease -f preid=beta
```

**First stable release:**
```bash
# Use major/minor/patch with NO preid to remove prerelease suffix
gh workflow run release-prepare.yml -f bump=major
```

**Stable patch release:**
```bash
gh workflow run release-prepare.yml -f bump=patch
```

### Troubleshooting

**NPM token expired:**
- Error appears in publish workflow
- Update `NPM_TOKEN` secret in GitHub repo settings
- Re-trigger workflow or create new release PR

**Wrong changelog:**
- Edit changelog files in release PR before merging
- Use conventional commits going forward

**Failed publish:**
- Workflow creates GitHub issue with rollback instructions
- No git tag or GitHub Release created (safe state)
- Some packages may be published (check npm manually)

### What AI Should NOT Do

❌ Don't manually edit package.json versions
❌ Don't run `lerna version` or `lerna publish` locally
❌ Don't create git tags manually
❌ Don't create GitHub Releases manually
❌ Don't commit to `release/*` branches directly

### What AI CAN Do

✅ Trigger "Prepare Release" workflow via gh CLI
✅ Review release PRs and suggest changelog improvements
✅ Edit changelog files in release PR for clarity
✅ Help troubleshoot failed releases
✅ Update RELEASING.md documentation
