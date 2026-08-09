from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.rstrip() + "\n", encoding="utf-8")


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)

version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()

# Keep one canonical downloadable starter workbook at the repository root.
old_workbook = ROOT / "chrona-sample-timeline.xlsx"
new_workbook = ROOT / "sample-timeline.xlsx"
if old_workbook.exists() and not new_workbook.exists():
    old_workbook.rename(new_workbook)
old_dev_workbook = ROOT / "dev" / "chrona-sample-timeline.xlsx"
if old_dev_workbook.exists():
    old_dev_workbook.unlink()

# Update every runtime/reference mention of the renamed workbook.
for rel in ["index.html", "sample-data.js"]:
    path = ROOT / rel
    text = path.read_text(encoding="utf-8")
    text = text.replace("chrona-sample-timeline.xlsx", "sample-timeline.xlsx")
    path.write_text(text, encoding="utf-8")

# Consolidate the complete README release history into one changelog before
# replacing README with a concise front-facing project guide.
readme_path = ROOT / "README.md"
old_readme = readme_path.read_text(encoding="utf-8")
history_match = re.search(r"## Version history\n\n(?P<history>.*?)(?=\n## Project structure\n)", old_readme, re.S)
if not history_match:
    raise SystemExit("README version history could not be located")
history = history_match.group("history").strip()
history = re.sub(r"^### ", "## ", history, flags=re.M)

changelog = f"""# Chrona Changelog

This file is the single source of truth for Chrona release history. Historical per-release Markdown files were consolidated here during the repository cleanup after v{version}.

{history}
"""
write("docs/CHANGELOG.md", changelog)

readme = f"""# Chrona

Chrona is an interactive timeline explorer for viewing historical, organizational, and personal events across multiple groups on one responsive timeline. It supports point events, multi-year events, long reference periods, group filtering, desktop/iPad/iPhone layouts, multilingual content, a chronological list, group-lane and compact mixed-group views, and a radar navigator for moving through large spans of time.

Chrona runs entirely in the browser. GitHub is used for source control and Cloudflare Pages is the deployment platform. Timeline data can come from the bundled public sample or from a shared Google Sheet.

## What you need

To use your own data, start with the included `sample-timeline.xlsx` workbook, upload or open it in Google Sheets, edit the timeline, share it, and provide Chrona with the Google Sheet URL in Settings.

The workbook uses:

- `Timeline Data` — required timeline rows.
- `Config` — optional settings for baseline language, available languages, primary groups, group colors, and protected phrases that should never be translated.

`Timeline Data` is based on the TimelineJS spreadsheet format and extends it with Chrona-specific fields such as `Importance`, `Visible`, `Event ID`, optional color controls, and language columns such as `Title [zh-TW]` and `Description [zh-TW]`.

Chrona recognizes standard TimelineJS fields and treats a blank `Type` as an ordinary event. Chrona additionally uses `period` for a period block and `title` for the dataset title row. `Importance` supports `Major`, `Normal`, and `Minor`; blank values are treated as `Normal` and legacy `Medium` values are normalized to `Normal`.

## Quick start

1. Open the Cloudflare Pages deployment of Chrona.
2. Use the bundled sample timeline immediately, or open **Settings**.
3. Paste a shareable Google Sheet URL.
4. Click **Reload** to load the private timeline.
5. Leave the URL blank and click **Reload** to return to the bundled sample. With a private Sheet loaded, **Include sample timeline** can overlay the public sample as a second layer.

Chrona also includes an export link that downloads the current private timeline, translations, and Config data as a Google Sheet-compatible workbook.

## Bundled sample data

Chrona intentionally keeps the sample in two synchronized forms:

- `sample-data.js` — browser-ready runtime data used on first launch and whenever no private Google Sheet is active.
- `sample-timeline.xlsx` — the human-editable starter workbook users can download and copy into Google Sheets.

Both represent the same `Timeline Data` and `Config` model. When the bundled sample changes, keep these two files aligned.

## Language support

Set `language_baseline` and `language_available` in the `Config` sheet using standard BCP 47 language tags, for example:

```text
language_baseline    en-US
language_available   en-US,zh-TW,fr,es
```

Human translation columns take priority. When a translated cell is missing, Chrona may translate baseline text on the fly when the browser supports that language pair. Entries under `never_translate.*` remain unchanged.

## Current version

**v{version}**

See [`docs/CHANGELOG.md`](docs/CHANGELOG.md) for the complete release history.

## Project structure

- `index.html` — application shell and Settings UI.
- `timeline.js` — current authoritative application behavior entry point.
- `styles.css` and `css/` — global and component styling.
- `sample-data.js` — browser-ready bundled public sample data.
- `sample-timeline.xlsx` — downloadable/editable starter workbook.
- `VERSION` and `version.js` — synchronized application version.
- `js/` — extracted component modules retained for a dedicated future modularization pass; they are not currently loaded by `index.html`.
- `docs/CHANGELOG.md` — release history.
- `docs/DEPLOYMENT.md` — Cloudflare deployment details.
- `dev/` — local development helpers/notes; excluded from release ZIPs.
- `tools/` — repository maintenance and release tooling.
"""
write("README.md", readme)

agents = """# Agent Operating Rules

## Source control and hosting
- GitHub is source control only for this project. Do not use GitHub Pages.
- Cloudflare Pages is the deployment platform.
- `main` is the stable production/public branch.
- `dev` is the active development branch.
- Normal implementation happens on `dev`; keep `main` frozen during development unless Howard explicitly instructs otherwise.

## Development cycle
1. Begin a cycle with `dev` aligned to the current approved `main` state.
2. Implement and iterate on `dev` in substantial related batches.
3. Push `dev` regularly so the Cloudflare development/preview deployment stays current.
4. Keep `main` unchanged while development is in progress.
5. When Howard declares `dev` stable/release-ready, promote the approved `dev` state so `main` matches it exactly.
6. Push/update `main`; Cloudflare production should deploy from `main`.
7. Continue the next development cycle on `dev`.

## Release semantics
- `dev` is the authoritative candidate for the next release.
- `main` is the publication slot for the last approved stable release.
- There is normally nothing unique on `main` that should override approved `dev` work.
- Do not publish unfinished work to `main` without explicit release approval.

## Deployment
- Production and development URLs must coexist.
- Production must represent `main`; development/preview must represent the latest `dev` deployment.
- Never point the production URL at `dev`.
- Record confirmed Cloudflare project/URL details in `docs/DEPLOYMENT.md`; do not guess them.

## Code organization
- `timeline.js` is currently the authoritative application behavior entry point.
- Keep component CSS in its designated files under `css/` when one exists; avoid appending duplicate override blocks when an existing component rule can be updated.
- `js/phone-period.js`, `js/search-ui.js`, and `js/year-ruler.js` are extracted modules from an earlier refactor but are not currently loaded by `index.html`.
- Do not delete, reconnect, or duplicate those `js/` modules casually. Reconnecting them belongs in a dedicated refactor with desktop/iPad/iPhone regression testing, especially the SVG-based vertical phone period renderer.
- Prefer one implementation per behavior. If modularization resumes, move ownership cleanly instead of keeping a copy both in `timeline.js` and a module.

## Sample data
- `sample-data.js` is the browser-ready bundled fallback/public sample used at runtime.
- `sample-timeline.xlsx` is the downloadable/editable starter workbook.
- Keep the two sample representations aligned when sample content or Config changes.
- Do not place a second sample workbook under `dev/`.

## Versioning and release finalization
- `VERSION` is the human-readable version source; generated `version.js`, Settings display, and `?v=` cache-busting references must stay synchronized.
- Before finalizing a release, add the new version entry to `docs/CHANGELOG.md`, newest first.
- Run `tools/finalize-release.command` at the end of a release-finalization session. It updates synchronized version references, validates JavaScript when Node is available, verifies the changelog entry, and builds the repo-safe update ZIP.
- Do not manually hard-code a competing version inside `timeline.js`; runtime versioning comes from `version.js`.

## Documentation authority
- `README.md` is the concise public/project introduction and usage guide.
- `AGENTS.md` defines coding-agent workflow and architecture rules.
- `docs/CHANGELOG.md` is the single release-history source of truth.
- `docs/DEPLOYMENT.md` contains project-specific Cloudflare deployment details.
- If older text mentions GitHub Pages or per-release `docs/RELEASE-vX.Y.Z.md` files, treat it as obsolete and update it when touched.
"""
write("AGENTS.md", agents)

finalizer = r'''#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

VERSION_FILE="$REPO_DIR/VERSION"
INDEX_FILE="$REPO_DIR/index.html"
VERSION_JS="$REPO_DIR/version.js"
README_FILE="$REPO_DIR/README.md"
CHANGELOG_FILE="$REPO_DIR/docs/CHANGELOG.md"

if [[ ! -f "$VERSION_FILE" || ! -f "$INDEX_FILE" || ! -f "$REPO_DIR/timeline.js" || ! -f "$README_FILE" || ! -f "$CHANGELOG_FILE" ]]; then
  echo "ERROR: Run this tool from a complete Chrona project."
  exit 1
fi

current="$(tr -d '[:space:]' < "$VERSION_FILE")"
requested="${1:-}"

if [[ -n "$requested" ]]; then
  next="$requested"
else
  if [[ ! "$current" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "ERROR: VERSION must use MAJOR.MINOR.PATCH format. Found: $current"
    exit 1
  fi
  next="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.$(( BASH_REMATCH[3] + 1 ))"
fi

if [[ ! "$next" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: Version must use MAJOR.MINOR.PATCH format, such as 2.8.9."
  exit 1
fi

printf '%s\n' "$next" > "$VERSION_FILE"
cat > "$VERSION_JS" <<VERSIONEOF
/* Generated by tools/finalize-release.command. Do not edit by hand. */
window.CHRONA_VERSION = '$next';
VERSIONEOF

# Synchronize the visible Settings version and every cache-busting asset version.
perl -0pi -e "s/(id=['\"]appVersion['\"][^>]*>\s*)v?[^<]+/\${1}v$next/g; s/\?v=[A-Za-z0-9._-]+/?v=$next/g" "$INDEX_FILE"

# Validate JavaScript syntax when Node is available.
if command -v node >/dev/null 2>&1; then
  while IFS= read -r file; do
    node --check "$file" >/dev/null
  done < <(find . -type f -name '*.js' ! -path './.git/*' ! -path './release/*' | sort)
fi

errors=0
if ! grep -Fq "window.CHRONA_VERSION = '$next';" "$VERSION_JS"; then
  echo "ERROR: version.js does not match VERSION."
  errors=1
fi

if grep -oE '\?v=[0-9]+\.[0-9]+\.[0-9]+' "$INDEX_FILE" | grep -vF "?v=$next" >/dev/null; then
  echo "ERROR: Conflicting cache versions remain in index.html:"
  grep -nE '\?v=[0-9]+\.[0-9]+\.[0-9]+' "$INDEX_FILE" | grep -vF "?v=$next" || true
  errors=1
fi

if ! grep -Fq "id=\"appVersion\">v$next<" "$INDEX_FILE"; then
  echo "ERROR: Settings version does not match VERSION."
  errors=1
fi

if ! grep -Eq "^## ${next//./\.}$" "$CHANGELOG_FILE"; then
  echo "ERROR: docs/CHANGELOG.md is missing a release entry for $next."
  errors=1
fi

if (( errors != 0 )); then
  exit 1
fi

release_dir="$REPO_DIR/release"
mkdir -p "$release_dir"
zip_path="$release_dir/chrona-v${next}-update.zip"
rm -f "$zip_path"

zip -qr "$zip_path" . \
  -x '.git/*' \
  -x 'release/*' \
  -x 'dev/*' \
  -x '*.zip' \
  -x '.DS_Store' \
  -x '__MACOSX/*' \
  -x '.chrona-server.pid' \
  -x '.chrona-server.port'

echo
echo "Chrona release finalized"
echo "Version: $next"
echo "Conflicting version references: none"
echo "Changelog entry: docs/CHANGELOG.md"
echo "Package: $zip_path"
'''
write("tools/finalize-release.command", finalizer)
(ROOT / "tools" / "finalize-release.command").chmod(0o755)

# Remove documentation superseded by the consolidated sources above.
docs = ROOT / "docs"
for path in docs.glob("RELEASE-v*.md"):
    path.unlink()
for name in ["CODER-FINALIZATION.md", "IMPLEMENTED-v2.1.5.md", "REFACTOR-NOTES.md", "SAMPLE-DATA.md"]:
    path = docs / name
    if path.exists():
        path.unlink()

# Remove this one-off cleanup mechanism from the final repository tree.
self_path = Path(__file__).resolve()
workflow = ROOT / ".github" / "workflows" / "repo-cleanup-once.yml"
if workflow.exists():
    workflow.unlink()
if self_path.exists():
    self_path.unlink()

run("git", "config", "user.name", "Howard")
run("git", "config", "user.email", "70864576+howard3849@users.noreply.github.com")
run("git", "add", "-A")

# Sanity checks before committing.
if not (ROOT / "sample-timeline.xlsx").exists():
    raise SystemExit("sample-timeline.xlsx missing after rename")
if (ROOT / "chrona-sample-timeline.xlsx").exists() or old_dev_workbook.exists():
    raise SystemExit("obsolete sample workbook still exists")
if list(docs.glob("RELEASE-v*.md")):
    raise SystemExit("per-release docs remain")
if "chrona-sample-timeline.xlsx" in (ROOT / "index.html").read_text(encoding="utf-8"):
    raise SystemExit("old workbook filename remains in index.html")
if "chrona-sample-timeline.xlsx" in (ROOT / "sample-data.js").read_text(encoding="utf-8"):
    raise SystemExit("old workbook filename remains in sample-data.js")

result = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT)
if result.returncode == 0:
    raise SystemExit("No repository cleanup changes to commit")

run("git", "commit", "-m", "Streamline Chrona repository documentation")
run("git", "push", "origin", "dev")
