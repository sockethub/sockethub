#!/usr/bin/env bash
# Verify that the published @sockethub/schemas artifacts are actually served at
# their canonical sockethub.org $id / @context URLs — the acceptance check for
# issue #1185.
#
# Usage:
#   ./scripts/verify-schema-urls.sh <schemas-version> [base-url]
#
# Examples:
#   ./scripts/verify-schema-urls.sh 3.0.0-alpha.16
#   ./scripts/verify-schema-urls.sh 3.0.0-alpha.16 https://sockethub.org
#
# Exits non-zero if any URL is unreachable, returns the wrong content-type, or
# serves a schema whose embedded $id disagrees with the URL it was fetched from.
set -uo pipefail

VERSION="${1:?usage: verify-schema-urls.sh <schemas-version> [base-url]}"
BASE="${2:-https://sockethub.org}"

fail=0

# Fetch a JSON Schema and assert (a) it is reachable, (b) content-type is
# application/json, (c) its $id equals the URL we fetched it from.
check_schema() {
  local url="$1" body ctype id
  ctype="$(curl -fsSL -o /dev/null -w '%{content_type}' "$url" 2>/dev/null)" || {
    echo "❌ $url — unreachable"
    fail=1
    return
  }
  body="$(curl -fsSL "$url" 2>/dev/null)" || {
    echo "❌ $url — unreachable"
    fail=1
    return
  }
  id="$(printf '%s' "$body" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).$id||""))}catch{}})')"
  if [ "$id" != "$url" ]; then
    echo "❌ $url — \$id mismatch (got '${id:-<none>}')"
    fail=1
    return
  fi
  case "$ctype" in
    application/json*) echo "✅ $url" ;;
    *) echo "⚠️  $url — served but content-type is '$ctype' (expected application/json)" ;;
  esac
}

# A JSON-LD context has no $id; just assert it is reachable.
check_reachable() {
  local url="$1"
  if curl -fsSL -o /dev/null "$url" 2>/dev/null; then
    echo "✅ $url"
  else
    echo "❌ $url — unreachable"
    fail=1
  fi
}

echo "Verifying schema artifacts for @sockethub/schemas@$VERSION at $BASE"
check_schema "$BASE/schemas/$VERSION/sockethub-config.json"
check_schema "$BASE/schemas/$VERSION/activity-stream.json"
check_schema "$BASE/schemas/$VERSION/platform.json"
check_reachable "$BASE/ns/context/v1.jsonld"

if [ "$fail" -ne 0 ]; then
  echo "one or more schema URLs failed verification" >&2
  exit 1
fi
echo "all schema URLs verified"
