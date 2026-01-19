# Release PR CI Workflows

## Problem

When release PRs are created automatically by the `release-prepare.yml` workflow, normal CI workflows (Integration, Compliance) don't run automatically.

### Root Cause

GitHub has a security restriction that prevents workflows triggered by `GITHUB_TOKEN` from starting additional workflow runs. This prevents recursive/cascading workflow executions.

From [GitHub's documentation](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#using-the-github_token-in-a-workflow):

> When you use the repository's GITHUB_TOKEN to perform tasks, events triggered by the GITHUB_TOKEN will not create a new workflow run.

When the `release-prepare.yml` workflow creates a PR using `gh pr create` with `GITHUB_TOKEN`, the resulting `pull_request` event is considered to be created by the token, so other workflows don't trigger.

### Why Some Workflows Run

Workflows like `auto-label-pr.yml` and `validate-branch.yml` do run because they might use different trigger conditions or have exceptions in GitHub's filtering logic. However, the main CI workflows (`integration.yml`, `compliance.yml`) are blocked.

## Solution

Use a Personal Access Token (PAT) instead of `GITHUB_TOKEN` when creating release PRs.

### Setup Instructions

1. **Create a Personal Access Token**
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Give it a descriptive name: "Sockethub Release Workflow"
   - Select scope: `repo` (Full control of private repositories)
   - Set expiration as desired (recommend 1 year with calendar reminder)
   - Click "Generate token" and copy the token

2. **Add Token as Repository Secret**
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `GH_PAT`
   - Value: Paste the token you copied
   - Click "Add secret"

3. **Workflow Already Updated**
   The `release-prepare.yml` workflow has been updated to:
   - Use `GH_PAT` if available, fallback to `GITHUB_TOKEN` if not
   - Emit a warning if `GH_PAT` is not configured
   - Document the requirement at the top of the file

### Verification

After adding the `GH_PAT` secret:

1. Create a new release using the "Prepare Release" workflow
2. Check the workflow run logs for: `✓ GH_PAT configured - CI workflows will trigger automatically`
3. Verify that the created PR shows CI workflow runs for:
   - Integration
   - Compliance (lint, build, test)

### Manual Workaround (if PAT not configured)

If you don't want to set up a PAT, you can manually trigger CI on release PRs:

1. Make a trivial change to the PR (edit PR description, add a comment)
2. Push an empty commit: `git commit --allow-empty -m "trigger ci" && git push`
3. Close and reopen the PR (will trigger workflows)

However, using a PAT is the recommended long-term solution.

## Alternative: GitHub App

For organizations, a GitHub App token can be used instead of a PAT:
- More secure (scoped to specific repositories)
- Doesn't depend on a single user's account
- Can be revoked/rotated without user intervention

This requires more setup and is typically used in larger organizations.

## References

- [GitHub Actions Token Authentication](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- [Triggering workflows from workflows](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow#triggering-a-workflow-from-a-workflow)
