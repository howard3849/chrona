#!/bin/zsh
set -euo pipefail

REPO="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Projects/Chrona"
VERSION="${1:-2.1.17}"

if [[ ! -d "$REPO" ]]; then
  echo "Chrona repo not found:"
  echo "$REPO"
  exit 1
fi

cd "$REPO"

if [[ ! -f "index.html" || ! -f "timeline.js" ]]; then
  echo "This does not look like the Chrona repo root."
  exit 1
fi

echo "Updating Chrona version to v$VERSION"
echo "Repo: $REPO"
echo

# Keep a simple source-of-truth file for humans and future scripts.
printf '%s\n' "$VERSION" > VERSION

# Update APP_VERSION in timeline.js, accepting single or double quotes.
perl -0pi -e \
  "s/const\s+APP_VERSION\s*=\s*['\"][^'\"]+['\"]/const APP_VERSION = '$VERSION'/g" \
  timeline.js

# Update visible version text and every cache-busting ?v= reference in index.html.
perl -0pi -e \
  "s/(id=['\"]appVersion['\"][^>]*>\s*)v?[^<]+/\${1}v$VERSION/g; s/\?v=[A-Za-z0-9._-]+/?v=$VERSION/g" \
  index.html

# Update cache-busting references in any other HTML files.
find . -maxdepth 2 -type f -name '*.html' ! -path './.git/*' -print0 |
while IFS= read -r -d '' file; do
  perl -0pi -e "s/\?v=[A-Za-z0-9._-]+/?v=$VERSION/g" "$file"
done

echo "Verification"
echo "------------"
echo "VERSION file: $(cat VERSION)"
echo
grep -n "APP_VERSION" timeline.js || true
grep -nE "appVersion|\?v=" index.html || true
echo
echo "Git status"
echo "----------"
git status --short 2>/dev/null || echo "Warning: .git is missing."
echo
echo "Version update complete."
echo
echo "Review the changes, then run:"
echo "  git add -A"
echo "  git commit -m \"Set Chrona version to v$VERSION\""
echo "  git push origin main"
echo
read -n 1 -s -r -p "Press any key to close..."
echo
