#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: Python 3 is required to rebuild Chrona sample data."
  exit 1
fi

exec python3 "$SCRIPT_DIR/build-sample-data.py" \
  "$REPO_DIR/sample-timeline.xlsx" \
  "$REPO_DIR/sample-data.js"
