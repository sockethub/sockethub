#!/usr/bin/env bash
#
# Validate package configurations before publishing
# Usage: ./scripts/validate-packages.sh [--dry-run]
#
# Checks:
#   - All @sockethub/* packages have publishConfig.access: "public"
#   - All workspace dependencies use valid specifiers
#   - Lerna can see all packages
#
# With --dry-run:
#   - Also runs bunx lerna publish --dry-run to catch npm-specific issues
#

set -e

DRY_RUN=false
ERRORS=false
WARNINGS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "🔍 Validating package configurations..."
echo ""

# Find all packages
PACKAGES=$(find packages -maxdepth 2 -name "package.json" -not -path "*/node_modules/*")

# ============================================================
# Check 1: publishConfig on scoped packages
# ============================================================
echo "### Checking publishConfig ###"
echo ""

for pkg_json in $PACKAGES; do
  PKG_NAME=$(node -p "require('./$pkg_json').name")
  PKG_PRIVATE=$(node -p "require('./$pkg_json').private || false")

  if [ "$PKG_PRIVATE" = "true" ]; then
    echo "⏭️  $PKG_NAME - private (skipped)"
    continue
  fi

  # Check for publishConfig on scoped packages
  if [[ "$PKG_NAME" == @* ]]; then
    HAS_PUBLISH_CONFIG=$(node -p "require('./$pkg_json').publishConfig?.access === 'public'" 2>/dev/null || echo "false")
    if [ "$HAS_PUBLISH_CONFIG" != "true" ]; then
      echo "❌ $PKG_NAME - missing publishConfig.access: 'public'"
      ERRORS=true
    else
      echo "✅ $PKG_NAME"
    fi
  else
    echo "✅ $PKG_NAME (unscoped)"
  fi
done

echo ""

# ============================================================
# Check 2: Workspace dependency specifiers
# ============================================================
echo "### Checking workspace dependencies ###"
echo ""

for pkg_json in $PACKAGES; do
  PKG_NAME=$(node -p "require('./$pkg_json').name")

  # Check all dependency types for workspace: specifiers
  for dep_type in dependencies devDependencies peerDependencies optionalDependencies; do
    DEPS=$(node -p "Object.entries(require('./$pkg_json').$dep_type || {}).filter(([k,v]) => v.startsWith('workspace:')).map(([k,v]) => k + '@' + v).join(' ')" 2>/dev/null || echo "")

    if [ -n "$DEPS" ]; then
      for dep in $DEPS; do
        DEP_NAME=$(echo "$dep" | cut -d'@' -f1-2 | sed 's/@$//')
        DEP_SPEC=$(echo "$dep" | rev | cut -d'@' -f1 | rev)

        # workspace:* and workspace:^ are valid, as are workspace:X.Y.Z
        if [[ "$DEP_SPEC" != "workspace:*" && "$DEP_SPEC" != "workspace:^" && ! "$DEP_SPEC" =~ ^workspace:[0-9]+ ]]; then
          echo "⚠️  $PKG_NAME has unusual workspace specifier: $DEP_NAME@$DEP_SPEC"
          WARNINGS=true
        fi
      done
    fi
  done
done

echo "✅ Workspace dependencies checked"
echo ""

# ============================================================
# Check 3: Count packages found
# ============================================================
echo "### Package count ###"
echo ""

PKG_COUNT=$(echo "$PACKAGES" | wc -l | tr -d '[:space:]')
echo "✅ Found $PKG_COUNT packages"

echo ""

# ============================================================
# Check 4: Dry-run publish (optional)
# ============================================================
if [ "$DRY_RUN" = "true" ]; then
  echo "### Running publish dry-run ###"
  echo ""

  # Note: --ignore-scripts skips the root 'publish' lifecycle script
  # This is intentional - we've already validated formatting/linting/tests
  # in the workflow before this validation runs
  if bunx lerna publish from-package --yes --no-git-tag-version --no-push --dry-run --ignore-scripts 2>&1; then
    echo ""
    echo "✅ Dry-run completed successfully"
  else
    echo ""
    echo "❌ Dry-run failed"
    ERRORS=true
  fi
  echo ""
fi

# ============================================================
# Summary
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$ERRORS" = "true" ]; then
  echo "❌ Validation failed - fix errors above before publishing"
  exit 1
elif [ "$WARNINGS" = "true" ]; then
  echo "⚠️  Validation passed with warnings"
  exit 0
else
  echo "✅ All validations passed"
  exit 0
fi
