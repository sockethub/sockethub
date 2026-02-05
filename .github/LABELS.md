# GitHub Release Labels

This document describes the labels used for categorizing PRs in GitHub release notes.

## Label Strategy

Labels follow a structured naming convention:

- **Type labels**: `type:*` - The type of change (feat, fix, docs, etc.)
- **Scope labels**: `scope:*` - The package/area affected (platform-irc, data-layer, etc.)
- **Special labels**: `breaking-change` - Breaking changes

## Auto-Labeling

PRs are automatically labeled based on their conventional commit title (see `.github/workflows/auto-label-pr.yml`).

### Examples

| PR Title | Labels Applied |
|----------|----------------|
| `feat: add new feature` | `type:feat` |
| `fix(platform-irc): connection timeout` | `type:fix`, `scope:platform-irc` |
| `docs(platform-xmpp): update readme` | `type:docs`, `scope:platform-xmpp` |
| `perf(data-layer): optimize redis` | `type:perf`, `scope:data-layer` |
| `feat(platform-metadata)!: breaking api` | `type:feat`, `scope:platform-metadata`, `breaking-change` |
| `chore(deps): update typescript` | `type:chore`, `scope:deps` |

### Pattern

```
<type>(<scope>)[!]: <description>

type  → type:<type> label
scope → scope:<scope> label (must exist as a label)
!     → breaking-change label (any type with ! is breaking)
```

## Type Labels

| Label | Description | Color | Used For |
|-------|-------------|-------|----------|
| `type:feat` | New feature | `#a3f8fd` | Features section |
| `type:fix` | Bug fix | `#d73a4a` | Bug Fixes section |
| `type:docs` | Documentation changes | `#2d5997` | Documentation section |
| `type:test` | Test additions/changes | `#bfe5bf` | Tests section |
| `type:perf` | Performance improvements | `#fbca04` | Performance section |
| `type:refactor` | Code refactoring | `#c5def5` | Refactoring section |
| `type:ci` | CI/CD changes | `#d4c5f9` | Build & CI section |
| `type:build` | Build system changes | `#d4c5f9` | Build & CI section |
| `type:chore` | Maintenance tasks | `#fef2c0` | Maintenance section |
| `type:deps` | Dependency updates | `#fef2c0` | Maintenance section |

## Scope Labels

| Label | Description | Color |
|-------|-------------|-------|
| `scope:platform-irc` | Issues related to the IRC platform | `#000000` |
| `scope:platform-xmpp` | Issues related to the XMPP platform | `#000000` |
| `scope:platform-feeds` | Issues related to the Feeds platform | `#000000` |
| `scope:platform-metadata` | Issues related to the Metadata platform | `#000000` |
| `scope:platform-dummy` | Issues related to the Dummy platform | `#000000` |
| `scope:server` | Server implementation changes | `#000000` |
| `scope:data-layer` | Data layer changes | `#000000` |
| `scope:client` | Issues related to Sockethub Client package | `#000000` |
| `scope:schemas` | Schema and validation changes | `#000000` |
| `scope:logger` | Logger package changes | `#000000` |
| `scope:activity-streams` | Issues related to ActivityStreams.js | `#000000` |
| `scope:crypto` | Cryptographic utilities | `#000000` |
| `scope:irc2as` | Issues related to IRC2AS | `#000000` |
| `scope:examples` | Example Demo App | `#000000` |
| `scope:sockethub` | Main Sockethub package | `#000000` |

## Special Labels

| Label | Description | Color |
|-------|-------------|-------|
| `breaking-change` | Breaking changes | `#b60205` |

## Excluded Labels

PRs with these labels are excluded from release notes:

- `ignore-for-release` - Explicitly excluded from release notes
- `duplicate` - Duplicate PRs
- `question` - Questions, not changes
- `invalid` - Invalid PRs
- `wontfix` - Won't be fixed

## Scope Validation

The auto-label workflow validates that scope labels exist. If you use a scope that doesn't have a corresponding `scope:*` label, the workflow will fail with an error message.

**Valid scopes**: `platform-irc`, `platform-xmpp`, `platform-feeds`, `platform-metadata`, `platform-dummy`, `server`, `data-layer`, `client`, `schemas`, `logger`, `activity-streams`, `crypto`, `irc2as`, `examples`, `sockethub`

**Invalid example**: `feat(ircstypo): ...` → ❌ Fails because `scope:ircstypo` doesn't exist

## How It Works

1. When a PR is opened/updated, the `auto-label-pr` workflow runs
2. It reads the PR title and parses the conventional commit pattern
3. It applies `type:*` label based on the type
4. If a scope is present, it validates the `scope:*` label exists and applies it
5. If `!` is present, it applies the `breaking-change` label
6. When creating release notes, GitHub uses `.github/release.yml` to categorize PRs by label

## Manual Labeling

You can also manually add/remove labels:

- Add additional `scope:*` labels if PR affects multiple areas
- Add `breaking-change` for breaking changes not marked with `!`
- Add `ignore-for-release` to exclude from release notes
- Remove auto-applied labels if they're incorrect
