# Chrona v2.2.0

## Google Sheet onboarding and sample-data workflow

- Added a first-run notice explaining that Chrona is displaying sample data.
- Added a downloadable starter workbook: `chrona-sample-timeline.xlsx`.
- Added direct access to the starter workbook from both the first-run notice and Settings.
- Strengthened saved Google Sheet URL synchronization so Settings always displays the URL stored in browser local storage.
- Kept fallback timeline records in the standalone `sample-data.js` file rather than in `timeline.js`.
- Renamed internal fallback constants to make the external sample-data source explicit.
- Moved project Markdown documentation into `docs/`.
- Excluded the user's local `dev/` notes directory from release ZIP packages.
