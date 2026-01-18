#!/usr/bin/env bash
#
# Verify that all packages are published to npm at their current versions
# Usage: ./scripts/verify-npm-publish.sh [--version X.Y.Z]
#
# If --version is provided, checks for that specific version
# Otherwise, checks for each package's version from its package.json
#

set -e

VERSION=""
FAILED=false
PUBLISHED=0
NOT_PUBLISHED=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --version)
      VERSION="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "🔍 Verifying npm package publication status..."
echo ""

# Find all packages
PACKAGES=$(find packages -maxdepth 2 -name "package.json" -not -path "*/node_modules/*")

for pkg_json in $PACKAGES; do
  PKG_DIR=$(dirname "$pkg_json")
  PKG_NAME=$(node -p "require('./$pkg_json').name")
  PKG_PRIVATE=$(node -p "require('./$pkg_json').private || false")

  # Skip private packages
  if [ "$PKG_PRIVATE" = "true" ]; then
    echo "⏭️  $PKG_NAME - private (skipped)"
    continue
  fi

  # Determine version to check
  if [ -n "$VERSION" ]; then
    CHECK_VERSION="$VERSION"
  else
    CHECK_VERSION=$(node -p "require('./$pkg_json').version")
  fi

  # Check npm registry
  NPM_VERSION=$(npm view "$PKG_NAME@$CHECK_VERSION" version 2>/dev/null || echo "")

  if [ -n "$NPM_VERSION" ]; then
    echo "✅ $PKG_NAME@$CHECK_VERSION - published"
    ((PUBLISHED++))
  else
    echo "❌ $PKG_NAME@$CHECK_VERSION - NOT published"
    ((NOT_PUBLISHED++))
    FAILED=true
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary: $PUBLISHED published, $NOT_PUBLISHED not published"

if [ "$FAILED" = true ]; then
  echo ""
  echo "⚠️  Some packages are not published!"
  exit 1
else
  echo ""
  echo "✅ All packages verified on npm"
  exit 0
fi
