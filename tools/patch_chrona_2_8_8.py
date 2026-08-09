from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
js_path = ROOT / 'timeline.js'
css_path = ROOT / 'styles.css'
index_path = ROOT / 'index.html'
version_path = ROOT / 'VERSION'
version_js_path = ROOT / 'version.js'
readme_path = ROOT / 'README.md'

js = js_path.read_text()
css = css_path.read_text()
index = index_path.read_text()
readme = readme_path.read_text()
version_js = version_js_path.read_text()

assert '2.8.7' in index

# ---------------------------------------------------------------------------
# 1. Persistent Lane-keeping toggle in the right end of the visible-group row.
# ---------------------------------------------------------------------------
js = js.replace(
    "  const TRANSLATION_SESSION_KEY = 'chrona-translation-session-v1';\n",
    "  const TRANSLATION_SESSION_KEY = 'chrona-translation-session-v1';\n  const LANE_KEEPING_STORAGE_KEY = 'chrona-lane-keeping';\n",
    1
)
js = js.replace(
    "  const listViewSummary = document.getElementById('listViewSummary');\n",
    "  const listViewSummary = document.getElementById('listViewSummary');\n  const laneKeepingToggle = document.getElementById('laneKeepingToggle');\n",
    1
)
js = js.replace(
    "    aboveGroups: new Set(),\n",
    "    aboveGroups: new Set(),\n    laneKeeping: localStorage.getItem(LANE_KEEPING_STORAGE_KEY) !== 'false',\n",
    1
)

listener_anchor = "  applyTheme(savedTheme);\n  applyVisualTheme(savedVisualTheme);\n"
assert listener_anchor in js
js = js.replace(listener_anchor, listener_anchor + """  function syncLaneKeepingToggle() {
    if (!laneKeepingToggle) return;
    laneKeepingToggle.checked = Boolean(state.laneKeeping);
    laneKeepingToggle.setAttribute('aria-checked', String(state.laneKeeping));
    document.documentElement.dataset.laneKeeping = state.laneKeeping ? 'on' : 'off';
  }
  syncLaneKeepingToggle();
  laneKeepingToggle?.addEventListener('change', () => {
    state.laneKeeping = Boolean(laneKeepingToggle.checked);
    localStorage.setItem(LANE_KEEPING_STORAGE_KEY, String(state.laneKeeping));
    state.expandedGroupHeights.clear();
    state.forcedRevealEventIds.clear();
    syncLaneKeepingToggle();
    scheduleRender();
  });
""", 1)

index_anchor = """    <div class=\"visible-sets-control\">\n      <span class=\"visible-sets-label\" data-i18n=\"toolbar.visible\">Visible</span>\n      <div id=\"categoryQuickFilters\" class=\"category-quick-filters\" aria-label=\"Visible timeline group toggles\"></div>\n    </div>\n"""
assert index_anchor in index
index = index.replace(index_anchor, index_anchor + """    <label class=\"lane-keeping-control\" for=\"laneKeepingToggle\" title=\"Keep each group in its own lane\">\n      <span>Lane-keeping</span>\n      <input id=\"laneKeepingToggle\" type=\"checkbox\" role=\"switch\" aria-label=\"Lane-keeping\" checked />\n      <i aria-hidden=\"true\"></i>\n    </label>\n""", 1)

# ---------------------------------------------------------------------------
# 2. Lane height must come from current visible packing only. Old explicit
#    expansion stops being a permanent floor once current zoom no longer needs it.
# ---------------------------------------------------------------------------
old_explicit = "      const explicitHeight = soleSide ? 0 : (Number(state.expandedGroupHeights.get(category)) || 0);"
new_explicit = "      const explicitHeight = (!soleSide && requiredHeight > GROUP_LANE_HEIGHT) ? (Number(state.expandedGroupHeights.get(category)) || 0) : 0;"
assert old_explicit in js
js = js.replace(old_explicit, new_explicit, 1)

# Carry exact packing facts into each band so rendering does not re-estimate
# whether a one-row lane has room for one row.
js = js.replace(
    "        soleSide: Boolean(metric?.soleSide), top, bottom, near: bottom, far: top\n",
    "        soleSide: Boolean(metric?.soleSide), pointRows: metric?.pointRows || 0, requiredHeight: metric?.requiredHeight || laneHeight, top, bottom, near: bottom, far: top\n",
    1
)
js = js.replace(
    "        soleSide: Boolean(metric?.soleSide), top, bottom, near: top, far: bottom\n",
    "        soleSide: Boolean(metric?.soleSide), pointRows: metric?.pointRows || 0, requiredHeight: metric?.requiredHeight || laneHeight, top, bottom, near: top, far: bottom\n",
    1
)

# ---------------------------------------------------------------------------
# 3. Mixed-group renderer: recover the compact shared packing behavior while
#    keeping the modern axis, details, keyboard, zoom, and sticky infrastructure.
# ---------------------------------------------------------------------------

def replace_function(source, name, replacement):
    marker = f"  function {name}("
    start = source.index(marker)
    brace = source.index('{', start)
    depth = 0
    i = brace
    while i < len(source):
        ch = source[i]
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                return source[:start] + replacement.rstrip() + source[end:]
        i += 1
    raise RuntimeError(f'unclosed function {name}')

new_draw_events = r'''  function drawEvents(width, height, contentAxisY, displayAxisY = contentAxisY) {
    const candidates = state.events.filter(event =>
      event.elementType !== 'Title' && state.enabledCategories.has(event.category)
    );
    const threshold = labelThreshold(state.viewEnd - state.viewStart);

    if (!state.laneKeeping) {
      // Compact legacy-style packing: groups share rows on each side of the
      // axis. Group color remains on each block/connector, but no lane tint,
      // lane caption, or overflow disclosure is drawn.
      const above = candidates.filter(event => isPrimaryCategory(event.category));
      const below = candidates.filter(event => !isPrimaryCategory(event.category));
      const abovePoints = above.filter(event => event.elementType !== 'Period');
      const belowPoints = below.filter(event => event.elementType !== 'Period');
      const abovePeriods = above.filter(event => event.elementType === 'Period' && event.end != null);
      const belowPeriods = below.filter(event => event.elementType === 'Period' && event.end != null);

      const abovePointLanes = drawPointRows(abovePoints, width, height, displayAxisY, true, threshold, null, contentAxisY, true);
      const belowPointLanes = drawPointRows(belowPoints, width, height, displayAxisY, false, threshold, null, contentAxisY, true);
      drawLeaderLines(displayAxisY);
      state.pendingLeadersDrawn = true;
      drawPeriodRows(abovePeriods, width, height, contentAxisY, threshold, true, abovePointLanes, null);
      drawPeriodRows(belowPeriods, width, height, contentAxisY, threshold, false, belowPointLanes, null);
      return;
    }

    const bands = groupLaneLayout(contentAxisY);
    drawGroupLaneBands(width, height, bands);

    const pointLaneCounts = new Map();
    for (const band of bands.values()) {
      const groupEvents = candidates.filter(event => event.category === band.category);
      const points = groupEvents.filter(event => event.elementType !== 'Period');
      const pointLaneCount = drawPointRows(points, width, height, displayAxisY, band.isAbove, threshold, band, contentAxisY, false);
      pointLaneCounts.set(band.category, pointLaneCount);
    }

    drawLeaderLines(displayAxisY);
    state.pendingLeadersDrawn = true;

    for (const band of bands.values()) {
      const periods = candidates.filter(event =>
        event.category === band.category && event.elementType === 'Period' && event.end != null
      );
      drawPeriodRows(
        periods,
        width,
        height,
        contentAxisY,
        threshold,
        band.isAbove,
        pointLaneCounts.get(band.category) || 0,
        band
      );
    }
  }'''
js = replace_function(js, 'drawEvents', new_draw_events)

# Helper used before any anchor component is queued/painted.
helper = r'''
  function eventAnchorSideSuppressed(isAbove, height) {
    const rawAxisY = Math.max(1, height) * state.axisYRatio;
    const stickyTop = rawAxisY < AXIS_STICKY_TOP_INSET;
    const stickyBottom = rawAxisY > height - AXIS_STICKY_BOTTOM_INSET;
    return (stickyTop && isAbove) || (stickyBottom && !isAbove);
  }
'''
insert_at = js.index("  function drawPointRows(")
js = js[:insert_at] + helper + "\n" + js[insert_at:]

# drawPointRows: separate sticky anchor axis from scrolling layout axis; mixed
# mode gets effectively unlimited shared rows. Lane mode consumes exact row facts.
js = js.replace(
    "  function drawPointRows(events, width, height, axisY, isAbove, threshold, band = null) {",
    "  function drawPointRows(events, width, height, axisY, isAbove, threshold, band = null, contentAxisY = axisY, unlimited = false) {",
    1
)
old_capacity = """    const maxLabelLanes = band
      ? Math.max(0, Math.floor(((band.height || GROUP_LANE_HEIGHT) - 26) / 34))
      : isAbove
        ? Math.max(0, Math.floor((axisY - 60) / 34) + 1)
        : Math.max(0, Math.floor((height - axisY - 65) / 34) + 1);"""
new_capacity = """    const maxLabelLanes = unlimited
      ? 128
      : band
        ? (band.requiredHeight <= band.height + 0.5
          ? band.pointRows
          : Math.max(band.pointRows ? 1 : 0, Math.floor(((band.height || GROUP_LANE_HEIGHT) - 26) / 34)))
        : isAbove
          ? Math.max(0, Math.floor((axisY - 60) / 34) + 1)
          : Math.max(0, Math.floor((height - axisY - 65) / 34) + 1);"""
assert old_capacity in js
js = js.replace(old_capacity, new_capacity, 1)

# Once a block is not actually rendered, none of its anchor bundle exists.
needle = """      if (labelRight <= 0 || labelLeft >= width) return;

      let lane = 0;"""
replacement = """      if (labelRight <= 0 || labelLeft >= width) return;
      if (eventAnchorSideSuppressed(isAbove, height)) return;

      let lane = 0;"""
assert needle in js
js = js.replace(needle, replacement, 1)

needle = "      if (!showLabel) recordOverflowEvent(event, x, isAbove, band);\n\n      const labelHeight = 27;"
replacement = """      if (!showLabel) {
        recordOverflowEvent(event, x, isAbove, band);
        return;
      }

      const labelHeight = 27;"""
assert needle in js
js = js.replace(needle, replacement, 1)

# Mixed rows scroll with the natural/content axis while their anchor terminates
# at the sticky display axis.
js = js.replace(
    "        : (isAbove ? axisY - 58 - lane * laneGap : axisY + 36 + lane * laneGap);",
    "        : (isAbove ? contentAxisY - 58 - lane * laneGap : contentAxisY + 36 + lane * laneGap);",
    1
)

# ---------------------------------------------------------------------------
# 4. Physical layer order: leaders below timeline blocks, DOM blocks above both.
# ---------------------------------------------------------------------------
css = css.replace(
    ".label-layer { pointer-events: none; overflow: hidden; z-index: 2; }\n.leader-canvas { pointer-events: none; z-index: 0; }",
    "#timelineCanvas { z-index: 1; }\n.label-layer { pointer-events: none; overflow: hidden; z-index: 2; }\n.leader-canvas { pointer-events: none; z-index: 0; }",
    1
)

# ---------------------------------------------------------------------------
# 5. Toolbar switch styling and responsive behavior.
# ---------------------------------------------------------------------------
css += r'''

/* Chrona 2.8.8 — lane-keeping / mixed-group presentation switch */
.visible-sets-control {
  flex: 1 1 auto;
  min-width: 0;
}
.lane-keeping-control {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  user-select: none;
}
.lane-keeping-control input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.lane-keeping-control i {
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: color-mix(in srgb, var(--surface-soft) 88%, transparent);
  box-shadow: inset 0 1px 2px rgba(15,23,42,.08);
  transition: background-color 150ms ease, border-color 150ms ease;
}
.lane-keeping-control i::after {
  content: "";
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  top: 2px;
  border-radius: 50%;
  background: var(--surface-solid);
  box-shadow: 0 1px 3px rgba(15,23,42,.25);
  transition: transform 150ms ease;
}
.lane-keeping-control input:checked + i {
  background: #34c759;
  border-color: color-mix(in srgb, #34c759 72%, var(--border-strong));
}
.lane-keeping-control input:checked + i::after { transform: translateX(14px); }
.lane-keeping-control input:focus-visible + i { box-shadow: 0 0 0 3px var(--focus); }
@media (max-width: 760px) {
  .lane-keeping-control span { display: none; }
}
'''

# ---------------------------------------------------------------------------
# 6. Version sync / README.
# ---------------------------------------------------------------------------
index = index.replace('2.8.7', '2.8.8')
version_js = re.sub(r"CHRON[A-Z_]*VERSION\s*=\s*['\"]2\.8\.7['\"]", lambda m: m.group(0).replace('2.8.7','2.8.8'), version_js)
version_js = version_js.replace('2.8.7', '2.8.8')
readme_entry = """### 2.8.8
- Added a persistent Lane-keeping toggle beside the visible-group pills. Off restores compact mixed-group packing; on keeps separated group lanes.
- Fixed adaptive lane sizing so one visible row always receives one render row and stale cluster expansion no longer leaves oversized empty lanes after zoom/pan changes.
- Treat event blocks, leaders, dots, spans, and event-year labels as one render bundle: if the block is hidden, overflowed, or suppressed at a sticky edge, its anchor artifacts are also hidden.
- Put the timeline block canvas physically above the leader canvas so unrelated connector lines cannot cut through period/event blocks.

"""
if '### 2.8.8' not in readme:
    marker = re.search(r'^### 2\.8\.7', readme, flags=re.M)
    if marker:
        readme = readme[:marker.start()] + readme_entry + readme[marker.start():]
    else:
        readme += '\n' + readme_entry

js_path.write_text(js)
css_path.write_text(css)
index_path.write_text(index)
version_path.write_text('2.8.8\n')
version_js_path.write_text(version_js)
readme_path.write_text(readme)
print('Chrona 2.8.8 patch applied')
