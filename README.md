# Chrona

Chrona is an interactive timeline explorer for viewing historical, organizational, and personal events across multiple groups on one responsive timeline. It supports point events, multi-year events, long reference periods, group filtering, desktop/iPad/iPhone layouts, multilingual content, and a radar navigator for quickly moving through large spans of time.

Chrona runs entirely in the browser and can be hosted as a static site, including on GitHub Pages. Timeline data is loaded from a shared Google Sheet.

## What you need

To use your own data, create a Google Sheet based on the included `chrona-sample-timeline.xlsx` workbook, upload or open it in Google Sheets, edit the timeline, and provide Chrona with a shareable Google Sheet URL.

The workbook uses:

- `Timeline Data` — required timeline rows.
- `Config` — optional settings for baseline language, available languages, primary groups, group colors, and protected phrases that should never be translated.

The `Timeline Data` sheet is based on the TimelineJS spreadsheet format and extends it with Chrona-specific fields such as `Importance`, `Visible`, `Event ID`, optional color controls, and language columns such as `Title [zh-TW]` and `Description [zh-TW]`.

Existing TimelineJS sheets should generally load without restructuring. Chrona recognizes the standard TimelineJS fields and treats a blank `Type` as an ordinary event. Chrona additionally uses:

- `period` — a Chrona period block.
- `title` — the dataset title row.

`Importance` supports exactly `Major`, `Normal`, and `Minor`. A blank Importance cell is treated as `Normal`; legacy `Medium` values are normalized to `Normal` when loaded or exported.

## Quick start

1. Host the Chrona files on GitHub Pages or another static web server.
2. Open Chrona in a supported browser.
3. In Settings, paste a shareable Google Sheet URL.
4. Click **Reload** to load the timeline.
5. Leave the URL blank and click **Reload** to return to the included sample timeline. When a private Sheet is loaded, use **Include sample timeline** to display the bundled public events alongside it.

Chrona also includes an export link that downloads the current timeline, translations, and Config data as a Google Sheet-compatible workbook.

## Language support

Set `language_baseline` and `language_available` in the `Config` sheet using standard BCP 47 language tags, for example:

```text
language_baseline    en-US
language_available   en-US,zh-TW,fr,es
```

Human translation columns take priority. When a translated cell is missing, Chrona may translate the baseline text on the fly when the browser supports that language pair. Entries under `never_translate.*` remain unchanged.

## Version history

### 2.8.8
- Added a persistent Lane-keeping toggle beside the visible-group pills. Off restores compact mixed-group packing; on keeps separated group lanes.
- Fixed adaptive lane sizing so one visible row always receives one render row and stale cluster expansion no longer leaves oversized empty lanes after zoom/pan changes.
- Treat event blocks, leaders, dots, spans, and event-year labels as one render bundle: if the block is hidden, overflowed, or suppressed at a sticky edge, its anchor artifacts are also hidden.
- Put the timeline block canvas physically above the leader canvas so unrelated connector lines cannot cut through period/event blocks.

### 2.8.7

Refined Home/Reset to choose a dense enabled-event window at a practical 250/500/1000-year span and vertically center the active stack. Trackpad/wheel input over the zoom rail now performs fine continuous zoom instead of panning the timeline. Adaptive group lanes now use only currently intersecting content: empty groups collapse to a label strip, one-row groups stay compact, multi-group lanes cap at the normal maximum, and a sole group on one side expands enough to reveal all visible records without overflow controls. Removed darker lane borders. Chronological List now shows each year heading once and uses month/day detail for subsequent same-year entries. All connector lines render behind event/period blocks, and connectors from the scrolled-away side are suppressed while the axis is sticky at the top or bottom.

### 2.8.6

Made group lanes zoom-adaptive downward: current zoom packing determines the compact lane height, while automatic growth remains capped at the established maximum and overflow continues to use disclosure controls; explicit disclosure expansion can still exceed the cap. Radar vertical positions now consume the same zoom-dependent packing metrics as the main canvas, so lane thickness and miniature event levels update with zoom. Added subtle group-color lane tinting while retaining stronger group colors on blocks/connectors. Restricted detail hit-testing to actual event/period blocks; duration spans, anchor dots, and connector lines no longer open details.

### 2.8.5

Added direct keyboard panning: arrow keys move the timeline horizontally/vertically, Shift accelerates each step, and native key repeat provides continuous travel while a key is held. Corrected the desktop radar so miniature point/period marks and the viewport lens share the same group/world-Y projection instead of placing event marks in arbitrary decorative rows; radar drag and keyboard/mouse panning now update the same vertical viewport model.

### 2.8.4

Made a single enabled group on either side of the axis auto-expand without the preset lane-height restriction, added symmetric axis-facing block clearance, corrected the yellow cursor year/relative-label spacing to use one shared gap, and upgraded the desktop/tablet radar lens to true 2D navigation: drag vertically or diagonally to move through timeline groups, click empty radar space to jump in both dimensions, while left/right lens edges continue controlling time zoom.

### 2.8.3

Fixed cluster disclosure interaction so overflow controls capture pointer input and cannot click through to hidden/underlying events; clicking a disclosure now reaches the animated group-expansion path reliably. Reworked radar vertical mapping to use the actual group-content world extent and the visible canvas world window rather than a synthetic navigation envelope. Moved group-lane captions to an unfaded structural overlay so viewport edge fades affect timeline content but not group identity labels.

### 2.8.2

Made the horizontal time axis a permanent foreground HUD so event and period blocks pass behind the complete axis strip in both normal and sticky states. Event-year labels now share the foreground axis layer. Group lanes are visually transparent while keeping separators/captions. Cluster disclosures point away from the axis, animate the affected group open, guarantee the clicked cluster is revealed, and repack the whole group so neighboring overflow can also disappear when space permits. Reworked the radar lens to represent the actual vertically visible content window and total content extent, including expanded groups, independent of sticky-axis clamping.

### 2.8.1

Refined the reconstructed group-lane system: the complete timeline-axis strip now remains readable when pinned to the top or bottom edge, including regular tick labels and event-year anchors. Overflow disclosure controls now live on their actual group boundaries and scroll away with the group instead of sticking to the viewport; activating one expands only that group beyond its preset height. The disclosure uses a compact editorial caret-and-count pill for legibility. Corrected the radar lens vertical mapping so it follows the section of timeline content actually exposed by vertical navigation.

### 2.8.0

Restored fixed-height per-group timeline lanes on desktop/tablet. Each enabled group now owns a stable vertical band in source/config order, so horizontal panning cannot collapse different groups back into one shared packing pool. Point labels and periods pack only inside their group band; Major → Normal → Minor remains the deterministic space priority, overflow cues are clustered per group and appear at that lane’s outer edge, and overlapping duration spans receive group-aware micro-offsets. The v2.7 sticky central axis and radar synchronization remain intact.

### 2.7.0

Added stable priority-aware lane packing using Major → Normal → Minor, with blank Importance treated as Normal and legacy Medium values normalized. Hidden lane items now surface as compact numbered chevron overflow cues that zoom into their cluster instead of disappearing silently. The desktop/tablet year axis now sticks to the top or bottom canvas edge while event lanes continue to scroll, and the radar focus frame now tracks both the visible time range and vertical lane pan across responsive layouts.

### 2.6.3

Corrected responsive overlays. The equal-distance List View now fits the actual phone viewport, removes group names from cards, and limits titles to two lines. Settings now opens above the List View, becomes a true full-screen panel on iPhone and iPad, and hides scrollbars on its scrollable surface.

### 2.6.2

Refined the equal-distance List View across Mac, iPad, and iPhone. The phone-sized drawer reanchors to the date currently centered on the plotted timeline every time it opens, uses compact Chrona-sized typography, participates in Search, and keeps the detail pane above the still-open list. The Chrona signature logo retains its AI rainbow treatment.

### 2.6.0

Added a theme-aware chronological List View that presents all visible events and periods at equal vertical spacing. The bottom-sheet overlay opens anchored to the date currently centered in the plotted timeline, keeps all event cards to the right of a vertical rail, and follows existing group visibility. This release also fixes midyear events displaying the following year, establishes New York-style accent typography for headings and field labels, uses SF Pro-style body typography, and strengthens the parchment-gradient timeline canvas.

### 2.5.11

Fixed human translation-column priority. Chrona now recognizes equivalent Chinese language tags such as `zh-TW` and `zh-Hant`, always prefers populated human-authored columns such as `Title [zh-TW]` and `Description [zh-TW]`, and uses machine translation only when no matching human text is available.

### 2.5.10

Separated the bundled public sample from the user’s private timeline. New users always begin with sample data, while users with a private Google Sheet can turn **Include sample timeline** on or off. When both layers are visible, private rows override matching sample Event IDs; export remains private-only. The public sample workbook was expanded with 52 modern landmark events across the United States, Britain, China, and Germany.

### 2.5.8

Added this front-facing README and made release documentation part of the version-finalization workflow. Future release ZIPs must include a new version-history entry before packaging.

### 2.5.7

Strengthened the responsive Neutral Studio shell. Desktop gained more visible layered surfaces and a warmer paper-like timeline canvas, while iPad and iPhone remained edge-to-edge. Phone radar headings were removed to preserve usable space.

### 2.5.6

Introduced the shared Neutral Studio visual system for light and dark modes, including coordinated application surfaces, a distinct radar surface, refined axis and border colors, and theme-specific event treatments for AI, Gradient, Flat, and Metro.

### 2.5.5

Fixed iPhone vertical-radar focus-frame sizing and drag behavior after visible-group date bounds changed. Desktop and iPad frame positioning is restored when leaving phone mode.

### 2.5.4

Radar content and date bounds now follow enabled groups. Rapid visibility changes are debounced, range padding is added, and the behavior applies to both horizontal desktop/iPad radar and vertical iPhone radar.

### 2.5.3

Clearing the Google Sheet URL and clicking Reload now removes the saved URL, restores the sample timeline, and returns Chrona to a first-time-user state.

### 2.5.2

Simplified the Google Sheet workflow. The former Save and Import actions were merged into **Reload**, while Export and sample-workbook download became compact text links.

### 2.5.1

Updated the workbook schema to standardize on `Type` and `Group`, removed duplicate `Element Type`, `Category`, and `Role` fields, refreshed field notes, and bundled the revised sample workbook.

### 2.5.0

Moved Chrona to a two-sheet workbook model:

- `Timeline Data` contains baseline content and optional language columns.
- `Config` contains languages, primary groups, group colors, and never-translate entries.
- Groups are derived directly from the `Group` column.
- Human translations are stored beside their source rows and override on-the-fly translation.
- The Settings language menu is generated from `language_available`.

### 2.4.0

Made the language model baseline-neutral. Any configured language can be the source language, and all other configured languages are treated as translated views of that baseline.

### 2.3.0

Added complete workbook export, merged browser-generated translations into the exported data, introduced tab-scoped translation caching, and added manual import/reload controls for Google Sheet data.

### 2.2.0

Added first-run sample-data onboarding, a downloadable starter workbook, stronger saved-URL synchronization, externalized sample data into `sample-data.js`, and moved project documentation into `docs/`.

### 2.1.18

Introduced single-source release versioning through `VERSION` and `version.js`, synchronized cache-busting references, added release verification, and automated repo-safe ZIP packaging.

### 2.1.17

Synchronized previously conflicting version references across Settings, runtime JavaScript, and release files.

### 2.1.16

Added and refined sample-data fallback behavior and first-time-user onboarding.

### 2.1.15

Improved iPhone year-ruler behavior and vertical period rendering, including gradient presentation and responsive fixes.

### 2.1.14

Normalized radar period-block sizing so miniature period bars render consistently.

### 2.1.13

Added responsive radar behavior across desktop, iPad, and iPhone layouts.

### 2.1.7–2.1.12

Refined search behavior, yellow year-line labels, responsive layouts, radar synchronization, and phone-specific timeline rendering through several incremental releases.

### 2.1.0–2.1.6

Refactored phone periods, search, and the year ruler into dedicated modules and stylesheets. Improved settings, detail-panel behavior, theme consistency, and timeline interaction reliability.

### 1.36

Fixed stale pointer and drag state after Reset so hover tooltips continue working. Duration span bars were increased to 3 px with clearer spacing between overlapping spans.

## Project structure

- `index.html` — application shell and Settings UI.
- `timeline.js` — primary timeline behavior.
- `styles.css` and `css/` — global and component styling.
- `sample-data.js` — bundled public sample layer shown on first use and optionally combined with private data.
- `chrona-sample-timeline.xlsx` — starter workbook.
- `VERSION` and `version.js` — synchronized application version.
- `docs/` — project and release documentation.
- `dev/` — local development notes; excluded from release ZIPs.
