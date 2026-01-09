# Commit Type Consolidation Analysis

## Current Problem

CONTRIBUTING.md defines 12 commit types including custom `infra` type:

- Standard: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Custom: `infra`

## Redundancy Analysis

### `infra` vs `ci`

Both cover CI/CD and automation:

- Current `infra` examples: "add automated release workflow", "configure docker compose"
- Standard `ci` examples: "add test coverage reporting"
- **Overlap: ~95%** - both are infrastructure/automation config

### `infra` vs `build`

Some gray area around build infrastructure:

- `build`: Build system, tooling, dependencies (webpack, package.json)
- `infra`: Infrastructure, deployment, CI/CD (GitHub Actions, Docker)
- **Overlap: ~30%** - Docker configs could be either

### `infra` vs `chore`

`chore` is the catch-all for maintenance:

- `chore`: Maintenance tasks, dependency updates
- `infra`: Infrastructure-specific maintenance
- **Overlap: ~20%** - adding `infra` fragments maintenance category

## Recommendation: Drop `infra`, Use `ci`

### Rationale

1. **Standards compliance**: `ci` is in Conventional Commits spec, `infra` is not
2. **Semantic clarity**: "CI" clearly means automation/infrastructure
3. **Reduced cognitive load**: One fewer type to remember/explain
4. **Industry standard**: Most projects use `ci` for this purpose

### Migration Guide

```bash
# Before (custom)
infra: add automated release workflow
infra: configure docker compose
infra: setup GitHub Actions cache

# After (standard)
ci: add automated release workflow
ci: configure docker compose
ci: setup GitHub Actions cache
```

### Edge Cases

| Change Type | Use This |
|------------|----------|
| GitHub Actions workflow | `ci` |
| Docker configs | `ci` |
| Terraform/infrastructure-as-code | `ci` |
| Build tool config (webpack, vite) | `build` |
| Dependency updates | `chore` |
| Deployment scripts | `ci` |

## Implementation Steps

1. **Update CONTRIBUTING.md**
   - Remove `infra` from types table
   - Add examples of `ci` usage for infrastructure changes
   - Update branch naming examples

2. **Update validation workflows**
   - Remove `infra` from branch name validation
   - Ensure `ci` is accepted

3. **Update memory files**
   - Remove `infra` from CLAUDE.md quick reference
   - Update Copilot instructions if needed

4. **Historical commits**
   - No need to rewrite history
   - Going forward, use `ci` instead

## Benefits

- ✅ Standards-compliant (Conventional Commits spec)
- ✅ Less documentation needed
- ✅ Clearer semantic meaning
- ✅ Easier for new contributors (standard types)
- ✅ Better tooling support (commitlint presets support `ci`)

## Risks

- ⚠️ Minimal: Only 2 `infra` commits in recent history
- ⚠️ Team needs one-time education about the change
- ✅ No breaking changes (version bumps still work the same)
