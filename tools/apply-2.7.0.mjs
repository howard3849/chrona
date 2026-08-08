import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const NEW_VERSION = '2.7.0';
const VERSION_PATH = path.join(ROOT, 'VERSION');
const OLD_VERSION = fs.readFileSync(VERSION_PATH, 'utf8').trim();

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function write(rel, text) { fs.writeFileSync(path.join(ROOT, rel), text); }
function replaceOnce(text, oldText, newText, label) {
  const first = text.indexOf(oldText);
  if (first < 0) throw new Error(`Patch marker not found: ${label}`);
  if (text.indexOf(oldText, first + oldText.length) >= 0) throw new Error(`Patch marker not unique: ${label}`);
  return text.slice(0, first) + newText + text.slice(first + oldText.length);
}
function replaceBlock(text, startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Start marker not found: ${label}`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`End marker not found: ${label}`);
  return text.slice(0, start) + replacement + text.slice(end);
}

let timeline = read('timeline.js');

timeline = replaceOnce(
  timeline,
  "  const importanceRank = { Major: 3, Medium: 2, Minor: 1 };",
  "  const importanceRank = { Major: 3, Normal: 2, Minor: 1 };",
  'importance rank'
);

timeline = replaceOnce(
  timeline,
  "    pendingLeaders: [],\n    renderQueued: false,",
  "    pendingLeaders: [],\n    pendingOverflow: [],\n    renderQueued: false,",
  'overflow state'
);

timeline = replaceOnce(
  timeline,
  "  function normalizeElementType(value) {",
  `  function normalizeImportance(value) {\n    const normalized = String(value || '').trim().toLowerCase();\n    if (normalized === 'major') return 'Major';\n    if (normalized === 'minor') return 'Minor';\n    if (normalized === 'normal' || normalized === 'medium' || !normalized) return 'Normal';\n    return 'Normal';\n  }\n\n  function normalizeElementType(value) {`,
  'normalize importance helper'
);

timeline = replaceOnce(
  timeline,
  "      delete row.Position;\n      const group = String(row.Group || row.Category || 'Uncategorized').trim();",
  "      delete row.Position;\n      row.Importance = normalizeImportance(row.Importance);\n      const group = String(row.Group || row.Category || 'Uncategorized').trim();",
  'export importance normalization'
);

timeline = replaceOnce(
  timeline,
  "        importance: row.Importance || 'Medium',",
  "        importance: normalizeImportance(row.Importance),",
  'runtime importance default'
);

const oldDrawEventsStart = "  function drawEvents(width, height, axisY) {";
const drawEventsEnd = "\n  function resolvePosition(event) {";
const newDrawEvents = `  function drawEvents(width, height, axisY) {\n    // Pack against the complete enabled data set, not just the current viewport.\n    // This keeps lane assignment stable while panning at a fixed zoom level.\n    const candidates = state.events.filter(event =>\n      event.elementType !== 'Title' && state.enabledCategories.has(event.category)\n    );\n    const threshold = labelThreshold(state.viewEnd - state.viewStart);\n    const above = candidates.filter(event => isPrimaryCategory(event.category));\n    const below = candidates.filter(event => !isPrimaryCategory(event.category));\n    const abovePoints = above.filter(event => event.elementType !== 'Period');\n    const belowPoints = below.filter(event => event.elementType !== 'Period');\n    const abovePeriods = above.filter(event => event.elementType === 'Period' && event.end != null);\n    const belowPeriods = below.filter(event => event.elementType === 'Period' && event.end != null);\n\n    const abovePointLanes = drawPointRows(abovePoints, width, height, axisY, true, threshold);\n    const belowPointLanes = drawPointRows(belowPoints, width, height, axisY, false, threshold);\n    drawLeaderLines(axisY);\n    state.pendingLeadersDrawn = true;\n\n    drawPeriodRows(abovePeriods, width, height, axisY, threshold, true, abovePointLanes);\n    drawPeriodRows(belowPeriods, width, height, axisY, threshold, false, belowPointLanes);\n  }\n`;
timeline = replaceBlock(timeline, oldDrawEventsStart, drawEventsEnd, newDrawEvents, 'drawEvents');

timeline = replaceOnce(
  timeline,
  "  function drawPointRows(events, width, axisY, isAbove, threshold) {\n    const sorted = [...events].sort((a, b) => a.start - b.start || (importanceRank[b.importance] - importanceRank[a.importance]));\n    const laneEnds = [];\n    let maxLabelLane = -1;",
  `  function drawPointRows(events, width, height, axisY, isAbove, threshold) {\n    // Higher-importance records get first choice of limited lanes. Date and ID\n    // provide deterministic tie-breakers so panning never arbitrarily swaps winners.\n    const sorted = [...events].sort((a, b) =>\n      (importanceRank[b.importance] || 2) - (importanceRank[a.importance] || 2) ||\n      a.start - b.start ||\n      String(a.id || '').localeCompare(String(b.id || ''))\n    );\n    const laneIntervals = [];\n    const maxLabelLanes = isAbove\n      ? Math.max(0, Math.floor((axisY - 60) / 34) + 1)\n      : Math.max(0, Math.floor((height - axisY - 65) / 34) + 1);\n    let maxLabelLane = -1;`,
  'point lane header'
);

timeline = replaceOnce(
  timeline,
  "      const showLabel = (importanceRank[event.importance] || 2) >= threshold;",
  "      let showLabel = (importanceRank[event.importance] || 2) >= threshold;",
  'point showLabel mutable'
);

timeline = replaceOnce(
  timeline,
  `      let lane = 0;\n      if (showLabel) {\n        while (\n          laneEnds[lane] != null &&\n          labelLeft < laneEnds[lane] + 8\n        ) lane++;\n        laneEnds[lane] = labelRight;\n        maxLabelLane = Math.max(maxLabelLane, lane);\n      }`,
  `      let lane = 0;\n      if (showLabel) {\n        while (lane < maxLabelLanes) {\n          const intervals = laneIntervals[lane] || [];\n          const collides = intervals.some(interval =>\n            labelLeft < interval.right + 8 && labelRight > interval.left - 8\n          );\n          if (!collides) break;\n          lane++;\n        }\n        if (lane >= maxLabelLanes) {\n          showLabel = false;\n        } else {\n          if (!laneIntervals[lane]) laneIntervals[lane] = [];\n          laneIntervals[lane].push({ left: labelLeft, right: labelRight });\n          maxLabelLane = Math.max(maxLabelLane, lane);\n        }\n      }\n      if (!showLabel) recordOverflowEvent(event, x, isAbove);`,
  'point bounded lane allocator'
);

const periodStartMarker = "  function drawPeriodRows(periods, width, height, axisY, threshold, isAbove, pointLaneCount = 0) {";
const periodLoopMarker = "    // Era rows remain anchored to the timeline axis. They may naturally move\n";
const newPeriodHeader = `  function drawPeriodRows(periods, width, height, axisY, threshold, isAbove, pointLaneCount = 0) {\n    const barHeight = 28;\n    const laneGap = 36;\n    const pointLabelHeight = 27;\n    const pointLaneGap = 34;\n    const separation = 12;\n\n    const outermostPointTop = pointLaneCount > 0\n      ? axisY - 58 - (pointLaneCount - 1) * pointLaneGap\n      : axisY;\n    const outermostPointBottom = pointLaneCount > 0\n      ? axisY + 36 + (pointLaneCount - 1) * pointLaneGap + pointLabelHeight\n      : axisY;\n    const firstPeriodY = isAbove\n      ? Math.min(axisY - 112, outermostPointTop - separation - barHeight)\n      : Math.max(axisY + 92, outermostPointBottom + separation);\n\n    let maxPeriodLanes = 0;\n    while (maxPeriodLanes < 64) {\n      const y = isAbove\n        ? firstPeriodY - maxPeriodLanes * laneGap\n        : firstPeriodY + maxPeriodLanes * laneGap;\n      if (y + barHeight <= 2 || y >= height - 2) break;\n      maxPeriodLanes++;\n    }\n\n    const sorted = [...periods].sort((a, b) =>\n      (importanceRank[b.importance] || 2) - (importanceRank[a.importance] || 2) ||\n      a.start - b.start ||\n      String(a.id || '').localeCompare(String(b.id || ''))\n    );\n    const laneIntervals = [];\n    const layout = [];\n\n    for (const event of sorted) {\n      const x1 = timeToX(event.start, width);\n      const x2 = timeToX(event.end, width);\n      const left = Math.min(x1, x2);\n      const right = Math.max(x1, x2);\n      if (right <= 0 || left >= width || right <= left) continue;\n\n      let lane = 0;\n      while (lane < maxPeriodLanes) {\n        const intervals = laneIntervals[lane] || [];\n        const collides = intervals.some(interval =>\n          left < interval.right + 8 && right > interval.left - 8\n        );\n        if (!collides) break;\n        lane++;\n      }\n\n      if (lane >= maxPeriodLanes) {\n        recordOverflowEvent(event, Math.max(0, Math.min(width, (left + right) / 2)), isAbove);\n        continue;\n      }\n      if (!laneIntervals[lane]) laneIntervals[lane] = [];\n      laneIntervals[lane].push({ left, right });\n      layout.push({ event, left, right, lane });\n    }\n    if (!layout.length) return;\n\n`;
timeline = replaceBlock(timeline, periodStartMarker, periodLoopMarker, newPeriodHeader, 'period lane allocator');

const overflowHelpers = `  function recordOverflowEvent(event, x, isAbove) {\n    if (!Number.isFinite(x) || !event) return;\n    state.pendingOverflow.push({\n      event,\n      x,\n      time: Number(event.start),\n      isAbove: Boolean(isAbove)\n    });\n  }\n\n  function drawOverflowCues(width, height) {\n    if (!state.pendingOverflow.length || isPhoneVerticalMode()) return;\n    const bucketSize = 48;\n    const clusters = new Map();\n\n    for (const item of state.pendingOverflow) {\n      if (item.x < -8 || item.x > width + 8) continue;\n      const bucket = Math.round(item.x / bucketSize);\n      const key = \`${'${item.isAbove ? \'above\' : \'below\'}'}:${'${bucket}'}\`;\n      if (!clusters.has(key)) clusters.set(key, []);\n      clusters.get(key).push(item);\n    }\n\n    for (const items of clusters.values()) {\n      if (!items.length) continue;\n      const x = items.reduce((sum, item) => sum + item.x, 0) / items.length;\n      const time = items.reduce((sum, item) => sum + item.time, 0) / items.length;\n      const isAbove = items[0].isAbove;\n      const cue = document.createElement('button');\n      cue.type = 'button';\n      cue.className = 'timeline-overflow-cue';\n      cue.setAttribute('aria-label', \`${'${items.length}'} more timeline items near ${'${formatYear(time)}'}\`);\n      cue.title = \`${'${items.length}'} more timeline item${'${items.length === 1 ? \'\' : \'s\'}'}\`;\n      cue.style.cssText = [\n        'position:absolute',\n        'width:24px',\n        'height:13px',\n        'padding:0',\n        'margin:0',\n        'border:0',\n        'background:transparent',\n        'cursor:pointer',\n        'z-index:8',\n        \`left:${'${Math.round(Math.max(0, Math.min(width - 24, x - 12)))}'}px\`,\n        \`top:${'${isAbove ? 2 : Math.max(2, height - 15)}'}px\`\n      ].join(';');\n      cue.innerHTML = \`<svg viewBox=\"0 0 24 13\" width=\"24\" height=\"13\" aria-hidden=\"true\">\n        <path d=\"M2 2.5 L12 10.5 L22 2.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path>\n        <text x=\"12\" y=\"6.6\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"7.4\" font-weight=\"700\" fill=\"currentColor\">${'${items.length}'}</text>\n      </svg>\`;\n      cue.addEventListener('click', event => {\n        event.preventDefault();\n        event.stopPropagation();\n        const span = Math.max(MIN_VISIBLE_YEARS, state.viewEnd - state.viewStart);\n        const ratio = Math.max(0, Math.min(1, (time - state.viewStart) / span));\n        zoomAt(ratio, 0.45);\n      });\n      labelLayer.appendChild(cue);\n    }\n  }\n\n  function stickyAxisY(height, rawAxisY = height * state.axisYRatio) {\n    const edge = document.documentElement.dataset.theme === 'dark' ? 1.5 : 1;\n    return Math.max(edge, Math.min(Math.max(edge, height - edge), rawAxisY));\n  }\n\n`;
timeline = replaceOnce(timeline, "  function mixHex(colorA, colorB, amount) {", overflowHelpers + "  function mixHex(colorA, colorB, amount) {", 'overflow helpers');

timeline = replaceOnce(
  timeline,
  `    state.pendingEventYears = [];\n    state.pendingLeaders = [];\n\n    const axisY = rect.height * state.axisYRatio;\n    drawBackground(rect.width, rect.height);\n    drawYearCursorCanvas(rect.height);\n    drawAxis(rect.width, axisY);\n    drawEvents(rect.width, rect.height, axisY);\n    drawEventYears();\n    drawTicks(rect.width, axisY);`,
  `    state.pendingEventYears = [];\n    state.pendingLeaders = [];\n    state.pendingOverflow = [];\n\n    const contentAxisY = rect.height * state.axisYRatio;\n    const axisY = stickyAxisY(rect.height, contentAxisY);\n    drawBackground(rect.width, rect.height);\n    drawYearCursorCanvas(rect.height);\n    drawAxis(rect.width, axisY);\n    // Event/period lanes continue to move with the unclamped content axis while\n    // the year axis itself sticks to the nearest canvas edge.\n    drawEvents(rect.width, rect.height, contentAxisY);\n    drawEventYears();\n    drawOverflowCues(rect.width, rect.height);\n    drawTicks(rect.width, axisY);`,
  'sticky axis render'
);

timeline = replaceOnce(
  timeline,
  `    const minorStep = chooseMinorTickStep(majorStep);\n    const firstMinor = Math.floor(state.viewStart / minorStep) * minorStep;\n\n    ctx.font = '12px -apple-system, BlinkMacSystemFont, \\\"SF Pro Text\\\", sans-serif';\n    ctx.textAlign = 'center';\n    ctx.textBaseline = 'top';`,
  `    const minorStep = chooseMinorTickStep(majorStep);\n    const firstMinor = Math.floor(state.viewStart / minorStep) * minorStep;\n    const viewportHeight = Math.max(1, viewport.clientHeight || 1);\n    const labelsBelow = axisY <= viewportHeight - 30;\n\n    ctx.font = '12px -apple-system, BlinkMacSystemFont, \\\"SF Pro Text\\\", sans-serif';\n    ctx.textAlign = 'center';\n    ctx.textBaseline = labelsBelow ? 'top' : 'bottom';`,
  'sticky tick label side'
);

timeline = replaceOnce(
  timeline,
  "          zone.side === 'below' && Math.abs(zone.x - x) < Math.max(24, zone.width / 2 + 10)",
  "          zone.side === (labelsBelow ? 'below' : 'above') && Math.abs(zone.x - x) < Math.max(24, zone.width / 2 + 10)",
  'tick collision side'
);

timeline = replaceOnce(
  timeline,
  "          ctx.fillText(label, x, axisY + 11);",
  "          ctx.fillText(label, x, labelsBelow ? axisY + 11 : axisY - 11);",
  'tick label position'
);

timeline = replaceOnce(
  timeline,
  `    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, \\\"SF Pro Text\\\", sans-serif';\n    ctx.textAlign = 'left';\n    ctx.textBaseline = 'bottom';\n    ctx.fillStyle = cssVar('--text', '#17191c');\n    ctx.fillText(state.viewEnd < 0 ? 'YEAR (BCE)' : state.viewStart >= 1 ? 'YEAR (CE)' : 'YEAR (BCE / CE)', 12, axisY - 13);`,
  `    const titleBelow = axisY < 26;\n    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, \\\"SF Pro Text\\\", sans-serif';\n    ctx.textAlign = 'left';\n    ctx.textBaseline = titleBelow ? 'top' : 'bottom';\n    ctx.fillStyle = cssVar('--text', '#17191c');\n    ctx.fillText(\n      state.viewEnd < 0 ? 'YEAR (BCE)' : state.viewStart >= 1 ? 'YEAR (CE)' : 'YEAR (BCE / CE)',\n      12,\n      titleBelow ? axisY + 13 : axisY - 13\n    );`,
  'sticky year title'
);

timeline = replaceOnce(
  timeline,
  "      clientY: rect.top + Math.max(72, Math.min(rect.height - 72, rect.height * state.axisYRatio))",
  "      clientY: rect.top + Math.max(24, Math.min(rect.height - 24, stickyAxisY(rect.height)))",
  'detail anchor sticky axis'
);

timeline = replaceOnce(
  timeline,
  `      // Restore the desktop/iPad top-and-bottom inset after leaving phone\n      // mode; phone mode sets bottom:auto so its height can be controlled.\n      overviewWindow.style.top = '';\n      overviewWindow.style.bottom = '';\n      overviewWindow.style.height = '';\n      overviewWindow.style.right = '';\n      overviewWindow.style.left = \`${'${clampedLeft}'}px\`;\n      overviewWindow.style.width = \`${'${Math.max(8, clampedRight - clampedLeft)}'}px\`;`,
  `      // Desktop/tablet radar is two-dimensional: horizontal position follows\n      // the visible time span while the frame's vertical position follows the\n      // canvas's vertical lane pan. This keeps the radar truthful after the axis\n      // itself becomes sticky at a canvas edge.\n      const verticalRange = Math.max(0.0001, DESKTOP_AXIS_MAX_RATIO - DESKTOP_AXIS_MIN_RATIO);\n      const verticalPosition = Math.max(0, Math.min(1,\n        (state.axisYRatio - DESKTOP_AXIS_MIN_RATIO) / verticalRange\n      ));\n      const verticalWindowFraction = 1 / (verticalRange + 1);\n      const verticalWindowHeight = Math.max(10, rect.height * verticalWindowFraction);\n      const verticalTop = (rect.height - verticalWindowHeight) * verticalPosition;\n      overviewWindow.style.top = \`${'${verticalTop}'}px\`;\n      overviewWindow.style.bottom = 'auto';\n      overviewWindow.style.height = \`${'${verticalWindowHeight}'}px\`;\n      overviewWindow.style.right = '';\n      overviewWindow.style.left = \`${'${clampedLeft}'}px\`;\n      overviewWindow.style.width = \`${'${Math.max(8, clampedRight - clampedLeft)}'}px\`;`,
  'desktop radar 2d window'
);

timeline = replaceOnce(
  timeline,
  `  applyPreviewSize(localStorage.getItem('chrona.previewSize') || 'computer');\n  viewport.addEventListener('keydown', onTimelineKeyDown);`,
  `  applyPreviewSize(localStorage.getItem('chrona.previewSize') || 'computer');\n\n  // Radar and canvas must share the same live geometry. ResizeObserver catches\n  // preview-device changes, sidebar/layout changes, and real viewport resizing\n  // even when no browser window resize event fires.\n  if (window.ResizeObserver) {\n    const geometryObserver = new ResizeObserver(() => scheduleRender());\n    geometryObserver.observe(viewport);\n    if (overviewTrack) geometryObserver.observe(overviewTrack);\n  }\n\n  viewport.addEventListener('keydown', onTimelineKeyDown);`,
  'radar resize observer'
);

write('timeline.js', timeline);

let sample = read('sample-data.js');
sample = sample.replaceAll('"Importance":"Medium"', '"Importance":"Normal"');
write('sample-data.js', sample);

write('VERSION', `${NEW_VERSION}\n`);
write('version.js', `/* Generated by tools/finalize-release.command. Do not edit by hand. */\nwindow.CHRONA_VERSION = '${NEW_VERSION}';\n`);

let index = read('index.html');
index = index.replaceAll(`v=${OLD_VERSION}`, `v=${NEW_VERSION}`);
index = index.replaceAll(`v${OLD_VERSION}</code>`, `v${NEW_VERSION}</code>`);
write('index.html', index);

// Keep every tracked cache-busting reference synchronized with the release.
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
for (const rel of tracked) {
  if (!/\.(?:html|js|css|md)$/i.test(rel)) continue;
  const abs = path.join(ROOT, rel);
  let text;
  try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
  const updated = text.replace(new RegExp(`\\?v=${OLD_VERSION.replaceAll('.', '\\.')}(?=[\\\"'&<\\s]|$)`, 'g'), `?v=${NEW_VERSION}`);
  if (updated !== text) fs.writeFileSync(abs, updated);
}

let readme = read('README.md');
readme = replaceOnce(
  readme,
  'Chrona additionally uses:\n\n- `period` — a Chrona period block.\n- `title` — the dataset title row.',
  'Chrona additionally uses:\n\n- `period` — a Chrona period block.\n- `title` — the dataset title row.\n\n`Importance` supports exactly `Major`, `Normal`, and `Minor`. A blank Importance cell is treated as `Normal`; legacy `Medium` values are normalized to `Normal` when loaded or exported.' ,
  'README importance docs'
);
readme = replaceOnce(
  readme,
  '## Version history\n\n### 2.6.3',
  `## Version history\n\n### ${NEW_VERSION}\n\nAdded stable priority-aware lane packing using Major → Normal → Minor, with blank Importance treated as Normal and legacy Medium values normalized. Hidden lane items now surface as compact numbered chevron overflow cues that zoom into their cluster instead of disappearing silently. The desktop/tablet year axis now sticks to the top or bottom canvas edge while event lanes continue to scroll, and the radar focus frame now tracks both the visible time range and vertical lane pan across responsive layouts.\n\n### 2.6.3`,
  'README version entry'
);
write('README.md', readme);

console.log(`Chrona patched ${OLD_VERSION} -> ${NEW_VERSION}`);
