# Chrona

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

**v2.9.1**

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
