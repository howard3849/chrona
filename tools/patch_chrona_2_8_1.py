from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
js_path = ROOT / 'timeline.js'
text = js_path.read_text()

# Constants: sticky axis strip must preserve labels on both sides of the line.
text = text.replace(
"  const GROUP_LANE_LABEL_INSET = 10;\n",
"  const GROUP_LANE_LABEL_INSET = 10;\n  const AXIS_STICKY_TOP_INSET = 31;\n  const AXIS_STICKY_BOTTOM_INSET = 31;\n  const GROUP_LANE_EXPAND_STEP = 34;\n"
)

# Per-group expansion state lives only for the current loaded timeline session.
text = text.replace(
"    pendingOverflow: [],\n    renderQueued: false,",
"    pendingOverflow: [],\n    expandedGroupHeights: new Map(),\n    renderQueued: false,"
)

# Reset temporary group expansion when a new data set is loaded.
text = text.replace(
"    state.overviewBounds = null;\n    const times = state.events.flatMap(e => [e.start, e.end]).filter(v => v != null);",
"    state.overviewBounds = null;\n    state.expandedGroupHeights.clear();\n    const times = state.events.flatMap(e => [e.start, e.end]).filter(v => v != null);"
)

# Group layout: fixed default height, cumulative offsets, only explicitly expanded groups grow.
pattern = re.compile(r"  function groupLaneLayout\(axisY\) \{.*?\n  \}\n\n  function drawGroupLaneBands", re.S)
replacement = '''  function groupLaneHeight(category) {
    return Math.max(GROUP_LANE_HEIGHT, Number(state.expandedGroupHeights.get(category)) || GROUP_LANE_HEIGHT);
  }

  function groupLaneLayout(axisY) {
    // Preserve source/config order so groups never jump while panning. A group
    // starts at the fixed preset height and grows only after its overflow
    // disclosure control is explicitly activated.
    const enabledGroups = [...state.categories.keys()].filter(name => state.enabledCategories.has(name));
    const primary = enabledGroups.filter(name => isPrimaryCategory(name));
    const reference = enabledGroups.filter(name => !isPrimaryCategory(name));
    const bands = new Map();

    let primaryCursor = axisY - GROUP_LANE_AXIS_GAP;
    primary.forEach((category, index) => {
      const laneHeight = groupLaneHeight(category);
      const bottom = primaryCursor;
      const top = bottom - laneHeight;
      bands.set(category, {
        category,
        isAbove: true,
        index,
        height: laneHeight,
        top,
        bottom,
        near: bottom,
        far: top
      });
      primaryCursor = top;
    });

    let referenceCursor = axisY + GROUP_LANE_AXIS_GAP;
    reference.forEach((category, index) => {
      const laneHeight = groupLaneHeight(category);
      const top = referenceCursor;
      const bottom = top + laneHeight;
      bands.set(category, {
        category,
        isAbove: false,
        index,
        height: laneHeight,
        top,
        bottom,
        near: top,
        far: bottom
      });
      referenceCursor = bottom;
    });

    return bands;
  }

  function drawGroupLaneBands'''
text, count = pattern.subn(replacement, text, count=1)
assert count == 1, 'groupLaneLayout replacement failed'

# Group rendering: lanes follow the natural content axis; axis-proximal event
# markers, duration bars and event-year labels follow the sticky display axis.
text = text.replace(
"  function drawEvents(width, height, axisY) {",
"  function drawEvents(width, height, contentAxisY, displayAxisY = contentAxisY) {"
)
text = text.replace(
"    const bands = groupLaneLayout(axisY);\n",
"    const bands = groupLaneLayout(contentAxisY);\n"
)
text = text.replace(
"      const pointLaneCount = drawPointRows(points, width, height, axisY, band.isAbove, threshold, band);",
"      const pointLaneCount = drawPointRows(points, width, height, displayAxisY, band.isAbove, threshold, band);"
)
text = text.replace(
"    drawLeaderLines(axisY);",
"    drawLeaderLines(displayAxisY);",
1
)
text = text.replace(
"        axisY,\n        threshold,\n        band.isAbove,",
"        contentAxisY,\n        threshold,\n        band.isAbove,",
1
)

# Respect actual expanded band height when deciding how many point rows fit.
text = text.replace(
"      ? Math.max(0, Math.floor((GROUP_LANE_HEIGHT - 26) / 34))",
"      ? Math.max(0, Math.floor(((band.height || GROUP_LANE_HEIGHT) - 26) / 34))"
)

# Overflow: anchor the control to the real inter-group boundary, never clamp it
# to the viewport edge. Clicking expands only that group vertically.
overflow_pattern = re.compile(r"  function recordOverflowEvent\(event, x, isAbove, band = null\) \{.*?\n  function stickyAxisY", re.S)
overflow_replacement = '''  function recordOverflowEvent(event, x, isAbove, band = null) {
    if (!Number.isFinite(x) || !event) return;
    state.pendingOverflow.push({
      event,
      x,
      time: Number(event.start),
      isAbove: Boolean(isAbove),
      category: event.category,
      boundaryY: band ? (isAbove ? band.top : band.bottom) : null
    });
  }

  function expandOverflowGroup(category, hiddenCount) {
    if (!category) return;
    const current = groupLaneHeight(category);
    const extra = Math.max(GROUP_LANE_EXPAND_STEP * 2, Math.max(1, hiddenCount) * GROUP_LANE_EXPAND_STEP);
    state.expandedGroupHeights.set(category, current + extra);
    scheduleRender();
  }

  function drawOverflowCues(width, height) {
    if (!state.pendingOverflow.length || isPhoneVerticalMode()) return;
    const bucketSize = 48;
    const clusters = new Map();

    for (const item of state.pendingOverflow) {
      if (item.x < -8 || item.x > width + 8) continue;
      if (!Number.isFinite(item.boundaryY)) continue;
      const bucket = Math.round(item.x / bucketSize);
      const key = `${item.isAbove ? 'above' : 'below'}:${item.category || ''}:${bucket}`;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key).push(item);
    }

    for (const items of clusters.values()) {
      if (!items.length) continue;
      const boundaryY = items[0].boundaryY;
      // The disclosure belongs to the group boundary. Once that boundary
      // scrolls out of view, its control scrolls out too; it never sticks to
      // the canvas edge or competes with the sticky time axis.
      if (boundaryY < 0 || boundaryY > height) continue;

      const x = items.reduce((sum, item) => sum + item.x, 0) / items.length;
      const time = items.reduce((sum, item) => sum + item.time, 0) / items.length;
      const category = items[0].category || '';
      const color = items[0].event?.color || categoryColor(category);
      const cueWidth = 42;
      const cueHeight = 20;
      const cue = document.createElement('button');
      cue.type = 'button';
      cue.className = 'timeline-overflow-cue';
      cue.setAttribute('aria-label', `Expand ${category || 'group'} to show ${items.length} more timeline items near ${formatYear(time)}`);
      cue.title = `Show ${items.length} more in ${category || 'this group'}`;
      cue.style.cssText = [
        'position:absolute',
        `width:${cueWidth}px`,
        `height:${cueHeight}px`,
        'padding:0 7px',
        'margin:0',
        `border:1px solid ${colorWithAlpha(color, .48)}`,
        'border-radius:999px',
        'background:color-mix(in srgb, var(--surface-solid, #ffffff) 88%, transparent)',
        'backdrop-filter:blur(8px)',
        '-webkit-backdrop-filter:blur(8px)',
        `color:${color}`,
        'box-shadow:0 2px 8px rgba(15,23,42,.12)',
        'cursor:pointer',
        'z-index:8',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'gap:5px',
        `left:${Math.round(Math.max(0, Math.min(width - cueWidth, x - cueWidth / 2)))}px`,
        `top:${Math.round(boundaryY - cueHeight / 2)}px`
      ].join(';');
      // Premium editorial disclosure pattern: a small caret plus a separate,
      // legible count. The number never sits in or touches the caret valley.
      cue.innerHTML = `<svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true" focusable="false"><path d="M1 1 L5 5 L9 1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg><span style="font:700 10px/1 -apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;min-width:10px;text-align:center">${items.length}</span>`;
      cue.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        expandOverflowGroup(category, items.length);
      });
      labelLayer.appendChild(cue);
    }
  }

  function stickyAxisY'''
text, count = overflow_pattern.subn(overflow_replacement, text, count=1)
assert count == 1, 'overflow replacement failed'

# Sticky axis is a strip, not a one-pixel line. Leave enough inset for event
# years above/below the axis and the regular tick labels.
sticky_pattern = re.compile(r"  function stickyAxisY\(height, rawAxisY = height \* state\.axisYRatio\) \{.*?\n  \}", re.S)
sticky_replacement = '''  function stickyAxisY(height, rawAxisY = height * state.axisYRatio) {
    const top = Math.min(AXIS_STICKY_TOP_INSET, Math.max(1, height / 2));
    const bottom = Math.max(top, height - Math.min(AXIS_STICKY_BOTTOM_INSET, Math.max(1, height / 2)));
    return Math.max(top, Math.min(bottom, rawAxisY));
  }'''
text, count = sticky_pattern.subn(sticky_replacement, text, count=1)
assert count == 1, 'stickyAxisY replacement failed'

# Render events with both natural lane axis and sticky display axis.
text = text.replace(
"    drawEvents(rect.width, rect.height, contentAxisY);",
"    drawEvents(rect.width, rect.height, contentAxisY, axisY);"
)

# Radar lens represents the viewport into vertically translated content, so its
# vertical movement is the inverse of the content-axis position.
text = text.replace(
"      const verticalPosition = Math.max(0, Math.min(1,\n        (state.axisYRatio - DESKTOP_AXIS_MIN_RATIO) / verticalRange\n      ));",
"      const verticalPosition = Math.max(0, Math.min(1,\n        (DESKTOP_AXIS_MAX_RATIO - state.axisYRatio) / verticalRange\n      ));"
)

js_path.write_text(text)

# Version synchronization.
(ROOT / 'VERSION').write_text('2.8.1\n')
version_path = ROOT / 'version.js'
version_text = version_path.read_text().replace("2.8.0", "2.8.1")
version_path.write_text(version_text)

index_path = ROOT / 'index.html'
index_text = index_path.read_text().replace('2.8.0', '2.8.1')
index_path.write_text(index_text)

readme_path = ROOT / 'README.md'
readme = readme_path.read_text()
entry = '''### 2.8.1\n\nRefined the reconstructed group-lane system: the complete timeline-axis strip now remains readable when pinned to the top or bottom edge, including regular tick labels and event-year anchors. Overflow disclosure controls now live on their actual group boundaries and scroll away with the group instead of sticking to the viewport; activating one expands only that group beyond its preset height. The disclosure uses a compact editorial caret-and-count pill for legibility. Corrected the radar lens vertical mapping so it follows the section of timeline content actually exposed by vertical navigation.\n\n'''
if '### 2.8.1' not in readme:
    readme = readme.replace('## Version history\n\n', '## Version history\n\n' + entry, 1)
readme_path.write_text(readme)

# Basic assertions before the workflow commits anything.
final = js_path.read_text()
assert 'expandedGroupHeights: new Map()' in final
assert 'expandOverflowGroup(category, items.length)' in final
assert '(DESKTOP_AXIS_MAX_RATIO - state.axisYRatio) / verticalRange' in final
assert 'drawEvents(rect.width, rect.height, contentAxisY, axisY)' in final
assert 'AXIS_STICKY_TOP_INSET = 31' in final
print('Chrona 2.8.1 patch applied')
