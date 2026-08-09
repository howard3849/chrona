from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
js_path = ROOT / 'timeline.js'
index_path = ROOT / 'index.html'
version_path = ROOT / 'version.js'
readme_path = ROOT / 'README.md'

js = js_path.read_text()
index = index_path.read_text()
version_js = version_path.read_text()
readme = readme_path.read_text()

assert '2.8.4' in index
assert 'function onTimelineKeyDown(event)' in js
assert 'function drawOverview()' in js

# ---------------------------------------------------------------------------
# 1. Arrow-key panning: fine steps, Shift accelerates, native key repeat gives
#    continuous movement while held. Direction describes content movement.
# ---------------------------------------------------------------------------
def replace_function(source, name, replacement):
    marker = f'  function {name}('
    start = source.find(marker)
    if start < 0:
        raise AssertionError(f'{name} not found')
    brace = source.find('{', start)
    depth = 0
    i = brace
    in_string = None
    escape = False
    while i < len(source):
        ch = source[i]
        if in_string:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == in_string:
                in_string = None
        else:
            if ch in "'\"`":
                in_string = ch
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    return source[:start] + replacement + source[end:]
        i += 1
    raise AssertionError(f'unclosed function {name}')

keydown = r'''  function onTimelineKeyDown(event) {
    if (event.key === 'Escape' && !detailPanel.hidden) {
      closeDetails();
      return;
    }
    if (event.key === 'Enter' && state.selectedEvent) {
      openDetails(state.selectedEvent);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;

    // Never steal caret/navigation keys from editable controls.
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();

    if (isPhoneVerticalMode()) {
      // Phone timeline is vertical-in-time, so up/down pan through chronology.
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const span = state.viewEnd - state.viewStart;
      const fraction = event.shiftKey ? 0.18 : 0.025;
      const delta = span * fraction * (event.key === 'ArrowDown' ? 1 : -1);
      clampView(state.viewStart + delta, state.viewEnd + delta);
      scheduleRender();
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      // Right arrow moves timeline content left, revealing later years; left is
      // the inverse. Browser key-repeat makes holding the key continuously pan.
      const span = state.viewEnd - state.viewStart;
      const fraction = event.shiftKey ? 0.18 : 0.025;
      const delta = span * fraction * (event.key === 'ArrowRight' ? 1 : -1);
      clampView(state.viewStart + delta, state.viewEnd + delta);
    } else {
      // Up arrow moves content upward (revealing lower groups); Down moves it
      // downward (revealing upper groups). Shift advances about one large lane.
      const rect = viewport.getBoundingClientRect();
      const pixels = event.shiftKey ? Math.max(GROUP_LANE_HEIGHT, rect.height * 0.18) : Math.max(14, rect.height * 0.025);
      const ratioDelta = pixels / Math.max(1, rect.height);
      state.axisYRatio = Math.max(
        DESKTOP_AXIS_MIN_RATIO,
        Math.min(
          DESKTOP_AXIS_MAX_RATIO,
          state.axisYRatio + (event.key === 'ArrowDown' ? ratioDelta : -ratioDelta)
        )
      );
      localStorage.setItem('chrona-axis-y-ratio', String(state.axisYRatio));
    }
    scheduleRender();
  }'''
js = replace_function(js, 'onTimelineKeyDown', keydown)

# ---------------------------------------------------------------------------
# 2. Radar miniature vertical marks use the SAME group/world coordinate system
#    as the lens. Previously desktop marks used arbitrary 3-row strips, which
#    made visible blocks appear outside the lens even when the canvas showed
#    empty space above them.
# ---------------------------------------------------------------------------
old_desktop_points = r'''      points.forEach((event, index) => {
        const x = ((event.start - dataMin) / span) * rect.width;
        const lanes = 3;
        const lane = index % lanes;
        const y = pointTop + lane * (pointArea / lanes);
        overviewCtx.fillStyle = event.color;
        overviewCtx.fillRect(Math.max(0, Math.min(rect.width - 1, x)), y, 2, Math.max(5, pointArea / lanes - 1));
      });

      periods.forEach((event, index) => {
        const x1 = ((event.start - dataMin) / span) * rect.width;
        const x2 = ((event.end - dataMin) / span) * rect.width;
        const lanes = Math.max(1, Math.min(3, periods.length));
        const laneHeight = Math.max(2, periodArea / lanes);
        const y = periodTop + (index % lanes) * laneHeight;
        overviewCtx.fillStyle = event.color;
        overviewCtx.fillRect(
          Math.max(0, Math.min(rect.width, x1)),
          y,
          Math.max(1, Math.min(rect.width, x2) - Math.max(0, x1)),
          Math.max(2, laneHeight - 1)
        );
      });'''
new_desktop_points = r'''      const verticalGeometry = overviewVerticalGeometry();
      const radarBands = groupLaneLayout(0);
      const worldToRadarY = worldY =>
        ((worldY - verticalGeometry.contentMin) / Math.max(1, verticalGeometry.contentSpan)) * rect.height;
      const groupPointIndex = new Map();
      const groupPointTotals = new Map();
      points.forEach(event => groupPointTotals.set(event.category, (groupPointTotals.get(event.category) || 0) + 1));

      points.forEach(event => {
        const x = ((event.start - dataMin) / span) * rect.width;
        const band = radarBands.get(event.category);
        if (!band) return;
        const index = groupPointIndex.get(event.category) || 0;
        groupPointIndex.set(event.category, index + 1);
        const maxRows = Math.max(1, Math.floor((band.height - AXIS_BLOCK_CLEARANCE * 2) / 34));
        const row = index % maxRows;
        const worldY = band.isAbove
          ? band.bottom - AXIS_BLOCK_CLEARANCE - 13.5 - row * 34
          : band.top + AXIS_BLOCK_CLEARANCE + 13.5 + row * 34;
        const y = worldToRadarY(worldY);
        overviewCtx.fillStyle = event.color;
        overviewCtx.fillRect(
          Math.max(0, Math.min(rect.width - 1, x)),
          Math.max(0, Math.min(rect.height - 3, y - 2)),
          2,
          5
        );
      });

      const groupPeriodIndex = new Map();
      periods.forEach(event => {
        const x1 = ((event.start - dataMin) / span) * rect.width;
        const x2 = ((event.end - dataMin) / span) * rect.width;
        const band = radarBands.get(event.category);
        if (!band) return;
        const index = groupPeriodIndex.get(event.category) || 0;
        groupPeriodIndex.set(event.category, index + 1);
        // Periods sit farther from the axis than point rows, but remain inside
        // their actual group band and therefore share the lens projection.
        const offset = Math.min(band.height - 8, AXIS_BLOCK_CLEARANCE + 42 + index * 10);
        const worldY = band.isAbove ? band.bottom - offset : band.top + offset;
        const y = worldToRadarY(worldY);
        overviewCtx.fillStyle = event.color;
        overviewCtx.fillRect(
          Math.max(0, Math.min(rect.width, x1)),
          Math.max(0, Math.min(rect.height - 3, y - 1)),
          Math.max(1, Math.min(rect.width, x2) - Math.max(0, x1)),
          3
        );
      });'''
if old_desktop_points not in js:
    raise AssertionError('desktop radar marker block not found')
js = js.replace(old_desktop_points, new_desktop_points, 1)

# Reuse the same verticalGeometry instance for lens projection in the desktop branch.
js = js.replace(
    "      // Radar lens is a miniature of the actual vertically scrollable content.\n      const vertical = overviewVerticalGeometry();\n      const lensFraction = Math.min(1, vertical.viewportHeight / vertical.contentSpan);\n      const verticalWindowHeight = Math.max(10, rect.height * lensFraction);\n      let verticalTop = 0;\n      if (vertical.availableTravel > 0) {\n        const scrollRatio = (vertical.visibleTop - vertical.contentMin) / vertical.availableTravel;\n        verticalTop = (rect.height - verticalWindowHeight) * scrollRatio;\n      }",
    "      // Lens uses the exact same world-to-radar geometry as miniature content.\n      const vertical = verticalGeometry;\n      const lensFraction = Math.min(1, vertical.viewportHeight / vertical.contentSpan);\n      const verticalWindowHeight = Math.max(10, rect.height * lensFraction);\n      let verticalTop = 0;\n      if (vertical.availableTravel > 0) {\n        const scrollRatio = (vertical.visibleTop - vertical.contentMin) / vertical.availableTravel;\n        verticalTop = (rect.height - verticalWindowHeight) * scrollRatio;\n      }",
    1
)

# ---------------------------------------------------------------------------
# Version sync.
# ---------------------------------------------------------------------------
(ROOT / 'VERSION').write_text('2.8.5\n')
index = index.replace('2.8.4', '2.8.5')
version_js = version_js.replace('2.8.4', '2.8.5')
entry = '''### 2.8.5

Added direct keyboard panning: arrow keys move the timeline horizontally/vertically, Shift accelerates each step, and native key repeat provides continuous travel while a key is held. Corrected the desktop radar so miniature point/period marks and the viewport lens share the same group/world-Y projection instead of placing event marks in arbitrary decorative rows; radar drag and keyboard/mouse panning now update the same vertical viewport model.

'''
if '### 2.8.5' not in readme:
    readme = readme.replace('## Version history\n\n', '## Version history\n\n' + entry, 1)

js_path.write_text(js)
index_path.write_text(index)
version_path.write_text(version_js)
readme_path.write_text(readme)

final_js = js_path.read_text()
assert "['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']" in final_js
assert 'event.shiftKey ? 0.18 : 0.025' in final_js
assert 'const verticalGeometry = overviewVerticalGeometry();' in final_js
assert 'const worldToRadarY = worldY =>' in final_js
assert 'const vertical = verticalGeometry;' in final_js
assert 'v2.8.5' in index_path.read_text() and '?v=2.8.5' in index_path.read_text()
print('Chrona 2.8.5 patch applied')

# trigger
