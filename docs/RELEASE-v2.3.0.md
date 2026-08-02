# Chrona v2.3.0

## Complete translated workbook export

- Added **Import from Google Sheet** inside Settings to reload the latest source data.
- Added **Export translated workbook** to download a complete `.xlsx` workbook.
- Export includes `Timeline Data`, `Groups`, `Translations`, `Dictionary`, and `Dataset Settings`.
- Existing Sheet translations are preserved and browser-generated Traditional Chinese translations are merged into the exported `Translations` tab.
- Legacy translation cache data is migrated from persistent `localStorage` to tab-scoped `sessionStorage`; translation working data is discarded when the Chrona tab closes.
- Import supports the new `Timeline Data` tab name and retains backward compatibility with `TimelineJS Data`.
- The Google Sheet URL remains persisted and visible in Settings.
