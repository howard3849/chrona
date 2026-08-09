from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
js_path = ROOT/'timeline.js'
css_path = ROOT/'styles.css'
index_path = ROOT/'index.html'
version_path = ROOT/'version.js'
readme_path = ROOT/'README.md'

js = js_path.read_text()
css = css_path.read_text()
index = index_path.read_text()
version_js = version_path.read_text()
readme = readme_path.read_text()

assert '2.8.5' in index

# State for one canonical zoom-dependent packing model shared by lanes and radar.
js = js.replace(
"    expandedGroupHeights: new Map(),\n",
"    expandedGroupHeights: new Map(),\n    adaptiveGroupLayout: new Map(),\n",
1)

# Replace the previous single-group/static lane calculation with a zoom-dependent
# canonical packing estimate. Automatic lane height may shrink, but never grow
# beyond GROUP_LANE_HEIGHT. Explicit cluster expansion may still exceed that cap.
start = js.index('  function singleGroupNaturalHeight(category) {')
end = js.index('  function drawGroupLaneBands(', start)
replacement = r'''  function computeAdaptiveGroupLayout(width = Math.max(1, viewport.clientWidth || 1)) {
    const threshold = labelThreshold(state.viewEnd - state.viewStart);
    const result = new Map();
    const enabledGroups = [...state.categories.keys()].filter(name => state.enabledCategories.has(name));

    enabledGroups.forEach(category => {
      const events = state.events.filter(event =>
        event.elementType !== 'Title' &&
        event.category === category &&
        state.enabledCategories.has(event.category)
      );
      const points = events.filter(event => event.elementType !== 'Period');
      const periods = events.filter(event => event.elementType === 'Period' && Number.isFinite(event.end));
      const rowIntervals = [];
      const pointRowsById = new Map();

      const sortedPoints = [...points].sort((a, b) =>
        Number(state.forcedRevealEventIds.has(b.id)) - Number(state.forcedRevealEventIds.has(a.id)) ||
        (importanceRank[b.importance] || 2) - (importanceRank[a.importance] || 2) ||
        a.start - b.start || String(a.id || '').localeCompare(String(b.id || ''))
      );

      sortedPoints.forEach(event => {
        if ((importanceRank[event.importance] || 2) < threshold) return;
        const x = timeToX(event.start, width);
        const preview = event.thumbnail || (looksLikeImage(event.media) ? event.media : '');
        const measured = measureEventLabelWidth(event.headline, event.importance === 'Major', Boolean(preview));
        const labelWidth = Math.min(360, Math.max(96, Math.min(measured, Math.max(96, width))));
        const left = x;
        const right = left + labelWidth;
        let row = 0;
        while (true) {
          const intervals = rowIntervals[row] || [];
          if (!intervals.some(interval => left < interval.right + 8 && right > interval.left - 8)) break;
          row++;
        }
        if (!rowIntervals[row]) rowIntervals[row] = [];
        rowIntervals[row].push({left, right});
        pointRowsById.set(event.id, row);
      });

      const periodLaneEnds = [];
      const periodRowsById = new Map();
      [...periods].sort((a,b) => a.start-b.start || (a.end||a.start)-(b.end||b.start)).forEach(event => {
        const left = Math.min(timeToX(event.start, width), timeToX(event.end, width));
        const right = Math.max(timeToX(event.start, width), timeToX(event.end, width));
        let row = 0;
        while (periodLaneEnds[row] != null && left <= periodLaneEnds[row] + 4) row++;
        periodLaneEnds[row] = right;
        periodRowsById.set(event.id, row);
      });

      const pointRows = Math.max(1, rowIntervals.length);
      const periodRows = periodLaneEnds.length;
      const compactHeight = Math.max(
        64,
        AXIS_BLOCK_CLEARANCE * 2 + pointRows * 34 + (periodRows ? 12 + periodRows * 24 : 0)
      );
      const automaticHeight = Math.min(GROUP_LANE_HEIGHT, compactHeight);
      const explicitHeight = Number(state.expandedGroupHeights.get(category)) || 0;
      result.set(category, {
        category,
        pointRows,
        periodRows,
        pointRowsById,
        periodRowsById,
        automaticHeight,
        height: Math.max(automaticHeight, explicitHeight)
      });
    });

    state.adaptiveGroupLayout = result;
    return result;
  }

  function groupLaneLayout(axisY) {
    const enabledGroups = [...state.categories.keys()].filter(name => state.enabledCategories.has(name));
    const primary = enabledGroups.filter(name => isPrimaryCategory(name));
    const reference = enabledGroups.filter(name => !isPrimaryCategory(name));
    const metrics = computeAdaptiveGroupLayout();
    const bands = new Map();

    let primaryCursor = axisY - GROUP_LANE_AXIS_GAP;
    primary.forEach((category, index) => {
      const laneHeight = metrics.get(category)?.height || GROUP_LANE_HEIGHT;
      const bottom = primaryCursor;
      const top = bottom - laneHeight;
      bands.set(category, { category, isAbove: true, index, height: laneHeight, axisY, top, bottom, near: bottom, far: top });
      primaryCursor = top;
    });

    let referenceCursor = axisY + GROUP_LANE_AXIS_GAP;
    reference.forEach((category, index) => {
      const laneHeight = metrics.get(category)?.height || GROUP_LANE_HEIGHT;
      const top = referenceCursor;
      const bottom = top + laneHeight;
      bands.set(category, { category, isAbove: false, index, height: laneHeight, axisY, top, bottom, near: top, far: bottom });
      referenceCursor = bottom;
    });
    return bands;
  }

'''
js = js[:start] + replacement + js[end:]

# Give each group a very light version of its own color while retaining the
# existing stronger event/connector colors. Keep the tint deliberately subtle.
old = """      // Lane interiors are intentionally transparent; only the boundary and
      // caption identify the group so the canvas hue remains continuous.
      const boundaryY = band.isAbove ? band.top : band.bottom;"""
new = """      // A very light group tint provides spatial identity without competing
      // with the saturated event blocks and connectors.
      ctx.fillStyle = colorWithAlpha(color, dark ? 0.045 : 0.06);
      ctx.fillRect(0, visibleTop, width, Math.max(0, visibleBottom - visibleTop));
      const boundaryY = band.isAbove ? band.top : band.bottom;"""
assert old in js
js = js.replace(old,new,1)

# Only event/period BLOCKS are detail hit targets. Duration spans, anchor dots,
# and connector lines remain visual/navigation surfaces and cannot open details.
js = re.sub(r"\n\s*state\.hitTargets\.push\(\{ event, x1: clippedLeft, x2: clippedRight, y1: spanY - 5, y2: spanY \+ 5 \}\);", "", js)
js = re.sub(r"\n\s*state\.hitTargets\.push\(\{ event, x1: leaderX - 10, x2: leaderX \+ 10, y1: spanY - 10, y2: spanY \+ 10 \}\);", "", js)
js = re.sub(r"\n\s*state\.hitTargets\.push\(\{ event, x1: leaderX - 5, x2: leaderX \+ 5, y1: Math\.min\(spanY, leaderEndY\), y2: Math\.max\(spanY, leaderEndY\) \}\);", "", js)

# Radar desktop miniature now consumes the exact canonical adaptive packing
# metrics used to size the real lanes. This updates on every zoom because x
# collision packing is recomputed using the current view scale.
radar_start = js.index('      const verticalGeometry = overviewVerticalGeometry();')
radar_end = js.index('      const left = ((state.viewStart - dataMin) / span) * rect.width;', radar_start)
radar_block = r'''      const verticalGeometry = overviewVerticalGeometry();
      const radarBands = groupLaneLayout(0);
      const metrics = state.adaptiveGroupLayout;
      const worldToRadarY = worldY =>
        ((worldY - verticalGeometry.contentMin) / Math.max(1, verticalGeometry.contentSpan)) * rect.height;

      points.forEach(event => {
        const x = ((event.start - dataMin) / span) * rect.width;
        const band = radarBands.get(event.category);
        const metric = metrics.get(event.category);
        if (!band || !metric) return;
        const row = metric.pointRowsById.get(event.id) ?? 0;
        const worldY = band.isAbove
          ? band.bottom - AXIS_BLOCK_CLEARANCE - 13.5 - row * 34
          : band.top + AXIS_BLOCK_CLEARANCE + 13.5 + row * 34;
        const y = worldToRadarY(worldY);
        overviewCtx.fillStyle = event.color;
        overviewCtx.fillRect(Math.max(0, Math.min(rect.width - 1, x)), Math.max(0, Math.min(rect.height - 3, y - 2)), 2, 5);
      });

      periods.forEach(event => {
        const x1 = ((event.start - dataMin) / span) * rect.width;
        const x2 = ((event.end - dataMin) / span) * rect.width;
        const band = radarBands.get(event.category);
        const metric = metrics.get(event.category);
        if (!band || !metric) return;
        const row = metric.periodRowsById.get(event.id) ?? 0;
        const pointSection = metric.pointRows * 34;
        const offset = AXIS_BLOCK_CLEARANCE + pointSection + 12 + row * 24 + 8;
        const worldY = band.isAbove ? band.bottom - offset : band.top + offset;
        const y = worldToRadarY(worldY);
        overviewCtx.fillStyle = event.color;
        overviewCtx.fillRect(Math.max(0, Math.min(rect.width, x1)), Math.max(0, Math.min(rect.height - 3, y - 1)), Math.max(1, Math.min(rect.width, x2) - Math.max(0, x1)), 3);
      });

'''
js = js[:radar_start] + radar_block + js[radar_end:]

# Version sync.
(ROOT/'VERSION').write_text('2.8.6\n')
index = index.replace('2.8.5','2.8.6')
version_js = version_js.replace('2.8.5','2.8.6')
entry = '''### 2.8.6

Made group lanes zoom-adaptive downward: current zoom packing determines the compact lane height, while automatic growth remains capped at the established maximum and overflow continues to use disclosure controls; explicit disclosure expansion can still exceed the cap. Radar vertical positions now consume the same zoom-dependent packing metrics as the main canvas, so lane thickness and miniature event levels update with zoom. Added subtle group-color lane tinting while retaining stronger group colors on blocks/connectors. Restricted detail hit-testing to actual event/period blocks; duration spans, anchor dots, and connector lines no longer open details.

'''
if '### 2.8.6' not in readme:
    readme = readme.replace('## Version history\n\n','## Version history\n\n'+entry,1)

js_path.write_text(js)
css_path.write_text(css)
index_path.write_text(index)
version_path.write_text(version_js)
readme_path.write_text(readme)

final=js_path.read_text()
assert 'computeAdaptiveGroupLayout' in final
assert 'automaticHeight = Math.min(GROUP_LANE_HEIGHT' in final
assert 'state.adaptiveGroupLayout = result' in final
assert 'metric.pointRowsById.get(event.id)' in final
assert 'colorWithAlpha(color, dark ? 0.045 : 0.06)' in final
assert 'x1: leaderX - 5' not in final
assert 'x1: leaderX - 10' not in final
assert 'x1: clippedLeft, x2: clippedRight, y1: spanY - 5' not in final
assert 'v2.8.6' in index_path.read_text() and '?v=2.8.6' in index_path.read_text()
print('Chrona 2.8.6 patch applied')
