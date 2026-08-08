from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
js_path = ROOT / 'timeline.js'
css_path = ROOT / 'styles.css'
index_path = ROOT / 'index.html'
version_path = ROOT / 'version.js'
readme_path = ROOT / 'README.md'

js = js_path.read_text()
css = css_path.read_text()
index = index_path.read_text()
version_js = version_path.read_text()
readme = readme_path.read_text()

assert '2.8.2' in index
assert "const axisLabelLayer = document.getElementById('axisLabelLayer');" in js
assert 'function drawOverflowCues(width, height)' in js
assert 'function groupLaneLayout(axisY)' in js

# ---------------------------------------------------------------------------
# 1. Group captions: structural UI, never subject to viewport edge fade.
# ---------------------------------------------------------------------------
js = js.replace(
    "  const axisLabelLayer = document.getElementById('axisLabelLayer');\n",
    "  const axisLabelLayer = document.getElementById('axisLabelLayer');\n  const groupLabelLayer = document.getElementById('groupLabelLayer');\n",
    1
)

caption_pattern = re.compile(
    r"      const captionY = band\.isAbove \? band\.top \+ 6 : band\.bottom - 18;\n"
    r"      if \(captionY >= -2 && captionY <= height - 8\) \{\n"
    r"        ctx\.fillStyle = colorWithAlpha\(color, dark \? 0\.82 : 0\.72\);\n"
    r"        ctx\.textAlign = 'left';\n"
    r"        ctx\.fillText\(\n"
    r"          state\.events\.find\(event => event\.category === band\.category\)\?\.categoryLabel \|\| band\.category,\n"
    r"          GROUP_LANE_LABEL_INSET,\n"
    r"          captionY\n"
    r"        \);\n"
    r"      \}"
)
caption_replacement = """      const captionY = band.isAbove ? band.top + 6 : band.bottom - 18;
      if (captionY >= -2 && captionY <= height - 8) {
        const caption = document.createElement('div');
        caption.className = 'group-lane-label';
        caption.textContent = state.events.find(event => event.category === band.category)?.categoryLabel || band.category;
        caption.style.left = `${GROUP_LANE_LABEL_INSET}px`;
        caption.style.top = `${Math.round(captionY)}px`;
        caption.style.color = colorWithAlpha(color, dark ? 0.92 : 0.86);
        groupLabelLayer.appendChild(caption);
      }"""
js, count = caption_pattern.subn(caption_replacement, js, count=1)
assert count == 1, 'group caption replacement failed'

# Clear the new caption layer each desktop render.
js = js.replace(
    "    labelLayer.replaceChildren();\n    axisLabelLayer.replaceChildren();",
    "    labelLayer.replaceChildren();\n    axisLabelLayer.replaceChildren();\n    groupLabelLayer.replaceChildren();",
    1
)

# ---------------------------------------------------------------------------
# 2. Overflow disclosure: real interactive foreground control, no click-through.
# ---------------------------------------------------------------------------
# Add pointer-events to inline style so it overrides the non-interactive parent layer.
js = js.replace(
    "        'cursor:pointer',\n        'z-index:8',",
    "        'cursor:pointer',\n        'pointer-events:auto',\n        'touch-action:manipulation',\n        'z-index:9',",
    1
)

# Give the compact visual pill a comfortable minimum hit area without making it look bulky.
js = js.replace(
    "      const cueWidth = 42;\n      const cueHeight = 20;",
    "      const cueWidth = 44;\n      const cueHeight = 24;",
    1
)

# Capture pointerdown before the viewport drag/click machinery can see it.
click_block = """      cue.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        expandOverflowGroup(category, items);
      });"""
click_replacement = """      cue.addEventListener('pointerdown', event => {
        event.stopPropagation();
      });
      cue.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        expandOverflowGroup(category, items);
      });"""
assert click_block in js, 'overflow click block not found'
js = js.replace(click_block, click_replacement, 1)

# Belt-and-suspenders viewport guard: a disclosure owns its click even if DOM/CSS
# layering changes again later.
onclick_marker = "  function onViewportClick(event) {\n"
assert onclick_marker in js, 'onViewportClick not found'
js = js.replace(
    onclick_marker,
    onclick_marker + "    if (event.target.closest?.('.timeline-overflow-cue')) return;\n",
    1
)

# Also guard by geometry, so clicks in the control's visible rectangle can never
# fall through to an event hit target beneath it.
geometry_guard = """    const overflowControlAtPoint = [...labelLayer.querySelectorAll('.timeline-overflow-cue')].some(control => {
      const box = control.getBoundingClientRect();
      return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    });
    if (overflowControlAtPoint) return;
"""
js = js.replace(
    "    if (event.target.closest?.('.timeline-overflow-cue')) return;\n",
    "    if (event.target.closest?.('.timeline-overflow-cue')) return;\n" + geometry_guard,
    1
)

# ---------------------------------------------------------------------------
# 3. Radar: map the true visible world window into actual group-content extent.
#    Remove synthetic navigation-envelope mapping entirely.
# ---------------------------------------------------------------------------
radar_pattern = re.compile(
    r"      // Desktop/tablet radar is a true viewport into the vertically translated\n"
    r"      // timeline content\. Sticky-axis clamping has no effect on this geometry\.\n"
    r"      const viewportHeight = Math\.max\(1, viewport\.getBoundingClientRect\(\)\.height\);\n"
    r"      const contentBands = groupLaneLayout\(0\);\n"
    r"      let contentMin = -AXIS_STICKY_TOP_INSET;\n"
    r"      let contentMax = AXIS_STICKY_BOTTOM_INSET;\n"
    r"      for \(const band of contentBands\.values\(\)\) \{\n"
    r"        contentMin = Math\.min\(contentMin, band\.top\);\n"
    r"        contentMax = Math\.max\(contentMax, band\.bottom\);\n"
    r"      \}\n\n"
    r"      // Include the full allowed navigation envelope so the lens keeps moving\n"
    r"      // even when the viewport is temporarily beyond the outermost group\.\n"
    r"      const worldMin = Math\.min\(contentMin, -viewportHeight \* DESKTOP_AXIS_MAX_RATIO\);\n"
    r"      const worldMax = Math\.max\(contentMax, viewportHeight - viewportHeight \* DESKTOP_AXIS_MIN_RATIO\);\n"
    r"      const worldSpan = Math\.max\(viewportHeight, worldMax - worldMin\);\n"
    r"      const visibleTop = -viewportHeight \* state\.axisYRatio;\n"
    r"      const visibleBottom = visibleTop \+ viewportHeight;\n"
    r"      const lensTopRatio = Math\.max\(0, Math\.min\(1, \(visibleTop - worldMin\) / worldSpan\)\);\n"
    r"      const lensBottomRatio = Math\.max\(lensTopRatio, Math\.min\(1, \(visibleBottom - worldMin\) / worldSpan\)\);\n"
    r"      const verticalTop = rect\.height \* lensTopRatio;\n"
    r"      const verticalWindowHeight = Math\.max\(10, rect\.height \* \(lensBottomRatio - lensTopRatio\)\);\n"
    r"      overviewWindow\.style\.top = `\$\{Math\.max\(0, Math\.min\(rect\.height - verticalWindowHeight, verticalTop\)\)\}px`;\n"
    r"      overviewWindow\.style\.bottom = 'auto';\n"
    r"      overviewWindow\.style\.height = `\$\{verticalWindowHeight\}px`;"
)
radar_replacement = """      // Radar vertical geometry uses the same world coordinate system as the
      // group layout. The content axis is world y=0; vertical panning changes
      // which world-y interval is visible. Sticky-axis clamping is irrelevant.
      const viewportHeight = Math.max(1, viewport.getBoundingClientRect().height);
      const contentBands = groupLaneLayout(0);
      let contentMin = -AXIS_STICKY_TOP_INSET;
      let contentMax = AXIS_STICKY_BOTTOM_INSET;
      for (const band of contentBands.values()) {
        contentMin = Math.min(contentMin, band.top);
        contentMax = Math.max(contentMax, band.bottom);
      }

      const contentSpan = Math.max(1, contentMax - contentMin);
      const visibleTop = -viewportHeight * state.axisYRatio;
      const availableTravel = Math.max(0, contentSpan - viewportHeight);
      const lensFraction = Math.min(1, viewportHeight / contentSpan);
      const verticalWindowHeight = Math.max(10, rect.height * lensFraction);

      let verticalTop = 0;
      if (availableTravel > 0) {
        const clampedVisibleTop = Math.max(contentMin, Math.min(contentMax - viewportHeight, visibleTop));
        const scrollRatio = (clampedVisibleTop - contentMin) / availableTravel;
        verticalTop = (rect.height - verticalWindowHeight) * scrollRatio;
      }

      overviewWindow.style.top = `${verticalTop}px`;
      overviewWindow.style.bottom = 'auto';
      overviewWindow.style.height = `${verticalWindowHeight}px`;"""
js, count = radar_pattern.subn(radar_replacement, js, count=1)
assert count == 1, 'radar replacement failed'

# ---------------------------------------------------------------------------
# HTML/CSS layers for unfaded captions and reliable disclosure interaction.
# ---------------------------------------------------------------------------
index = index.replace(
    '      <div id="labelLayer" class="label-layer"></div>\n',
    '      <div id="labelLayer" class="label-layer"></div>\n      <div id="groupLabelLayer" class="group-label-layer" aria-hidden="true"></div>\n',
    1
)

css += """

/* Chrona v2.8.3 — structural labels and overflow controls stay interactive/readable. */
.group-label-layer {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
  overflow: hidden;
}
.group-lane-label {
  position: absolute;
  max-width: min(320px, calc(100% - 28px));
  padding: 1px 5px 2px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--surface-solid) 82%, transparent);
  box-shadow: 0 1px 2px rgba(15,23,42,.05);
  font: 650 10px/1.25 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 0 color-mix(in srgb, var(--surface-solid) 82%, transparent);
}
.timeline-overflow-cue {
  pointer-events: auto !important;
  touch-action: manipulation;
}
"""

# ---------------------------------------------------------------------------
# Version synchronization.
# ---------------------------------------------------------------------------
(ROOT / 'VERSION').write_text('2.8.3\n')
index = index.replace('2.8.2', '2.8.3')
version_js = version_js.replace('2.8.2', '2.8.3')

entry = """### 2.8.3

Fixed cluster disclosure interaction so overflow controls capture pointer input and cannot click through to hidden/underlying events; clicking a disclosure now reaches the animated group-expansion path reliably. Reworked radar vertical mapping to use the actual group-content world extent and the visible canvas world window rather than a synthetic navigation envelope. Moved group-lane captions to an unfaded structural overlay so viewport edge fades affect timeline content but not group identity labels.

"""
if '### 2.8.3' not in readme:
    readme = readme.replace('## Version history\n\n', '## Version history\n\n' + entry, 1)

js_path.write_text(js)
css_path.write_text(css)
index_path.write_text(index)
version_path.write_text(version_js)
readme_path.write_text(readme)

# Assertions used by CI before committing.
final_js = js_path.read_text()
final_css = css_path.read_text()
final_index = index_path.read_text()
assert "const groupLabelLayer = document.getElementById('groupLabelLayer');" in final_js
assert "event.target.closest?.('.timeline-overflow-cue')" in final_js
assert "'pointer-events:auto'" in final_js
assert "cue.addEventListener('pointerdown'" in final_js
assert 'const availableTravel = Math.max(0, contentSpan - viewportHeight);' in final_js
assert 'DESKTOP_AXIS_MAX_RATIO' not in final_js[final_js.find('// Radar vertical geometry'):final_js.find('// Radar vertical geometry') + 1800]
assert 'groupLabelLayer.appendChild(caption);' in final_js
assert '.timeline-overflow-cue {' in final_css
assert 'id="groupLabelLayer"' in final_index
assert 'v2.8.3' in final_index and '?v=2.8.3' in final_index
print('Chrona 2.8.3 patch applied')
