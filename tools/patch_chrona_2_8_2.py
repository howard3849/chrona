from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
js_path = ROOT / 'timeline.js'
css_path = ROOT / 'styles.css'
index_path = ROOT / 'index.html'
readme_path = ROOT / 'README.md'
version_path = ROOT / 'version.js'

js = js_path.read_text()
css = css_path.read_text()
index = index_path.read_text()
readme = readme_path.read_text()
version_js = version_path.read_text()

assert '2.8.1' in index
assert 'const GROUP_LANE_EXPAND_STEP = 34;' in js
assert 'expandedGroupHeights: new Map(),' in js

# ---------------------------------------------------------------------------
# Dedicated foreground axis layers.
# ---------------------------------------------------------------------------
js = js.replace(
"  const leaderCanvas = document.getElementById('leaderCanvas');\n  const leaderCtx = leaderCanvas.getContext('2d');\n",
"  const leaderCanvas = document.getElementById('leaderCanvas');\n  const leaderCtx = leaderCanvas.getContext('2d');\n  const axisCanvas = document.getElementById('axisCanvas');\n  const axisCtx = axisCanvas.getContext('2d');\n  const axisLabelLayer = document.getElementById('axisLabelLayer');\n"
)

js = js.replace(
"    expandedGroupHeights: new Map(),\n    renderQueued: false,",
"    expandedGroupHeights: new Map(),\n    groupHeightAnimation: null,\n    forcedRevealEventIds: new Set(),\n    renderQueued: false,"
)

js = js.replace(
"    state.expandedGroupHeights.clear();\n    const times = state.events.flatMap(e => [e.start, e.end]).filter(v => v != null);",
"    state.expandedGroupHeights.clear();\n    state.forcedRevealEventIds.clear();\n    if (state.groupHeightAnimation) cancelAnimationFrame(state.groupHeightAnimation);\n    state.groupHeightAnimation = null;\n    const times = state.events.flatMap(e => [e.start, e.end]).filter(v => v != null);"
)

# Group lanes remain geometrically defined but visually transparent. Keep only
# separator and caption cues so the parchment/background hue flows through.
fill_pattern = re.compile(
    r"\n      // A restrained tint and far-edge separator make each group read as its own\n"
    r"      // lane without turning the timeline into a grid of heavy boxes\.\n"
    r"      ctx\.fillStyle = colorWithAlpha\(color, dark \? 0\.035 : 0\.025\);\n"
    r"      ctx\.fillRect\(0, visibleTop, width, Math\.max\(0, visibleBottom - visibleTop\)\);"
)
js, count = fill_pattern.subn(
    "\n      // Lane interiors are intentionally transparent; only the boundary and\n"
    "      // caption identify the group so the canvas hue remains continuous.",
    js,
    count=1
)
assert count == 1, 'transparent lane patch failed'

# Prioritize a cluster the user explicitly asked to reveal, while preserving
# Importance/date/ID ordering for all other events. This guarantees that added
# rows are used to expose the clicked cluster before unrelated overflow.
old_sort = """    const sorted = [...events].sort((a, b) =>
      (importanceRank[b.importance] || 2) - (importanceRank[a.importance] || 2) ||
      a.start - b.start ||
      String(a.id || '').localeCompare(String(b.id || ''))
    );"""
new_sort = """    const sorted = [...events].sort((a, b) =>
      Number(state.forcedRevealEventIds.has(b.id)) - Number(state.forcedRevealEventIds.has(a.id)) ||
      (importanceRank[b.importance] || 2) - (importanceRank[a.importance] || 2) ||
      a.start - b.start ||
      String(a.id || '').localeCompare(String(b.id || ''))
    );"""
assert js.count(old_sort) >= 2, 'expected point and period sort blocks'
js = js.replace(old_sort, new_sort)

# Replace fixed-step expansion with animated, cluster-guaranteed expansion.
expand_pattern = re.compile(r"  function expandOverflowGroup\(category, hiddenCount\) \{.*?\n  \}\n\n  function drawOverflowCues", re.S)
expand_replacement = '''  function animateGroupHeight(category, targetHeight, onDone = null) {
    if (!category) return;
    if (state.groupHeightAnimation) cancelAnimationFrame(state.groupHeightAnimation);
    const from = groupLaneHeight(category);
    const to = Math.max(from, targetHeight);
    if (to <= from + 0.5) {
      onDone?.();
      return;
    }
    const started = performance.now();
    const duration = 280;
    const ease = t => 1 - Math.pow(1 - t, 3);

    const frame = now => {
      const progress = Math.min(1, (now - started) / duration);
      state.expandedGroupHeights.set(category, from + (to - from) * ease(progress));
      scheduleRender();
      if (progress < 1) {
        state.groupHeightAnimation = requestAnimationFrame(frame);
      } else {
        state.groupHeightAnimation = null;
        state.expandedGroupHeights.set(category, to);
        scheduleRender();
        onDone?.();
      }
    };
    state.groupHeightAnimation = requestAnimationFrame(frame);
  }

  function ensureOverflowClusterRevealed(category, eventIds, attempt = 0) {
    if (!category || !eventIds?.size || attempt > 4) return;
    scheduleRender();
    requestAnimationFrame(() => {
      const remaining = state.pendingOverflow.filter(item =>
        item.category === category && eventIds.has(item.event?.id)
      );
      if (!remaining.length) return;
      const current = groupLaneHeight(category);
      const extraRows = Math.max(2, remaining.length + 1);
      animateGroupHeight(
        category,
        current + extraRows * GROUP_LANE_EXPAND_STEP,
        () => ensureOverflowClusterRevealed(category, eventIds, attempt + 1)
      );
    });
  }

  function expandOverflowGroup(category, items) {
    if (!category || !items?.length) return;
    const eventIds = new Set(items.map(item => item.event?.id).filter(Boolean));
    eventIds.forEach(id => state.forcedRevealEventIds.add(id));

    // Add enough rows for the clicked cluster in the worst case (one event per
    // row), plus one breathing row. The whole group is repacked on every frame,
    // so neighboring clusters automatically shrink/disappear whenever the new
    // space also accommodates them.
    const current = groupLaneHeight(category);
    const extraRows = Math.max(2, items.length + 1);
    animateGroupHeight(
      category,
      current + extraRows * GROUP_LANE_EXPAND_STEP,
      () => ensureOverflowClusterRevealed(category, eventIds)
    );
  }

  function drawOverflowCues'''
js, count = expand_pattern.subn(expand_replacement, js, count=1)
assert count == 1, 'animated expansion patch failed'

# Direction-aware premium disclosure: above-axis clusters point up because the
# lane expands upward; below-axis clusters point down. Pass the complete cluster
# into the expansion routine rather than only its count.
old_icon = '''      // Premium editorial disclosure pattern: a small caret plus a separate,
      // legible count. The number never sits in or touches the caret valley.
      cue.innerHTML = `<svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true" focusable="false"><path d="M1 1 L5 5 L9 1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg><span style="font:700 10px/1 -apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;min-width:10px;text-align:center">${items.length}</span>`;
      cue.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        expandOverflowGroup(category, items.length);
      });'''
new_icon = '''      // Editorial disclosure caret points toward the direction in which this
      // group will grow: primary/above groups expand up; reference groups down.
      // The count is separate from the caret valley for clean legibility.
      const caretPath = items[0].isAbove ? 'M1 5 L5 1 L9 5' : 'M1 1 L5 5 L9 1';
      cue.innerHTML = `<svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true" focusable="false"><path d="${caretPath}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg><span style="font:700 10px/1 -apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;min-width:10px;text-align:center">${items.length}</span>`;
      cue.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        expandOverflowGroup(category, items);
      });'''
assert old_icon in js, 'overflow icon block not found'
js = js.replace(old_icon, new_icon, 1)

# Event-year labels are part of the foreground axis system. Never discard one
# merely because a scrolling event block passes underneath it; only de-conflict
# event-year labels against one another.
js = js.replace(
"      const overlapsLabel = state.eventLabelZones.some(zone =>\n        box.x1 < zone.x2 + 3 && box.x2 > zone.x1 - 3 && box.y1 < zone.y2 + 3 && box.y2 > zone.y1 - 3\n      );\n",
""
)
js = js.replace(
"      if (overlapsLabel || overlapsYear) continue;",
"      if (overlapsYear) continue;"
)
js = js.replace("      labelLayer.appendChild(year);", "      axisLabelLayer.appendChild(year);")

# Axis and tick rendering can target the dedicated foreground canvas.
axis_pattern = re.compile(r"  function drawAxis\(width, axisY\) \{.*?\n  \}\n\n  function chooseTickStep", re.S)
axis_replacement = '''  function drawAxis(width, axisY, paintCtx = ctx) {
    paintCtx.save();
    // A restrained translucent strip makes scrolling blocks visibly pass behind
    // the axis HUD while preserving the parchment tone underneath.
    paintCtx.fillStyle = cssVar('--surface-axis-band', 'rgba(218,224,234,.52)');
    paintCtx.fillRect(0, Math.max(0, axisY - 30), width, 60);
    paintCtx.strokeStyle = cssVar('--axis', '#30363d');
    paintCtx.lineWidth = document.documentElement.dataset.theme === 'dark' ? 3 : 2;
    paintCtx.beginPath();
    paintCtx.moveTo(0, axisY + 0.5);
    paintCtx.lineTo(width, axisY + 0.5);
    paintCtx.stroke();
    paintCtx.restore();
  }

  function chooseTickStep'''
js, count = axis_pattern.subn(axis_replacement, js, count=1)
assert count == 1, 'drawAxis refactor failed'

ticks_pattern = re.compile(r"  function drawTicks\(width, axisY\) \{.*?\n  \}\n\n  function formatFineDate", re.S)
ticks_replacement = '''  function drawTicks(width, axisY, paintCtx = ctx) {
    const span = state.viewEnd - state.viewStart;
    const majorStep = chooseTickStep(span, width);
    const minorStep = chooseMinorTickStep(majorStep);
    const firstMinor = Math.floor(state.viewStart / minorStep) * minorStep;
    const viewportHeight = Math.max(1, viewport.clientHeight || 1);
    const labelsBelow = axisY <= viewportHeight - 30;

    paintCtx.save();
    paintCtx.font = '12px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    paintCtx.textAlign = 'center';
    paintCtx.textBaseline = labelsBelow ? 'top' : 'bottom';

    for (let value = firstMinor; value <= state.viewEnd + minorStep; value += minorStep) {
      const x = timeToX(value, width);
      if (x < -20 || x > width + 20) continue;
      const majorIndex = Math.round(value / majorStep);
      const isMajor = Math.abs(value - majorIndex * majorStep) < minorStep * 0.05;
      paintCtx.strokeStyle = isMajor ? cssVar('--tick-major', '#68717b') : cssVar('--tick-minor', '#c4cbd2');
      paintCtx.lineWidth = isMajor ? 1.1 : 0.7;
      paintCtx.beginPath();
      paintCtx.moveTo(x, axisY - (isMajor ? 8 : 4));
      paintCtx.lineTo(x, axisY + (isMajor ? 8 : 4));
      paintCtx.stroke();
      if (isMajor) {
        const collidesWithEventYear = state.eventYearZones.some(zone =>
          zone.side === (labelsBelow ? 'below' : 'above') && Math.abs(zone.x - x) < Math.max(24, zone.width / 2 + 10)
        );
        if (!collidesWithEventYear) {
          paintCtx.fillStyle = cssVar('--text-muted', '#69717d');
          const label = majorStep < 1 ? formatFineDate(value, majorStep) : formatYear(value);
          paintCtx.fillText(label, x, labelsBelow ? axisY + 11 : axisY - 11);
        }
      }
    }

    const titleBelow = axisY < 26;
    paintCtx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    paintCtx.textAlign = 'left';
    paintCtx.textBaseline = titleBelow ? 'top' : 'bottom';
    paintCtx.fillStyle = cssVar('--text', '#17191c');
    paintCtx.fillText(
      state.viewEnd < 0 ? 'YEAR (BCE)' : state.viewStart >= 1 ? 'YEAR (CE)' : 'YEAR (BCE / CE)',
      12,
      titleBelow ? axisY + 13 : axisY - 13
    );
    paintCtx.restore();
  }

  function formatFineDate'''
js, count = ticks_pattern.subn(ticks_replacement, js, count=1)
assert count == 1, 'drawTicks refactor failed'

# Desktop render: base content first, then the foreground axis HUD and its
# labels. The axis therefore remains above blocks in both normal and sticky
# states. The axis canvas is independent of the scrolling content canvas.
render_old = '''    leaderCanvas.width = Math.round(rect.width * state.dpr);
    leaderCanvas.height = Math.round(rect.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    leaderCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    leaderCtx.clearRect(0, 0, rect.width, rect.height);
    labelLayer.replaceChildren();'''
render_new = '''    leaderCanvas.width = Math.round(rect.width * state.dpr);
    leaderCanvas.height = Math.round(rect.height * state.dpr);
    axisCanvas.width = Math.round(rect.width * state.dpr);
    axisCanvas.height = Math.round(rect.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    leaderCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    axisCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    leaderCtx.clearRect(0, 0, rect.width, rect.height);
    axisCtx.clearRect(0, 0, rect.width, rect.height);
    labelLayer.replaceChildren();
    axisLabelLayer.replaceChildren();'''
assert render_old in js, 'desktop canvas init block not found'
js = js.replace(render_old, render_new, 1)

render_order_old = '''    drawBackground(rect.width, rect.height);
    drawYearCursorCanvas(rect.height);
    drawAxis(rect.width, axisY);
    // Event/period lanes continue to move with the unclamped content axis while
    // the year axis itself sticks to the nearest canvas edge.
    drawEvents(rect.width, rect.height, contentAxisY, axisY);
    drawEventYears();
    drawOverflowCues(rect.width, rect.height);
    drawTicks(rect.width, axisY);
    drawOverview();'''
render_order_new = '''    drawBackground(rect.width, rect.height);
    drawYearCursorCanvas(rect.height);
    // Event/period lanes continue to move with the unclamped content axis while
    // the year axis itself sticks to the nearest canvas edge.
    drawEvents(rect.width, rect.height, contentAxisY, axisY);
    drawEventYears();
    drawOverflowCues(rect.width, rect.height);
    // The complete axis HUD is painted last on its own higher-z canvas so every
    // scrolling timeline block passes behind it in normal and sticky states.
    drawAxis(rect.width, axisY, axisCtx);
    drawTicks(rect.width, axisY, axisCtx);
    drawOverview();'''
assert render_order_old in js, 'desktop render order not found'
js = js.replace(render_order_old, render_order_new, 1)

# Toggle the foreground desktop axis layers off in vertical phone mode, whose
# renderer owns its own vertical axis implementation.
reset_old = """    const mobile = isPhoneVerticalMode();
    viewport.classList.toggle('is-phone-vertical', mobile);
    if (!mobile) {"""
reset_new = """    const mobile = isPhoneVerticalMode();
    viewport.classList.toggle('is-phone-vertical', mobile);
    axisCanvas.hidden = mobile;
    axisLabelLayer.hidden = mobile;
    if (!mobile) {"""
assert reset_old in js, 'resetRendererMode block not found'
js = js.replace(reset_old, reset_new, 1)

# ---------------------------------------------------------------------------
# Radar vertical lens: derive it from actual content/world geometry rather than
# sticky-axis screen position. Group expansion changes the world extent and thus
# automatically changes lens height and position.
# ---------------------------------------------------------------------------
radar_old = '''      // Desktop/tablet radar is two-dimensional: horizontal position follows
      // the visible time span while the frame's vertical position follows the
      // canvas's vertical lane pan. This keeps the radar truthful after the axis
      // itself becomes sticky at a canvas edge.
      const verticalRange = Math.max(0.0001, DESKTOP_AXIS_MAX_RATIO - DESKTOP_AXIS_MIN_RATIO);
      const verticalPosition = Math.max(0, Math.min(1,
        (DESKTOP_AXIS_MAX_RATIO - state.axisYRatio) / verticalRange
      ));
      const verticalWindowFraction = 1 / (verticalRange + 1);
      const verticalWindowHeight = Math.max(10, rect.height * verticalWindowFraction);
      const verticalTop = (rect.height - verticalWindowHeight) * verticalPosition;
      overviewWindow.style.top = `${verticalTop}px`;
      overviewWindow.style.bottom = 'auto';
      overviewWindow.style.height = `${verticalWindowHeight}px`;'''
radar_new = '''      // Desktop/tablet radar is a true viewport into the vertically translated
      // timeline content. Sticky-axis clamping has no effect on this geometry.
      const viewportHeight = Math.max(1, viewport.getBoundingClientRect().height);
      const contentBands = groupLaneLayout(0);
      let contentMin = -AXIS_STICKY_TOP_INSET;
      let contentMax = AXIS_STICKY_BOTTOM_INSET;
      for (const band of contentBands.values()) {
        contentMin = Math.min(contentMin, band.top);
        contentMax = Math.max(contentMax, band.bottom);
      }

      // Include the full allowed navigation envelope so the lens keeps moving
      // even when the viewport is temporarily beyond the outermost group.
      const worldMin = Math.min(contentMin, -viewportHeight * DESKTOP_AXIS_MAX_RATIO);
      const worldMax = Math.max(contentMax, viewportHeight - viewportHeight * DESKTOP_AXIS_MIN_RATIO);
      const worldSpan = Math.max(viewportHeight, worldMax - worldMin);
      const visibleTop = -viewportHeight * state.axisYRatio;
      const visibleBottom = visibleTop + viewportHeight;
      const lensTopRatio = Math.max(0, Math.min(1, (visibleTop - worldMin) / worldSpan));
      const lensBottomRatio = Math.max(lensTopRatio, Math.min(1, (visibleBottom - worldMin) / worldSpan));
      const verticalTop = rect.height * lensTopRatio;
      const verticalWindowHeight = Math.max(10, rect.height * (lensBottomRatio - lensTopRatio));
      overviewWindow.style.top = `${Math.max(0, Math.min(rect.height - verticalWindowHeight, verticalTop))}px`;
      overviewWindow.style.bottom = 'auto';
      overviewWindow.style.height = `${verticalWindowHeight}px`;'''
assert radar_old in js, 'radar vertical mapping block not found'
js = js.replace(radar_old, radar_new, 1)

# ---------------------------------------------------------------------------
# HTML/CSS foreground axis layers and cache/version synchronization.
# ---------------------------------------------------------------------------
index = index.replace(
'      <canvas id="leaderCanvas" class="leader-canvas" aria-hidden="true"></canvas>\n',
'      <canvas id="leaderCanvas" class="leader-canvas" aria-hidden="true"></canvas>\n      <canvas id="axisCanvas" class="axis-canvas" aria-hidden="true"></canvas>\n      <div id="axisLabelLayer" class="axis-label-layer" aria-hidden="true"></div>\n',
1
)

css = css.replace(
"#timelineCanvas, .label-layer { position: absolute; inset: 0; width: 100%; height: 100%; }\n.label-layer { pointer-events: none; overflow: hidden; z-index: 2; }",
"#timelineCanvas, .label-layer, .leader-canvas, .axis-canvas, .axis-label-layer { position: absolute; inset: 0; width: 100%; height: 100%; }\n.label-layer { pointer-events: none; overflow: hidden; z-index: 2; }\n.leader-canvas { pointer-events: none; z-index: 1; }\n.axis-canvas { pointer-events: none; z-index: 5; }\n.axis-label-layer { pointer-events: none; overflow: hidden; z-index: 5; }"
)
css = css.replace(
".event-year { position: absolute; font-size: 12px; line-height: 1; font-weight: 560; white-space: nowrap; text-align: center; text-shadow: 0 1px 0 color-mix(in srgb, var(--surface-solid) 75%, transparent); }",
".event-year { position: absolute; font-size: 12px; line-height: 1; font-weight: 560; white-space: nowrap; text-align: center; text-shadow: 0 1px 0 color-mix(in srgb, var(--surface-solid) 75%, transparent); }\n.axis-label-layer .event-year { z-index: 1; }"
)

# Version bump everywhere, including cache-busting query strings.
index = index.replace('2.8.1', '2.8.2')
version_js = version_js.replace('2.8.1', '2.8.2')
(ROOT / 'VERSION').write_text('2.8.2\n')

entry = '''### 2.8.2\n\nMade the horizontal time axis a permanent foreground HUD so event and period blocks pass behind the complete axis strip in both normal and sticky states. Event-year labels now share the foreground axis layer. Group lanes are visually transparent while keeping separators/captions. Cluster disclosures point away from the axis, animate the affected group open, guarantee the clicked cluster is revealed, and repack the whole group so neighboring overflow can also disappear when space permits. Reworked the radar lens to represent the actual vertically visible content window and total content extent, including expanded groups, independent of sticky-axis clamping.\n\n'''
if '### 2.8.2' not in readme:
    readme = readme.replace('## Version history\n\n', '## Version history\n\n' + entry, 1)

js_path.write_text(js)
css_path.write_text(css)
index_path.write_text(index)
version_path.write_text(version_js)
readme_path.write_text(readme)

# Validation assertions before the workflow is allowed to commit.
final_js = js_path.read_text()
final_css = css_path.read_text()
final_index = index_path.read_text()
assert "const axisCanvas = document.getElementById('axisCanvas');" in final_js
assert 'axisLabelLayer.appendChild(year);' in final_js
assert 'animateGroupHeight(category' in final_js
assert "const caretPath = items[0].isAbove ? 'M1 5 L5 1 L9 5'" in final_js
assert 'expandOverflowGroup(category, items);' in final_js
assert 'const worldMin = Math.min(contentMin, -viewportHeight * DESKTOP_AXIS_MAX_RATIO);' in final_js
assert 'drawAxis(rect.width, axisY, axisCtx);' in final_js
assert 'ctx.fillRect(0, visibleTop' not in final_js
assert '.axis-canvas { pointer-events: none; z-index: 5; }' in final_css
assert 'id="axisCanvas"' in final_index
assert 'v2.8.2' in final_index and '?v=2.8.2' in final_index
print('Chrona 2.8.2 patch applied')
