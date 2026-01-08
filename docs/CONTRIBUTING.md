# Contributing to Sockethub

## Commit Message Format

Sockethub follows the [Conventional Commits](https://www.conventionalcommits.org/) specification for all commit messages and branch names.

### Commit Structure

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Purpose | Version Bump | Example |
|------|---------|--------------|---------|
| `feat` | New feature | Minor (0.x.0) | `feat(client): add reconnection logic` |
| `fix` | Bug fix | Patch (0.0.x) | `fix(server): handle null credentials` |
| `docs` | Documentation only | None | `docs: update installation guide` |
| `style` | Code style/formatting (no logic change) | None | `style: fix indentation in server.ts` |
| `refactor` | Code restructuring (no behavior change) | None | `refactor(platform-irc): simplify connection logic` |
| `perf` | Performance improvement | Patch | `perf(job-queue): reduce Redis queries` |
| `test` | Add or update tests | None | `test(client): add reconnection tests` |
| `build` | Build system or dependencies | None | `build: upgrade to Bun 1.2` |
| `ci` | CI/CD configuration | None | `ci: add test coverage reporting` |
| `chore` | Maintenance tasks | None | `chore(deps): update bullmq to v5` |
| `revert` | Revert previous commit | Depends | `revert: "feat(client): add reconnection"` |
| `infra` | Infrastructure changes | None | `infra: add automated release workflow` |

### Breaking Changes

Add `!` after the type/scope to indicate a breaking change:

```
feat(client)!: remove deprecated connect() method

BREAKING CHANGE: The connect() method has been removed. Use connectAsync() instead.
```

Breaking changes trigger a **major version bump** (x.0.0).

### Scopes

Scopes indicate which part of the codebase is affected:

**Package names:**
- `client` - @sockethub/client package
- `server` - @sockethub/server package
- `data-layer` - @sockethub/data-layer package
- `schemas` - @sockethub/schemas package
- `platform-irc` - @sockethub/platform-irc package
- `platform-xmpp` - @sockethub/platform-xmpp package
- (any other package name)

**Components:**
- `job-queue` - BullMQ job queue system
- `credentials` - Credential storage/encryption
- `session` - Session management
- `middleware` - Express/Socket.IO middleware
- `config` - Configuration handling

**No scope:**
- Use when change affects multiple packages
- Use for root-level changes (CI, docs, etc.)

### Examples

```bash
# Feature with scope
feat(client): add automatic reconnection with exponential backoff

# Bug fix with scope
fix(platform-irc): prevent duplicate message handling

# Documentation without scope
docs: add troubleshooting section to README

# Breaking change
feat(schemas)!: change ActivityStream interface signature

BREAKING CHANGE: ActivityStream now requires 'published' timestamp field

# Chore with scope
chore(deps): bump @types/node from 20.0.0 to 20.1.0

# Infrastructure change
infra: configure automated npm publishing workflow

# Test addition
test(server): add integration tests for credential encryption

# Refactoring
refactor(data-layer): extract Redis connection to separate module
```

## Branch Naming

Branch names should follow the same conventional format:

```
<type>/<description>
```

### Examples

```bash
feat/add-matrix-platform
fix/irc-reconnection-loop
docs/update-platform-guide
refactor/simplify-job-queue
test/add-integration-tests
infra/automated-releases
chore/update-dependencies
```

### Branch Name Validation

All PRs must have branch names that start with a valid type prefix. The CI will reject PRs with invalid branch names.

**Valid prefixes:**
- `feat/`, `fix/`, `docs/`, `style/`, `refactor/`, `perf/`, `test/`, `build/`, `ci/`, `chore/`, `revert/`, `infra/`

**Invalid examples:**
- `my-feature` ❌
- `update-docs` ❌
- `bugfix/connection-issue` ❌ (use `fix/` not `bugfix/`)
- `feature/new-platform` ❌ (use `feat/` not `feature/`)

## Pull Request Title

PR titles should also follow conventional format:

```
<type>(<scope>): <description>
```

The PR title will be used for the squash commit message, so it should be clear and descriptive.

### Examples

```
feat(client): add automatic reconnection logic
fix(server): handle platform crash during job execution
docs: add comprehensive release documentation
infra: implement automated release workflow
```

## Workflow

### 1. Create Branch

```bash
# Pick appropriate type prefix
git checkout -b feat/add-reconnection
```

### 2. Make Changes

Write code, tests, and documentation.

### 3. Commit with Conventional Format

```bash
git commit -m "feat(client): add automatic reconnection

Implements exponential backoff with configurable retry limits.
Closes #123"
```

### 4. Pre-Commit Checks

Before committing, always run:

```bash
bun install
bun run lint
bun run build
bun test
```

See [CLAUDE.md](../CLAUDE.md) for AI-specific pre-commit workflow.

### 5. Push and Create PR

```bash
git push -u origin feat/add-reconnection
gh pr create --base master --title "feat(client): add automatic reconnection"
```

### 6. PR Review

- CI runs lint, build, and tests
- Branch name is validated
- Reviewers check code quality
- All checks must pass before merge

### 7. Merge

Use **squash and merge** to maintain clean commit history. The PR title becomes the commit message.

## Version Bumps

Version bumps are **automatic** based on commit types:

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `feat` | Minor (0.x.0) | 5.0.0 → 5.1.0 |
| `fix`, `perf` | Patch (0.0.x) | 5.0.0 → 5.0.1 |
| `BREAKING CHANGE` | Major (x.0.0) | 5.0.0 → 6.0.0 |
| Other types | None | No version change |

See [docs/RELEASING.md](RELEASING.md) for release process details.

## Tips

### Quick Reference

Save this for commit messages:

```bash
# Most common types
feat     - New feature
fix      - Bug fix
docs     - Documentation
test     - Tests
chore    - Dependencies, maintenance
infra    - CI/CD, infrastructure

# Remember: type(scope): description
```

### Commit Message Template

Create a git commit template:

```bash
cat > ~/.gitmessage << 'EOF'
type(scope): description

# type: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, infra
# scope: package name or component (optional)
# description: short summary in present tense

# Body (optional): explain WHAT and WHY, not HOW
# Use imperative mood: "add feature" not "added feature"

# Footer (optional):
# Closes #123
# BREAKING CHANGE: description of breaking change
EOF

git config --global commit.template ~/.gitmessage
```

### Changelog Impact

Only `feat` and `fix` types appear in user-facing changelogs. Other types may appear in detailed logs but won't trigger version bumps.

Choose `feat` vs `fix` based on user impact:
- **feat**: User gets new capability
- **fix**: User's existing workflow now works correctly

## Questions?

- See [RELEASING.md](RELEASING.md) for release workflow
- See [CLAUDE.md](../CLAUDE.md) for AI assistant guidelines
- See https://www.conventionalcommits.org/ for full specification
