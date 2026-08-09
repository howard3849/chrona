# Agent Operating Rules

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
