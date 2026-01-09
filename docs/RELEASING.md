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

The workflow creates a PR **and a draft GitHub Release** with:

- ✅ Version bumps in all changed packages
- ✅ Formatted with Biome (auto-fixed)
- ✅ Draft GitHub Release with auto-generated notes

**Review checklist:**

- [ ] Version numbers are correct in PR
- [ ] All CI checks pass on PR
- [ ] **Draft release notes are reviewed and polished** (see link in PR description)
- [ ] No unintended changes included

### 3. Review and Edit Draft Release Notes

**CRITICAL**: Before merging the PR, you **must** review and edit the draft GitHub release:

1. Click the draft release link in the PR description, or go to:
   `https://github.com/sockethub/sockethub/releases/tag/vX.Y.Z`
2. Click **Edit release** (or **Edit draft**)
3. Review the auto-generated notes:
   - [ ] All important changes are mentioned
   - [ ] Commit messages are clear and user-friendly
   - [ ] No sensitive information or internal details exposed
   - [ ] Breaking changes are highlighted (if applicable)
4. Polish the release notes:
   - Reword unclear commit messages
   - Add context or migration notes
   - Group related changes
   - Add a summary at the top for major releases
5. **Save draft** (do NOT publish yet)

**Note**: The publish workflow will FAIL if no draft release exists. Auto-generated notes are a
starting point - always polish them before merging.

### 4. Merge to Publish

When you merge the PR:

- 🔨 Lint, build, and tests run
- 📦 All packages publish to npm with correct dist-tag
- ✅ Packages are verified on npm registry
- 🏷️ Git tag is created (`vX.Y.Z`)
- 📝 Draft GitHub Release is published (must exist or publish fails)

If anything fails:

- ❌ Git tag is NOT created
- ❌ GitHub Release is NOT published
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

## Conventional Commits and PR Titles

Release notes are generated from **Pull Request titles and labels**, not individual commits.

### PR Title Format

All PRs must follow conventional commit format in their title:

```
type(scope): description

feat(client): add automatic reconnection
fix(server): handle platform crash during job
docs: update installation instructions
ci: improve release workflow
```

### Automatic Labeling

When you create or update a PR, the `auto-label-pr` workflow automatically:

1. Reads the PR title
2. Extracts the conventional commit prefix (e.g., `feat:`, `fix:`)
3. Applies appropriate labels (e.g., `feat`, `enhancement`)
4. These labels determine which section the PR appears in the release notes

### Commit Messages vs PR Titles

- **Individual commits**: Can be messy, don't affect release notes
- **PR title**: Must be clean, follows conventional format, appears in release notes
- **Squash merging**: PR title becomes the commit message on master

**Best practice**: Use conventional format for PR titles. Individual commits can be informal.

**Types** (affects release notes grouping):

- `feat`: New feature (🚀 Features section)
- `fix`: Bug fix (🐛 Bug Fixes section)
- `docs`: Documentation (📚 Documentation section)
- `test`: Tests (🧪 Tests section)
- `perf`: Performance (⚡ Performance section)
- `refactor`: Refactoring (🔧 Refactoring section)
- `ci`: CI/CD (🔨 Build & CI section)
- `build`: Build system (🔨 Build & CI section)
- `chore`: Maintenance (🧹 Maintenance section)

**Special markers**:

- `!` after type = Breaking change (e.g., `feat!:` or `fix!:`)
- `BREAKING CHANGE:` in PR body = Breaking change section (💥 Breaking Changes)

## Release Notes Strategy

Sockethub uses **GitHub Releases** as the single source of truth (no CHANGELOG.md files).

### Draft Release Creation

The **release-prepare** workflow creates a **draft GitHub release** with auto-generated notes:

- **Prereleases** (alpha, beta, rc): Incremental changes since last release
- **Stable releases**: Rollup of ALL changes since last stable release

You **must** review and polish these notes before merging the release PR.

### For Prereleases (alpha, beta, rc)

Release notes show **incremental changes** since the last release:

```markdown
## v5.0.0-alpha.5 (2026-01-08) [Prerelease]

### 🚀 Features
- **client**: Add automatic reconnection (#123) @username

### 🐛 Bug Fixes
- **server**: Handle platform crash during job (#789) @username

### 🔨 Build & CI
- Improve release workflow (#954) @username
```

### For Stable Releases

Release notes show **rollup of ALL changes** since the last stable release:

```markdown
## v5.0.0 (2026-02-01)

### 🚀 Features
- **client**: Add automatic reconnection (#123) @username
- **platform-irc**: Support SASL authentication (#456) @username
- **server**: Add job retry mechanism (#234) @username

### 🐛 Bug Fixes  
- **server**: Handle platform crash during job (#789) @username
- **client**: Fix memory leak in event listeners (#567) @username

### 📚 Documentation
- Update installation guide (#345) @username

### 🧹 Maintenance
- Update dependencies (#678) @dependabot
```

This rollup includes everything from `v5.0.0-alpha.1` through `v5.0.0-rc.3`, giving users a
complete view of what's new.

### Release Notes Formatting

Release notes are automatically categorized and formatted with:

- **Emojis** for visual organization (🚀 Features, 🐛 Bug Fixes, 📚 Documentation, etc.)
- **PR links** for traceability (#123)
- **Contributor credits** with GitHub usernames (@username)
- **Grouped by category** using PR labels

**How it works**:

1. PRs are automatically labeled based on their title (e.g., `feat:` → `feat` label)
2. GitHub uses `.github/release.yml` to categorize PRs by label
3. Each category gets an emoji and descriptive heading
4. Contributors are automatically credited

See `.github/LABELS.md` for the full list of labels and categories.

### Historical Record

Previous prerelease entries remain in history unchanged (not merged or deleted). Users can filter
to show/hide them in the GitHub UI.

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

### Missing Draft Release

**Error**: `No draft release found for vX.Y.Z`

**Causes**:

- release-prepare workflow failed or was cancelled
- Draft release was manually deleted
- Wrong version tag

**Solution**:

1. Close the release PR
2. Re-run the release-prepare workflow
3. Or manually create a draft release at: `https://github.com/sockethub/sockethub/releases/new?tag=vX.Y.Z`
4. Edit the draft release notes
5. Merge the PR

### Release Notes Empty or Incorrect

**Causes**:

- Commits don't follow conventional format
- No commits since last release
- Wrong scope in commit messages

**Solution**:

1. Edit the draft GitHub Release before merging the PR
2. Future: Follow conventional commit format (see CONTRIBUTING.md)

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
3. Auto-fix formatting with Biome
4. Create `release/vX.Y.Z` branch
5. Commit version changes
6. **Clean up existing draft release if present** (from previous cancelled attempt)
7. **Create draft GitHub Release** with auto-generated notes
8. Create PR to `master` with link to draft release

**Outputs**: Pull Request URL, Draft GitHub Release URL

**Note**: If a release PR is closed without merging, you can safely re-run the workflow. Any
existing draft release will be automatically deleted and recreated with fresh notes.

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
8. **Verify draft GitHub Release exists** (fail if not found)
9. Publish the draft release (makes it public)
10. If any step fails: Create issue with rollback instructions

**Outputs**: Published packages, Published GitHub Release, git tag

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
A: Yes, just close the PR without merging. The draft release will remain but will be
automatically cleaned up if you re-run the workflow for the same version. You can also manually
delete it from the Releases page.

**Q: What if I close a release PR and then create a new one for the same version?**
A: The workflow automatically detects and deletes any existing draft release before creating a
new one. This ensures fresh release notes are generated from the latest commits.

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
