# GitHub Release Labels

This document describes the labels used for categorizing PRs in GitHub release notes.

## Required Labels

These labels are automatically applied to PRs based on their conventional commit title prefix (see `.github/workflows/auto-label-pr.yml`).

| Label | Description | Color | Used For |
|-------|-------------|-------|----------|
| `feat` | New feature | `#a2eeef` | Features section |
| `enhancement` | Enhancement to existing feature | `#a2eeef` | Features section |
| `fix` | Bug fix | `#d73a4a` | Bug Fixes section |
| `bug` | Bug report/fix | `#d73a4a` | Bug Fixes section |
| `docs` | Documentation changes | `#0075ca` | Documentation section |
| `documentation` | Documentation changes | `#0075ca` | Documentation section |
| `test` | Test additions/changes | `#bfe5bf` | Tests section |
| `tests` | Test additions/changes | `#bfe5bf` | Tests section |
| `perf` | Performance improvements | `#fbca04` | Performance section |
| `performance` | Performance improvements | `#fbca04` | Performance section |
| `refactor` | Code refactoring | `#c5def5` | Refactoring section |
| `refactoring` | Code refactoring | `#c5def5` | Refactoring section |
| `ci` | CI/CD changes | `#d4c5f9` | Build & CI section |
| `build` | Build system changes | `#d4c5f9` | Build & CI section |
| `chore` | Maintenance tasks | `#fef2c0` | Maintenance section |
| `dependencies` | Dependency updates | `#fef2c0` | Maintenance section |
| `deps` | Dependency updates | `#fef2c0` | Maintenance section |
| `security` | Security fixes | `#ee0701` | Security section |
| `breaking-change` | Breaking changes | `#b60205` | Breaking Changes section |
| `breaking` | Breaking changes | `#b60205` | Breaking Changes section |

## Excluded Labels

PRs with these labels are excluded from release notes:

- `ignore-for-release` - Explicitly excluded from release notes
- `duplicate` - Duplicate PRs
- `question` - Questions, not changes
- `invalid` - Invalid PRs
- `wontfix` - Won't be fixed

## Creating Labels

To create these labels in your repository, run:

```bash
# Ensure these labels exist (this is safe to run multiple times)
gh label create feat --color a2eeef --description "New feature" --force
gh label create enhancement --color a2eeef --description "Enhancement to existing feature" --force
gh label create fix --color d73a4a --description "Bug fix" --force
gh label create bug --color d73a4a --description "Bug report/fix" --force
gh label create docs --color 0075ca --description "Documentation changes" --force
gh label create documentation --color 0075ca --description "Documentation changes" --force
gh label create test --color bfe5bf --description "Test additions/changes" --force
gh label create tests --color bfe5bf --description "Test additions/changes" --force
gh label create perf --color fbca04 --description "Performance improvements" --force
gh label create performance --color fbca04 --description "Performance improvements" --force
gh label create refactor --color c5def5 --description "Code refactoring" --force
gh label create refactoring --color c5def5 --description "Code refactoring" --force
gh label create ci --color d4c5f9 --description "CI/CD changes" --force
gh label create build --color d4c5f9 --description "Build system changes" --force
gh label create chore --color fef2c0 --description "Maintenance tasks" --force
gh label create dependencies --color fef2c0 --description "Dependency updates" --force
gh label create deps --color fef2c0 --description "Dependency updates" --force
gh label create security --color ee0701 --description "Security fixes" --force
gh label create breaking-change --color b60205 --description "Breaking changes" --force
gh label create breaking --color b60205 --description "Breaking changes" --force
gh label create ignore-for-release --color ededed --description "Exclude from release notes" --force
```

## How It Works

1. When a PR is opened/updated, the `auto-label-pr` workflow runs
2. It reads the PR title and extracts the conventional commit prefix
3. It applies the appropriate labels automatically
4. When creating release notes, GitHub uses `.github/release.yml` to categorize PRs by label
5. PRs appear in sections with emojis, contributor credits, and PR links

## Manual Labeling

You can also manually add labels to PRs:

- Add `breaking-change` for breaking changes
- Add `security` for security fixes
- Add `ignore-for-release` to exclude from release notes
- Remove auto-applied labels if they're incorrect
