# Release Process

This document describes Sockethub's simplified single-branch release process.

## Overview

Sockethub uses a **prepare → review → publish** workflow that:

1. Creates a release preparation PR with version bumps and changelogs
2. Allows manual review and edits before publishing
3. Automatically publishes to npm when the PR is merged
4. Verifies packages on npm before creating git tags

All releases happen from the `master` branch using ephemeral `release/*` branches.

## Release Types

### Prerelease (Alpha/Beta/RC)

Prereleases use identifiers to mark versions as unstable:

- **Alpha** (`5.0.0-alpha.5`): Early development, unstable API
- **Beta** (`5.0.0-beta.1`): Feature complete, stabilizing API
- **RC** (`5.0.0-rc.1`): Release candidate, production-ready testing

### Stable Release

Stable releases have no prerelease identifier (`5.0.0`) and become the default install version.

## Dist-Tags

npm dist-tags are determined automatically from the version string:

| Version Pattern | Dist-Tag | Install Command |
|----------------|----------|-----------------|
| `X.Y.Z-alpha.N` | `@alpha` | `npm install sockethub@alpha` |
| `X.Y.Z-beta.N` | `@beta` | `npm install sockethub@beta` |
| `X.Y.Z-rc.N` | `@next` | `npm install sockethub@next` |
| `X.Y.Z` | `@latest` | `npm install sockethub` |

## Quick Start

### 1. Trigger Release Preparation

Go to **Actions** → **Prepare Release** → **Run workflow**

Choose your bump type:

- `prerelease` - Bump prerelease number (5.0.0-alpha.4 → 5.0.0-alpha.5)
- `prepatch` - Bump patch and add prerelease (5.0.0 → 5.0.1-alpha.0)
- `preminor` - Bump minor and add prerelease (5.0.0 → 5.1.0-alpha.0)
- `premajor` - Bump major and add prerelease (5.0.0 → 6.0.0-alpha.0)
- `patch` - Bump patch version (5.0.0 → 5.0.1)
- `minor` - Bump minor version (5.0.0 → 5.1.0)
- `major` - Bump major version (5.0.0 → 6.0.0)

Enter prerelease identifier if needed:

- `alpha` for alpha releases
- `beta` for beta releases
- `rc` for release candidates
- Leave empty for stable releases

### 2. Review the Release PR

The workflow creates a PR with:

- ✅ Version bumps in all changed packages
- ✅ Updated CHANGELOG.md files (root + per-package)
- ✅ Conventional commit summaries

**Review checklist:**

- [ ] Version numbers are correct
- [ ] Changelog entries are accurate and complete
- [ ] No unintended changes included
- [ ] All CI checks pass

You can manually edit the PR to:

- Improve changelog wording
- Add missing context
- Fix version numbers (if needed)

**⚠️ Important**: Only edit version/changelog files, not code.

### 3. Merge to Publish

When you merge the PR:

- 🔨 Lint, build, and tests run
- 📦 All packages publish to npm with correct dist-tag
- ✅ Packages are verified on npm registry
- 🏷️ Git tag is created (`vX.Y.Z`)
- 📝 GitHub Release is created

If anything fails:

- ❌ Git tag is NOT created
- ❌ GitHub Release is NOT created
- 🐛 Issue is created with rollback instructions

## Release Examples

### Example 1: Next Alpha Release

**Current version**: `5.0.0-alpha.4`
**Goal**: Release `5.0.0-alpha.5`

1. Actions → Prepare Release → Run workflow
   - Bump type: `prerelease`
   - Preid: `alpha`
2. Review PR `release/v5.0.0-alpha.5`
3. Merge → Publishes to `npm install sockethub@alpha`

### Example 2: First Beta Release

**Current version**: `5.0.0-alpha.8`
**Goal**: Release `5.0.0-beta.0`

1. Actions → Prepare Release → Run workflow
   - Bump type: `preminor` (or `prerelease` if already on beta)
   - Preid: `beta`
2. Review PR `release/v5.0.0-beta.0`
3. Merge → Publishes to `npm install sockethub@beta`

### Example 3: First Stable Release

**Current version**: `5.0.0-rc.2`
**Goal**: Release `5.0.0` (stable)

1. Actions → Prepare Release → Run workflow
   - Bump type: `major` (removes prerelease)
   - Preid: *(leave empty)*
2. Review PR `release/v5.0.0`
3. Merge → Publishes to `npm install sockethub` (becomes `@latest`)

### Example 4: Stable Patch Release

**Current version**: `5.0.0`
**Goal**: Release `5.0.1` (bugfix)

1. Actions → Prepare Release → Run workflow
   - Bump type: `patch`
   - Preid: *(leave empty)*
2. Review PR `release/v5.0.1`
3. Merge → Publishes to `npm install sockethub@latest`

## Conventional Commits

Changelog quality depends on commit message format:

```
type(scope): description

feat(client): add automatic reconnection
fix(server): handle platform crash during job
docs: update installation instructions
chore(deps): update bullmq to v5
```

**Types** (affects changelog grouping):

- `feat`: New feature (shows in changelog)
- `fix`: Bug fix (shows in changelog)
- `docs`: Documentation only
- `chore`: Maintenance (dependency updates, etc.)
- `test`: Test additions/changes
- `refactor`: Code restructuring without behavior change
- `perf`: Performance improvements

**Scopes** (affects per-package changelogs):

- Package name: `client`, `server`, `platform-irc`, etc.
- Component: `job-queue`, `credentials`, `session`, etc.

## Changelog Structure

### Root Changelog (`/CHANGELOG.md`)

High-level overview of changes across all packages:

```markdown
## v5.0.0-alpha.5 (2026-01-08)

### Features
- **client**: Add automatic reconnection (#123)
- **platform-irc**: Support SASL authentication (#456)

### Bug Fixes
- **server**: Handle platform crash during job (#789)
```

### Per-Package Changelogs (`/packages/*/CHANGELOG.md`)

Detailed changes for specific package:

```markdown
## @sockethub/client v5.0.0-alpha.5 (2026-01-08)

### Features
- Add automatic reconnection with exponential backoff
- Support custom retry strategies

### Bug Fixes
- Fix memory leak in event listeners
```

## Independent Versioning

Sockethub uses Lerna's **independent** versioning mode:

- Each package has its own version number
- Only changed packages get version bumps
- Unchanged packages keep their current version

A single release might update:

- `@sockethub/client`: `5.0.0-alpha.4` → `5.0.0-alpha.5`
- `@sockethub/platform-irc`: `5.0.0-alpha.3` → `5.0.0-alpha.4`
- `@sockethub/server`: `5.0.0-alpha.4` (unchanged)

## Troubleshooting

### NPM Token Expired

**Error**: `NPM_TOKEN is invalid or expired`

**Solution**:

1. Generate new token at <https://www.npmjs.com/settings/YOUR_USERNAME/tokens>
2. Update GitHub secret: Settings → Secrets → `NPM_TOKEN`
3. Re-run the publish workflow or create a new release PR

**Prevention**: Set calendar reminder for token renewal (90 days).

### Package Verification Failed

**Error**: `Package not found on npm`

**Causes**:

- npm registry propagation delay (should auto-retry)
- Publish partially failed
- Network issues

**Solution**:

1. Check npm manually: `npm view @sockethub/client@X.Y.Z`
2. If packages exist, git tag manually and create GitHub Release
3. If packages missing, republish: `lerna publish from-package --dist-tag <tag>`

### Wrong Dist-Tag

**Problem**: Published with wrong dist-tag (e.g., `alpha` instead of `beta`)

**Solution**:

```bash
# Add correct tag
npm dist-tag add @sockethub/client@5.0.0-beta.1 beta

# Remove wrong tag
npm dist-tag rm @sockethub/client alpha
```

### Changelog Empty or Incorrect

**Causes**:

- Commits don't follow conventional format
- No commits since last release
- Wrong scope in commit messages

**Solution**:

1. Edit changelog manually in release PR before merging
2. Future: Follow conventional commit format

### Release PR CI Failed

**Problem**: Tests fail in release PR

**Solution**:

1. Close the release PR (don't merge)
2. Fix the failing tests on master
3. Create a new release PR

**Do not** push fixes to the release branch - it should only contain version/changelog updates.

## Maintenance

### Update NPM Token

**Frequency**: Every 90 days (set reminder)

**Steps**:

1. Log in to <https://www.npmjs.com/>
2. Settings → Access Tokens → Generate New Token
3. Type: "Automation" or "Publish"
4. Copy token
5. GitHub repo → Settings → Secrets and variables → Actions
6. Update `NPM_TOKEN` secret

### Migrate Dist-Tags

When transitioning from alpha to beta or beta to stable:

```bash
# Example: Migrating from 'next' tag (old alpha) to 'alpha' tag
npm dist-tag add sockethub@5.0.0-alpha.5 alpha
npm dist-tag rm sockethub next

# Verify
npm dist-tag ls sockethub
```

### Clean Up Old Releases

GitHub releases and git tags are permanent, but you can hide old prereleases:

- Edit GitHub Release → Check "Set as a pre-release"
- This hides it from the main releases page

## CI Workflow Details

### Prepare Workflow (`.github/workflows/release-prepare.yml`)

**Trigger**: Manual workflow dispatch

**Steps**:

1. Checkout `master`
2. Run `lerna version` with chosen bump type
3. Create `release/vX.Y.Z` branch
4. Commit version changes
5. Create PR to `master`

**Outputs**: Pull Request URL

### Publish Workflow (`.github/workflows/release-publish.yml`)

**Trigger**: PR merge to `master` where branch matches `release/v*`

**Steps**:

1. Extract version from branch name
2. Determine dist-tag from version pattern
3. Run lint, build, tests
4. Validate NPM token
5. Publish packages: `lerna publish from-package --dist-tag <tag>`
6. Verify packages on npm (wait 30s, then check each)
7. Create git tag `vX.Y.Z`
8. Create GitHub Release with changelog
9. If any step fails: Create issue with rollback instructions

**Outputs**: Published packages, GitHub Release, git tag

## Security

### Secrets Required

- `NPM_TOKEN`: npm automation token (write access)
- `GITHUB_TOKEN`: Provided automatically by GitHub Actions

### Token Scopes

**NPM_TOKEN**:

- Type: "Automation" or "Publish"
- Permissions: Publish and manage packages
- Expiration: 90 days (max)

**GITHUB_TOKEN**:

- Permissions: `contents: write`, `pull-requests: write`
- Scoped to repository only
- Expires after workflow run

## FAQ

**Q: Can I cancel a release after creating the PR?**
A: Yes, just close the PR without merging. The release branch can be deleted.

**Q: Can I edit versions manually in the PR?**
A: Yes, but be careful to update all package.json files consistently.

**Q: What if I merge a release PR by accident?**
A: The publish workflow will run. If you catch it quickly, you can manually fail the
workflow in the Actions tab.

**Q: How do I unpublish a bad release?**
A: npm doesn't allow unpublishing after 24 hours. Instead, publish a new patch version with the fix.

**Q: Can I release just one package?**
A: Not directly with this workflow. Use `lerna publish` manually with specific package scope.

**Q: Why do we wait 30 seconds to verify packages?**
A: npm registry has eventual consistency. Packages may take a few seconds to appear after publish.

**Q: What happens to the release branch after merge?**
A: GitHub automatically deletes it (can be configured in repo settings).
