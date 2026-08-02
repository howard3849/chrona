# Chrona v2.5.0

## Two-sheet Google Sheet format

Chrona now uses only these sheets for new workbooks:

- `Timeline Data`
- `Config` (optional)

Groups are derived from the `Group` column. Group colors, primary groups, available languages, the baseline language, and Never Translate phrases are defined in `Config`.

## Translation columns

Human translations live beside their baseline row:

- `Title [zh-TW]`
- `Description [zh-TW]`
- `Media Caption [zh-TW]`

Chrona uses a human-translated cell first. If the cell is blank or absent, it translates the baseline text on the fly. Export writes generated translations back into these language columns.

## Config keys

- `language_baseline`
- `language_available`
- `primary_groups`
- `group_color.<group name>`
- `never_translate.<number>`

The Settings language menu is rebuilt automatically from `language_available` after each import.

## Compatibility

Older `TimelineJS Data`, `Groups`, `Translations`, `Dataset Settings`, and `Dictionary` tabs remain import-compatible. Export always produces the new two-sheet format so an older workbook can be migrated by importing it and exporting once.
