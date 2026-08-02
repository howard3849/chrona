# Bundled sample timeline

Chrona's fallback timeline is maintained in two inspectable files:

- `sample-data.js` for the timeline loaded by the web app
- `chrona-sample-timeline.xlsx` for users who want to copy the starter workbook into Google Sheets

Both follow the same simple workbook structure:

- `Timeline Data`
- `Config`

`Timeline Data` contains baseline event fields and optional human-translation columns such as `Title [zh-TW]` and `Description [zh-TW]`.

`Config` contains workbook-wide settings. The sample includes:

- `language_baseline = en`
- `language_available = en,zh-TW,fr,es`
- `primary_groups = United States`
- group colors
- Never Translate examples

When editing the bundled sample, keep `sample-data.js` and `chrona-sample-timeline.xlsx` aligned.
