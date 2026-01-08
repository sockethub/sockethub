# Releasing Sockethub

This document describes the release process for Sockethub packages.

## Overview

Sockethub uses **automated releases** via GitHub Actions with **manual triggering** for control.
The project is currently in **alpha stage** (v5.0.0-alpha.x), using independent versioning managed
by Lerna.

## Release Types

### Alpha Releases (Current)

- **Branch:** `alpha`
- **Version format:** `5.0.0-alpha.N` (e.g., `5.0.0-alpha.5`)
- **npm dist-tag:** `@alpha`
- **Install:** `bun install sockethub@alpha`
- **Purpose:** Unstable development releases, breaking changes expected

### Beta Releases (Future)

- **Branch:** `beta`
- **Version format:** `5.0.0-beta.N`
- **npm dist-tag:** `@beta`
- **Purpose:** Feature-complete, stabilization phase

### Stable Releases (Future)

- **Branch:** `master`
- **Version format:** `5.0.0`, `5.1.0`, etc.
- **npm dist-tag:** `@latest` (default)
- **Purpose:** Production-ready releases

## Making an Alpha Release

### Prerequisites

1. Ensure all changes are merged to the `alpha` branch
2. Verify CI is passing on the `alpha` branch
3. You have appropriate permissions on the repository
4. `NPM_TOKEN` secret is configured in GitHub repository settings

### Steps

1. **Navigate to GitHub Actions**
   - Go to the repository on GitHub
   - Click **Actions** tab
   - Select **"Release (Alpha)"** workflow from the left sidebar

2. **Trigger the workflow**
   - Click **"Run workflow"** button (top right)
   - Ensure `alpha` branch is selected
   - Choose version bump type:
     - **`prerelease`** (most common): Bumps `5.0.0-alpha.4` → `5.0.0-alpha.5`
     - **`preminor`**: Bumps `5.0.0-alpha.4` → `5.1.0-alpha.0` (new minor features)
     - **`premajor`**: Bumps `5.0.0-alpha.4` → `6.0.0-alpha.0` (major breaking changes)
   - Click **"Run workflow"**

3. **Monitor the release**
   - The workflow will appear in the Actions list
   - Click to view real-time logs
   - Workflow performs:
     - Runs `bun run lint`
     - Runs `bun run build`
     - Runs `bun test`
     - Versions packages (Lerna independent versioning)
     - Publishes to npm with `@alpha` dist-tag
     - Creates GitHub release

4. **Verify the release**
   - Check the [Releases page](https://github.com/sockethub/sockethub/releases) for new release
   - Verify packages on npm: `npm view sockethub@alpha`
   - Test installation: `bun install sockethub@alpha`

### What Happens During Release

The automated workflow:

1. ✅ **Checkout** the `alpha` branch
2. ✅ **Validate** NPM token (fails fast if expired)
3. ✅ **Install** dependencies with `bun install --frozen-lockfile`
4. ✅ **Lint** code with Biome
5. ✅ **Build** all packages
6. ✅ **Test** with unit tests
7. ✅ **Version** packages using Lerna with conventional commits
8. ✅ **Publish** to npm registry with `@alpha` dist-tag
9. ✅ **Create** GitHub release with changelog
10. ✅ **Commit** version bumps with `[skip ci]` tag

### Versioning Strategy

Sockethub uses **independent versioning** - each package maintains its own version number:

```
packages/sockethub: 5.0.0-alpha.4
packages/client: 5.0.0-alpha.4
packages/server: 5.0.0-alpha.4
packages/platform-irc: 4.0.0-alpha.4
packages/schemas: 3.0.0-alpha.4
...etc
```

Lerna determines which packages changed and only bumps those versions.

## Branch Strategy

```
master (protected)
└── stable releases (future: 5.0.0, 5.1.0)

alpha (protected)
└── alpha releases (current: 5.0.0-alpha.x)
    ├── feature/your-feature-branch
    └── fix/your-bugfix-branch
```

### Development Workflow

1. Create feature branch from `alpha`
2. Make changes and commit
3. Open PR targeting `alpha` branch
4. Merge PR after CI passes and review approval
5. Trigger alpha release when ready

## NPM Dist-Tags

Dist-tags allow users to install specific release channels:

| Tag      | Version Example   | Install Command               | Purpose                    |
|----------|-------------------|-------------------------------|----------------------------|
| `alpha`  | `5.0.0-alpha.5`   | `bun install sockethub@alpha` | Unstable, latest features  |
| `beta`   | `5.0.0-beta.1`    | `bun install sockethub@beta`  | Feature-complete, testing  |
| `latest` | `5.0.0`           | `bun install sockethub`       | Production stable (default)|

## Troubleshooting

### Release workflow fails on lint/test

- CI must pass before release
- Fix issues locally and push to `alpha` branch
- Re-run the workflow

### "Branch not allowed" error

- Release workflows are restricted to specific branches
- Alpha releases only work on `alpha` branch
- Ensure you're triggering from the correct branch

### NPM authentication failure

- Verify `NPM_TOKEN` secret is set in repository settings
- Token must have publish permissions
- Token must not be expired (check expiration date)
- **Token expires in 90 days** - set a calendar reminder to renew
- The workflow validates the token before running tests to save time
- If validation fails, generate a new token at npmjs.com → Access Tokens

### Packages not published

- Check Lerna output in workflow logs
- Verify packages have changes since last release
- Ensure `private: false` in package.json

## Required Secrets

The following secrets must be configured in GitHub repository settings:

| Secret      | Purpose                          | How to obtain              | Expiration |
|-------------|----------------------------------|----------------------------|------------|
| `NPM_TOKEN` | Publish packages to npm registry | npmjs.com → Access Tokens  | 90 days    |

**Setting the secret:**

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Name: `NPM_TOKEN`
4. Value: Your npm token (Publish or Automation type)
5. Click **"Add secret"**

**Token renewal reminder:**

- npm tokens expire every 90 days
- **Set a calendar reminder** for 80 days from now
- The release workflow validates the token before running tests
- If expired, generate a new token and update the GitHub secret

## Future Enhancements

- Automated changelog generation from conventional commits
- Beta release workflow for `beta` branch
- Stable release workflow for `master` branch
- Automated canary releases from feature branches
- Release notifications (Slack/Discord)
- Docker image publishing on releases
