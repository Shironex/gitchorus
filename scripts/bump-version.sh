#!/usr/bin/env bash
set -euo pipefail

# Bump version across all package.json files in the monorepo.
# Usage:
#   ./scripts/bump-version.sh <version>        # explicit version (e.g. 0.2.0)
#   ./scripts/bump-version.sh patch            # auto-increment patch (0.1.4 → 0.1.5)
#   ./scripts/bump-version.sh minor            # auto-increment minor (0.1.4 → 0.2.0)
#   ./scripts/bump-version.sh major            # auto-increment major (0.1.4 → 1.0.0)
#   ./scripts/bump-version.sh minor --beta     # beta pre-release (0.1.4 → 0.2.0-beta.1)
#   ./scripts/bump-version.sh patch --beta     # if 0.2.0-beta.1 exists → 0.2.0-beta.2

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

PACKAGES=(
  "$ROOT_DIR/package.json"
  "$ROOT_DIR/apps/desktop/package.json"
  "$ROOT_DIR/apps/web/package.json"
  "$ROOT_DIR/packages/shared/package.json"
)

# Parse --beta flag
BETA=false
BUMP_ARG=""
for arg in "$@"; do
  case "$arg" in
    --beta) BETA=true ;;
    *) BUMP_ARG="$arg" ;;
  esac
done

# Read current version from root package.json
CURRENT=$(FILE="$ROOT_DIR/package.json" node -p 'JSON.parse(require("fs").readFileSync(process.env.FILE, "utf8")).version')

if [ -z "$BUMP_ARG" ]; then
  echo "Usage: $0 <version|patch|minor|major> [--beta]"
  echo "Current version: $CURRENT"
  exit 1
fi

# Calculate target version
case "$BUMP_ARG" in
  patch|minor|major)
    BASE_VERSION="${CURRENT%%[-+]*}"
    IFS='.' read -r MAJOR MINOR PATCH <<< "$BASE_VERSION"
    case "$BUMP_ARG" in
      patch) PATCH=$((PATCH + 1)) ;;
      minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
      major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
    esac
    VERSION="$MAJOR.$MINOR.$PATCH"
    ;;
  *)
    VERSION="$BUMP_ARG"
    # Validate semver format (anchored to prevent injection)
    if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?([+][0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'; then
      echo "Error: '$VERSION' is not a valid semver version"
      exit 1
    fi
    ;;
esac

# Append beta pre-release suffix if --beta flag is set
if [ "$BETA" = true ]; then
  # Check for existing beta tags to determine the next beta number
  LATEST_BETA=$(git tag -l "v${VERSION}-beta.*" --sort=-v:refname | head -n 1 || true)
  if [ -n "$LATEST_BETA" ]; then
    # Extract beta number and increment
    BETA_NUM="${LATEST_BETA##*beta.}"
    BETA_NUM=$((BETA_NUM + 1))
  else
    BETA_NUM=1
  fi
  VERSION="${VERSION}-beta.${BETA_NUM}"
fi

echo "Bumping $CURRENT → $VERSION"
echo ""

for FILE in "${PACKAGES[@]}"; do
  REL_PATH="${FILE#"$ROOT_DIR/"}"
  if [ ! -f "$FILE" ]; then
    echo "Error: $REL_PATH not found" >&2
    exit 1
  fi
  VERSION="$VERSION" FILE="$FILE" node -e '
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync(process.env.FILE, "utf8"));
    pkg.version = process.env.VERSION;
    fs.writeFileSync(process.env.FILE, JSON.stringify(pkg, null, 2) + "\n");
  '
  echo "  Updated $REL_PATH"
done

echo ""
echo "All packages bumped to $VERSION"
