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

assert '2.8.6' in index


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
                    return source[:start] + replacement + source[i + 1:]
        i += 1
    raise AssertionError(f'unclosed function {name}')

# ---------------------------------------------------------------------------
# 1. Reset = useful Home view: densest enabled activity window, a practical
#    250/500/1000-year span, collapsed transient expansions, and vertically
#    centered active group content.
# ---------------------------------------------------------------------------
reset_fn = r'''  function resetView() {
    clearPointerInteraction();
    state.tooltipPinned = false;
    tooltip.classList.remove('is-pinned');
    tooltip.hidden = true;
    state.tooltipToken++;
    state.expandedGroupHeights.clear();
    state.forcedRevealEventIds.clear();
    if (!detailPanel.hidden) closeDetails();

    const points = state.events
      .filter(event =>
        event.visible &&
        event.elementType !== 'Period' &&
        Number.isFinite(event.start) &&
        state.enabledCategories.has(event.category)
      )
      .map(event => event.start)
      .sort((a, b) => a - b);

    if (!points.length) {
      showFullExtent(false);
      state.axisYRatio = DEFAULT_AXIS_Y_RATIO;
      localStorage.setItem('chrona-axis-y-ratio', String(state.axisYRatio));
      scheduleRender();
      return;
    }

    const candidateSpans = [250, 500, 1000];
    const targetCount = Math.min(points.length, Math.max(4, Math.ceil(points.length * 0.62)));
    let chosen = null;

    for (const span of candidateSpans) {
      let left = 0;
      let bestLeft = 0;
      let bestRight = 0;
      for (let right = 0; right < points.length; right++) {
        while (points[right] - points[left] > span && left < right) left++;
        if (right - left > bestRight - bestLeft) {
          bestLeft = left;
          bestRight = right;
        }
      }
      const count = bestRight - bestLeft + 1;
      const center = (points[bestLeft] + points[bestRight]) / 2;
      chosen = { span, count, center };
      if (count >= targetCount) break;
    }

    const span = chosen?.span || 1000;
    const center = chosen?.center ?? points[Math.floor(points.length / 2)];
    clampView(center - span / 2, center + span / 2);

    // Center the currently active vertical stack, not an arbitrary axis ratio.
    const viewportHeight = Math.max(1, viewport.clientHeight || window.innerHeight || 1);
    const bands = groupLaneLayout(0);
    let contentMin = 0;
    let contentMax = 0;
    for (const band of bands.values()) {
      contentMin = Math.min(contentMin, band.top);
      contentMax = Math.max(contentMax, band.bottom);
    }
    const contentCenter = (contentMin + contentMax) / 2;
    const rawAxisY = viewportHeight / 2 - contentCenter;
    state.axisYRatio = Math.max(
      DESKTOP_AXIS_MIN_RATIO,
      Math.min(DESKTOP_AXIS_MAX_RATIO, rawAxisY / viewportHeight)
    );
    localStorage.setItem('chrona-axis-y-ratio', String(state.axisYRatio));
    scheduleRender();
  }'''
js = replace_function(js, 'resetView', reset_fn)

# ---------------------------------------------------------------------------
# 2. Contextual zoom-rail trackpad: two-finger vertical scrolling over the
#    rail belongs exclusively to zoom and never pans the timeline underneath.
# ---------------------------------------------------------------------------
zoom_listener_anchor = "  zoomRail?.addEventListener('pointerenter', hideYearCursor);\n"
assert zoom_listener_anchor in js
zoom_wheel = r'''  zoomRail?.addEventListener('wheel', event => {
    event.preventDefault();
    event.stopPropagation();
    hideYearCursor();
    if (!event.deltaY) return;
    // Fine continuous zoom for MacBook trackpads and mouse wheels. Up zooms in,
    // down zooms out, centered on the current viewport.
    zoomAt(0.5, Math.exp(event.deltaY * 0.0025));
  }, { passive: false });
'''
js = js.replace(zoom_listener_anchor, zoom_wheel + zoom_listener_anchor, 1)

# ---------------------------------------------------------------------------
# 3. Adaptive lane geometry. Height is based only on content that actually
#    intersects the current horizontal viewport. Empty enabled groups collapse
#    to a label strip; one-row groups stay compact. Multiple groups cap at the
#    normal maximum; a sole group on a side has no automatic cap and never
#    needs overflow merely to protect nonexistent neighbors.
# ---------------------------------------------------------------------------
adaptive_fn = r'''  function computeAdaptiveGroupLayout(width = Math.max(1, viewport.clientWidth || 1)) {
    const threshold = labelThreshold(state.viewEnd - state.viewStart);
    const result = new Map();
    const enabledGroups = [...state.categories.keys()].filter(name => state.enabledCategories.has(name));
    const primaryGroups = enabledGroups.filter(name => isPrimaryCategory(name));
    const referenceGroups = enabledGroups.filter(name => !isPrimaryCategory(name));
    const visualTheme = document.documentElement.dataset.visualTheme || 'gradient';
    const isMetroTheme = visualTheme === 'metro';

    enabledGroups.forEach(category => {
      const soleSide = isPrimaryCategory(category)
        ? primaryGroups.length === 1
        : referenceGroups.length === 1;
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
        // A sole group reveals all of its visible records. Multi-group layouts
        // retain the Importance threshold and overflow behavior at wide zooms.
        if (!soleSide && (importanceRank[event.importance] || 2) < threshold) return;
        const x = timeToX(event.start, width);
        const preview = event.thumbnail || (looksLikeImage(event.media) ? event.media : '');
        const measured = measureEventLabelWidth(event.headline, event.importance === 'Major', Boolean(preview));
        const labelWidth = Math.min(360, Math.max(96, Math.min(measured, Math.max(96, width))));
        const left = isMetroTheme ? x - 1 : x;
        const right = left + labelWidth;
        if (right <= 0 || left >= width) return;
        let row = 0;
        while (true) {
          const intervals = rowIntervals[row] || [];
          if (!intervals.some(interval => left < interval.right + 8 && right > interval.left - 8)) break;
          row++;
        }
        if (!rowIntervals[row]) rowIntervals[row] = [];
        rowIntervals[row].push({ left, right });
        pointRowsById.set(event.id, row);
      });

      const periodLaneEnds = [];
      const periodRowsById = new Map();
      [...periods].sort((a, b) => a.start - b.start || (a.end || a.start) - (b.end || b.start)).forEach(event => {
        const left = Math.min(timeToX(event.start, width), timeToX(event.end, width));
        const right = Math.max(timeToX(event.start, width), timeToX(event.end, width));
        if (right < 0 || left > width) return;
        let row = 0;
        while (periodLaneEnds[row] != null && left <= periodLaneEnds[row] + 4) row++;
        periodLaneEnds[row] = right;
        periodRowsById.set(event.id, row);
      });

      const pointRows = rowIntervals.length;
      const periodRows = periodLaneEnds.length;
      let requiredHeight;
      if (!pointRows && !periodRows) {
        requiredHeight = 34;
      } else {
        let used = AXIS_BLOCK_CLEARANCE;
        if (pointRows) used += 27 + (pointRows - 1) * 34;
        if (periodRows) used += 12 + 28 + (periodRows - 1) * 36;
        used += pointRows && !periodRows ? AXIS_BLOCK_CLEARANCE : 4;
        requiredHeight = Math.max(34, Math.ceil(used));
      }

      const automaticHeight = soleSide
        ? requiredHeight
        : Math.min(GROUP_LANE_HEIGHT, requiredHeight);
      const explicitHeight = soleSide ? 0 : (Number(state.expandedGroupHeights.get(category)) || 0);
      result.set(category, {
        category,
        soleSide,
        pointRows,
        periodRows,
        pointRowsById,
        periodRowsById,
        requiredHeight,
        automaticHeight,
        height: Math.max(automaticHeight, explicitHeight)
      });
    });

    state.adaptiveGroupLayout = result;
    return result;
  }'''
js = replace_function(js, 'computeAdaptiveGroupLayout', adaptive_fn)

layout_fn = r'''  function groupLaneLayout(axisY) {
    const enabledGroups = [...state.categories.keys()].filter(name => state.enabledCategories.has(name));
    const primary = enabledGroups.filter(name => isPrimaryCategory(name));
    const reference = enabledGroups.filter(name => !isPrimaryCategory(name));
    const metrics = computeAdaptiveGroupLayout();
    const bands = new Map();

    let primaryCursor = axisY - GROUP_LANE_AXIS_GAP;
    primary.forEach((category, index) => {
      const metric = metrics.get(category);
      const laneHeight = metric?.height || 34;
      const bottom = primaryCursor;
      const top = bottom - laneHeight;
      bands.set(category, {
        category, isAbove: true, index, height: laneHeight, axisY,
        soleSide: Boolean(metric?.soleSide), top, bottom, near: bottom, far: top
      });
      primaryCursor = top;
    });

    let referenceCursor = axisY + GROUP_LANE_AXIS_GAP;
    reference.forEach((category, index) => {
      const metric = metrics.get(category);
      const laneHeight = metric?.height || 34;
      const top = referenceCursor;
      const bottom = top + laneHeight;
      bands.set(category, {
        category, isAbove: false, index, height: laneHeight, axisY,
        soleSide: Boolean(metric?.soleSide), top, bottom, near: top, far: bottom
      });
      referenceCursor = bottom;
    });
    return bands;
  }'''
js = replace_function(js, 'groupLaneLayout', layout_fn)

old_show = "      let showLabel = (importanceRank[event.importance] || 2) >= threshold;"
assert old_show in js
js = js.replace(old_show, "      let showLabel = Boolean(band?.soleSide) || (importanceRank[event.importance] || 2) >= threshold;", 1)

# Never create overflow controls for a group that is the sole group on its side.
overflow_loop = "    for (const item of state.pendingOverflow) {\n      if (item.x < -8 || item.x > width + 8) continue;"
assert overflow_loop in js
js = js.replace(
    overflow_loop,
    "    for (const item of state.pendingOverflow) {\n      if (state.adaptiveGroupLayout.get(item.category)?.soleSide) continue;\n      if (item.x < -8 || item.x > width + 8) continue;",
    1
)

# Lane tint itself defines the boundary; remove the darker frame line.
boundary_pattern = re.compile(
    r"      const boundaryY = band\.isAbove \? band\.top : band\.bottom;\n"
    r"      if \(boundaryY >= 0 && boundaryY <= height\) \{\n"
    r"        ctx\.strokeStyle = colorWithAlpha\(color, dark \? 0\.24 : 0\.18\);\n"
    r"        ctx\.lineWidth = 1;\n"
    r"        ctx\.beginPath\(\);\n"
    r"        ctx\.moveTo\(0, Math\.round\(boundaryY\) \+ 0\.5\);\n"
    r"        ctx\.lineTo\(width, Math\.round\(boundaryY\) \+ 0\.5\);\n"
    r"        ctx\.stroke\(\);\n"
    r"      \}\n"
)
js, n = boundary_pattern.subn("      // No darker frame: adjacent lane tints define the group boundary.\n", js, count=1)
assert n == 1, 'lane boundary replacement failed'

# ---------------------------------------------------------------------------
# 4. Chronological List: show a year heading once per year and strip that same
#    year from the secondary month/day text. Cross-year ranges retain the end year.
# ---------------------------------------------------------------------------
list_date_fn = r'''  function listDateMarkup(event, showYear = true) {
    const year = formatYear(event.start);
    let display = localizedDisplayDate(event) || event.displayDate || year;
    const startYear = String(event.sourceYear || Math.floor(Number(event.start)));
    const endYear = String(event.sourceEndYear || '');

    if (state.language === 'zh-TW' || state.language === 'zh-CN') {
      display = display.replace(`${startYear}年`, '');
      if (!endYear || endYear === startYear) display = display.replaceAll(`${startYear}年`, '');
    } else if (state.language.startsWith('en')) {
      display = display.replaceAll(`, ${startYear}`, '').replaceAll(` ${startYear}`, '');
      if (endYear && endYear !== startYear) {
        // Preserve a cross-year endpoint if the broad replacement removed it.
        const endToken = String(event.sourceEndYear || '');
        if (endToken && !display.includes(endToken)) display = `${display}–${endToken}`;
      }
    }

    display = compactCjkLatinSpacing(display).trim();
    const secondary = !display || display === year ? '' : `<span>${escapeHtml(display)}</span>`;
    const heading = showYear
      ? `<strong>${escapeHtml(year)}</strong>`
      : '<strong class="is-repeated-year" aria-hidden="true"></strong>';
    return `${heading}${secondary}`;
  }'''
js = replace_function(js, 'listDateMarkup', list_date_fn)

render_start = "    const fragment = document.createDocumentFragment();\n    for (const event of events) {"
assert render_start in js
js = js.replace(
    render_start,
    "    const fragment = document.createDocumentFragment();\n    let previousListYear = null;\n    for (const event of events) {\n      const listYear = formatYear(event.start);\n      const showListYear = listYear !== previousListYear;\n      previousListYear = listYear;",
    1
)
assert '<div class=\\"list-view-date\\">${listDateMarkup(event)}</div>' in js
js = js.replace(
    '<div class=\\"list-view-date\\">${listDateMarkup(event)}</div>',
    '<div class=\\"list-view-date\\">${listDateMarkup(event, showListYear)}</div>',
    1
)

# ---------------------------------------------------------------------------
# 5. Connector architecture: all leaders live behind every event/period block.
#    When the axis is sticky at the top, suppress leaders from upper/offscreen
#    groups; when sticky at bottom, suppress leaders from lower/offscreen groups.
# ---------------------------------------------------------------------------
leader_fn = r'''  function drawLeaderLines(axisY) {
    if (!state.pendingLeaders.length) return;
    const height = Math.max(1, viewport.getBoundingClientRect().height);
    const rawAxisY = height * state.axisYRatio;
    const stickyTop = rawAxisY < AXIS_STICKY_TOP_INSET;
    const stickyBottom = rawAxisY > height - AXIS_STICKY_BOTTOM_INSET;

    for (const leader of state.pendingLeaders) {
      const belongsAbove = isPrimaryCategory(leader.event.category);
      if ((stickyTop && belongsAbove) || (stickyBottom && !belongsAbove)) continue;
      leaderCtx.save();
      leaderCtx.strokeStyle = colorWithAlpha(leader.event.color, 1);
      leaderCtx.lineWidth = 2;
      leaderCtx.lineCap = 'butt';
      leaderCtx.beginPath();
      leaderCtx.moveTo(leader.x, leader.y1);
      leaderCtx.lineTo(leader.x, leader.y2);
      leaderCtx.stroke();
      leaderCtx.restore();
    }
  }'''
js = replace_function(js, 'drawLeaderLines', leader_fn)

# ---------------------------------------------------------------------------
# CSS: put the leader canvas beneath the painted timeline canvas, disable the
# label-layer connector pseudo-elements, and preserve list-date rhythm when a
# repeated year heading is intentionally blank.
# ---------------------------------------------------------------------------
css = css.replace('.leader-canvas { pointer-events: none; z-index: 1; }', '.leader-canvas { pointer-events: none; z-index: 0; }', 1)
if '#timelineCanvas { z-index: 1; }' not in css:
    css += '''\n\n/* Chrona v2.8.7 — connector and chronological-list layering. */\n#timelineCanvas { z-index: 1; }\n.event-label-above:not(.period-label)::before,\n.event-label-below:not(.period-label)::before { display: none !important; }\n.list-view-date strong.is-repeated-year { visibility: hidden; }\n'''

# ---------------------------------------------------------------------------
# Version sync and release notes.
# ---------------------------------------------------------------------------
(ROOT / 'VERSION').write_text('2.8.7\n')
index = index.replace('2.8.6', '2.8.7')
version_js = version_js.replace('2.8.6', '2.8.7')
entry = '''### 2.8.7\n\nRefined Home/Reset to choose a dense enabled-event window at a practical 250/500/1000-year span and vertically center the active stack. Trackpad/wheel input over the zoom rail now performs fine continuous zoom instead of panning the timeline. Adaptive group lanes now use only currently intersecting content: empty groups collapse to a label strip, one-row groups stay compact, multi-group lanes cap at the normal maximum, and a sole group on one side expands enough to reveal all visible records without overflow controls. Removed darker lane borders. Chronological List now shows each year heading once and uses month/day detail for subsequent same-year entries. All connector lines render behind event/period blocks, and connectors from the scrolled-away side are suppressed while the axis is sticky at the top or bottom.\n\n'''
if '### 2.8.7' not in readme:
    readme = readme.replace('## Version history\n\n', '## Version history\n\n' + entry, 1)

js_path.write_text(js)
css_path.write_text(css)
index_path.write_text(index)
version_path.write_text(version_js)
readme_path.write_text(readme)

# Validation assertions before CI's node --check.
final_js = js_path.read_text()
final_css = css_path.read_text()
assert 'const candidateSpans = [250, 500, 1000];' in final_js
assert "zoomRail?.addEventListener('wheel'" in final_js
assert 'soleSide' in final_js
assert 'requiredHeight = 34;' in final_js
assert 'state.adaptiveGroupLayout.get(item.category)?.soleSide' in final_js
assert 'listDateMarkup(event, showListYear)' in final_js
assert 'const stickyTop = rawAxisY < AXIS_STICKY_TOP_INSET;' in final_js
assert '.leader-canvas { pointer-events: none; z-index: 0; }' in final_css
assert 'display: none !important' in final_css
assert 'v2.8.7' in index_path.read_text() and '?v=2.8.7' in index_path.read_text()
print('Chrona 2.8.7 patch applied')
