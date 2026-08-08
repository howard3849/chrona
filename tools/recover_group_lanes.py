from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
js_path = ROOT / 'timeline.js'
text = js_path.read_text()


def require(old, label):
    if old not in text:
        raise SystemExit(f'missing expected block: {label}')


def replace_once(old, new, label):
    global text
    require(old, label)
    text = text.replace(old, new, 1)

# Fixed group-band geometry. Bands deliberately do not resize as the horizontal
# viewport pans; this prevents the canvas from jumping vertically as density changes.
replace_once(
"  const MAX_VISIBLE_YEARS = 12000;\n",
"  const MAX_VISIBLE_YEARS = 12000;\n  const GROUP_LANE_HEIGHT = 132;\n  const GROUP_LANE_AXIS_GAP = 24;\n  const GROUP_LANE_LABEL_INSET = 10;\n",
"group lane constants",
)

old_draw_events = '''  function drawEvents(width, height, axisY) {
    // Pack against the complete enabled data set, not just the current viewport.
    // This keeps lane assignment stable while panning at a fixed zoom level.
    const candidates = state.events.filter(event =>
      event.elementType !== 'Title' && state.enabledCategories.has(event.category)
    );
    const threshold = labelThreshold(state.viewEnd - state.viewStart);
    const above = candidates.filter(event => isPrimaryCategory(event.category));
    const below = candidates.filter(event => !isPrimaryCategory(event.category));
    const abovePoints = above.filter(event => event.elementType !== 'Period');
    const belowPoints = below.filter(event => event.elementType !== 'Period');
    const abovePeriods = above.filter(event => event.elementType === 'Period' && event.end != null);
    const belowPeriods = below.filter(event => event.elementType === 'Period' && event.end != null);

    const abovePointLanes = drawPointRows(abovePoints, width, height, axisY, true, threshold);
    const belowPointLanes = drawPointRows(belowPoints, width, height, axisY, false, threshold);
    drawLeaderLines(axisY);
    state.pendingLeadersDrawn = true;

    drawPeriodRows(abovePeriods, width, height, axisY, threshold, true, abovePointLanes);
    drawPeriodRows(belowPeriods, width, height, axisY, threshold, false, belowPointLanes);
  }
'''
new_draw_events = '''  function groupLaneLayout(axisY) {
    // Preserve source/config order so a group never jumps to a different vertical
    // lane merely because the time window changes. Primary groups stack upward;
    // reference groups stack downward. Every group receives the same fixed height.
    const enabledGroups = [...state.categories.keys()].filter(name => state.enabledCategories.has(name));
    const primary = enabledGroups.filter(name => isPrimaryCategory(name));
    const reference = enabledGroups.filter(name => !isPrimaryCategory(name));
    const bands = new Map();

    primary.forEach((category, index) => {
      const bottom = axisY - GROUP_LANE_AXIS_GAP - index * GROUP_LANE_HEIGHT;
      bands.set(category, {
        category,
        isAbove: true,
        index,
        top: bottom - GROUP_LANE_HEIGHT,
        bottom,
        near: bottom,
        far: bottom - GROUP_LANE_HEIGHT
      });
    });

    reference.forEach((category, index) => {
      const top = axisY + GROUP_LANE_AXIS_GAP + index * GROUP_LANE_HEIGHT;
      bands.set(category, {
        category,
        isAbove: false,
        index,
        top,
        bottom: top + GROUP_LANE_HEIGHT,
        near: top,
        far: top + GROUP_LANE_HEIGHT
      });
    });

    return bands;
  }

  function drawGroupLaneBands(width, height, bands) {
    if (!bands.size) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    ctx.save();
    ctx.font = '650 10px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.textBaseline = 'top';

    for (const band of bands.values()) {
      const category = state.categories.get(band.category);
      const color = category?.color || stableGroupColor(band.category);
      const visibleTop = Math.max(0, band.top);
      const visibleBottom = Math.min(height, band.bottom);
      if (visibleBottom <= 0 || visibleTop >= height) continue;

      // A restrained tint and far-edge separator make each group read as its own
      // lane without turning the timeline into a grid of heavy boxes.
      ctx.fillStyle = colorWithAlpha(color, dark ? 0.035 : 0.025);
      ctx.fillRect(0, visibleTop, width, Math.max(0, visibleBottom - visibleTop));
      const boundaryY = band.isAbove ? band.top : band.bottom;
      if (boundaryY >= 0 && boundaryY <= height) {
        ctx.strokeStyle = colorWithAlpha(color, dark ? 0.24 : 0.18);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(boundaryY) + 0.5);
        ctx.lineTo(width, Math.round(boundaryY) + 0.5);
        ctx.stroke();
      }

      const captionY = band.isAbove ? band.top + 6 : band.bottom - 18;
      if (captionY >= -2 && captionY <= height - 8) {
        ctx.fillStyle = colorWithAlpha(color, dark ? 0.82 : 0.72);
        ctx.textAlign = 'left';
        ctx.fillText(
          state.events.find(event => event.category === band.category)?.categoryLabel || band.category,
          GROUP_LANE_LABEL_INSET,
          captionY
        );
      }
    }
    ctx.restore();
  }

  function drawEvents(width, height, axisY) {
    // Pack against the complete enabled data set, not just the current viewport.
    // Group membership is the first layout boundary: each group owns a fixed
    // vertical band, then Importance decides which records win space inside it.
    const candidates = state.events.filter(event =>
      event.elementType !== 'Title' && state.enabledCategories.has(event.category)
    );
    const threshold = labelThreshold(state.viewEnd - state.viewStart);
    const bands = groupLaneLayout(axisY);
    drawGroupLaneBands(width, height, bands);

    const pointLaneCounts = new Map();
    for (const band of bands.values()) {
      const groupEvents = candidates.filter(event => event.category === band.category);
      const points = groupEvents.filter(event => event.elementType !== 'Period');
      const pointLaneCount = drawPointRows(points, width, height, axisY, band.isAbove, threshold, band);
      pointLaneCounts.set(band.category, pointLaneCount);
    }

    // Connector lines are painted before period blocks so periods naturally
    // occlude unrelated leaders, matching the pre-recovery renderer behavior.
    drawLeaderLines(axisY);
    state.pendingLeadersDrawn = true;

    for (const band of bands.values()) {
      const periods = candidates.filter(event =>
        event.category === band.category && event.elementType === 'Period' && event.end != null
      );
      drawPeriodRows(
        periods,
        width,
        height,
        axisY,
        threshold,
        band.isAbove,
        pointLaneCounts.get(band.category) || 0,
        band
      );
    }
  }
'''
replace_once(old_draw_events, new_draw_events, "drawEvents")

replace_once(
"  function drawPointRows(events, width, height, axisY, isAbove, threshold) {\n",
"  function drawPointRows(events, width, height, axisY, isAbove, threshold, band = null) {\n",
"drawPointRows signature",
)

old_max = '''    const maxLabelLanes = isAbove
      ? Math.max(0, Math.floor((axisY - 60) / 34) + 1)
      : Math.max(0, Math.floor((height - axisY - 65) / 34) + 1);
'''
new_max = '''    const maxLabelLanes = band
      ? Math.max(0, Math.floor((GROUP_LANE_HEIGHT - 26) / 34))
      : isAbove
        ? Math.max(0, Math.floor((axisY - 60) / 34) + 1)
        : Math.max(0, Math.floor((height - axisY - 65) / 34) + 1);
'''
replace_once(old_max, new_max, "point max lanes")

replace_once(
"      if (!showLabel) recordOverflowEvent(event, x, isAbove);\n",
"      if (!showLabel) recordOverflowEvent(event, x, isAbove, band);\n",
"point overflow band",
)

old_label_top = "      const labelTop = isAbove ? axisY - 58 - lane * laneGap : axisY + 36 + lane * laneGap;\n"
new_label_top = '''      const labelTop = band
        ? (isAbove
          ? band.bottom - 34 - lane * laneGap
          : band.top + 12 + lane * laneGap)
        : (isAbove ? axisY - 58 - lane * laneGap : axisY + 36 + lane * laneGap);
'''
replace_once(old_label_top, new_label_top, "point label band position")

old_span_offset = '''      const spanOffset = hasRange
        ? axisHalfThickness + spanHalfThickness + microLane * 4
        : 0;
'''
new_span_offset = '''      const groupSpanBase = band ? band.index * 8 : 0;
      const spanOffset = hasRange
        ? axisHalfThickness + spanHalfThickness + groupSpanBase + microLane * 4
        : 0;
'''
replace_once(old_span_offset, new_span_offset, "duration span group separation")

replace_once(
"  function recordOverflowEvent(event, x, isAbove) {\n",
"  function recordOverflowEvent(event, x, isAbove, band = null) {\n",
"recordOverflowEvent signature",
)
replace_once(
'''      time: Number(event.start),
      isAbove: Boolean(isAbove)
''',
'''      time: Number(event.start),
      isAbove: Boolean(isAbove),
      category: event.category,
      cueY: band
        ? (isAbove ? band.top + 2 : band.bottom - 15)
        : null
''',
"overflow metadata",
)

replace_once(
"      const key = `${item.isAbove ? 'above' : 'below'}:${bucket}`;\n",
"      const key = `${item.isAbove ? 'above' : 'below'}:${item.category || ''}:${bucket}`;\n",
"overflow group clusters",
)
replace_once(
"      const isAbove = items[0].isAbove;\n",
"      const isAbove = items[0].isAbove;\n      const cueY = items.find(item => Number.isFinite(item.cueY))?.cueY;\n",
"overflow cue y",
)
replace_once(
"        `top:${isAbove ? 2 : Math.max(2, height - 15)}px`\n",
"        `top:${Math.round(Math.max(2, Math.min(height - 15, Number.isFinite(cueY) ? cueY : (isAbove ? 2 : height - 15))))}px`\n",
"overflow cue top",
)

replace_once(
"  function drawPeriodRows(periods, width, height, axisY, threshold, isAbove, pointLaneCount = 0) {\n",
"  function drawPeriodRows(periods, width, height, axisY, threshold, isAbove, pointLaneCount = 0, band = null) {\n",
"drawPeriodRows signature",
)

old_period_geometry = '''    const outermostPointTop = pointLaneCount > 0
      ? axisY - 58 - (pointLaneCount - 1) * pointLaneGap
      : axisY;
    const outermostPointBottom = pointLaneCount > 0
      ? axisY + 36 + (pointLaneCount - 1) * pointLaneGap + pointLabelHeight
      : axisY;
    const firstPeriodY = isAbove
      ? Math.min(axisY - 112, outermostPointTop - separation - barHeight)
      : Math.max(axisY + 92, outermostPointBottom + separation);

    let maxPeriodLanes = 0;
    while (maxPeriodLanes < 64) {
      const y = isAbove
        ? firstPeriodY - maxPeriodLanes * laneGap
        : firstPeriodY + maxPeriodLanes * laneGap;
      if (y + barHeight <= 2 || y >= height - 2) break;
      maxPeriodLanes++;
    }
'''
new_period_geometry = '''    const outermostPointTop = pointLaneCount > 0
      ? (band ? band.bottom - 34 - (pointLaneCount - 1) * pointLaneGap : axisY - 58 - (pointLaneCount - 1) * pointLaneGap)
      : (band ? band.bottom : axisY);
    const outermostPointBottom = pointLaneCount > 0
      ? (band ? band.top + 12 + (pointLaneCount - 1) * pointLaneGap + pointLabelHeight : axisY + 36 + (pointLaneCount - 1) * pointLaneGap + pointLabelHeight)
      : (band ? band.top : axisY);
    const firstPeriodY = band
      ? (isAbove
        ? outermostPointTop - separation - barHeight
        : outermostPointBottom + separation)
      : (isAbove
        ? Math.min(axisY - 112, outermostPointTop - separation - barHeight)
        : Math.max(axisY + 92, outermostPointBottom + separation));

    let maxPeriodLanes = 0;
    while (maxPeriodLanes < 64) {
      const y = isAbove
        ? firstPeriodY - maxPeriodLanes * laneGap
        : firstPeriodY + maxPeriodLanes * laneGap;
      const outsideBand = band && (y < band.top + 2 || y + barHeight > band.bottom - 2);
      if (outsideBand || y + barHeight <= 2 || y >= height - 2) break;
      maxPeriodLanes++;
    }
'''
replace_once(old_period_geometry, new_period_geometry, "period band geometry")
replace_once(
"        recordOverflowEvent(event, Math.max(0, Math.min(width, (left + right) / 2)), isAbove);\n",
"        recordOverflowEvent(event, Math.max(0, Math.min(width, (left + right) / 2)), isAbove, band);\n",
"period overflow band",
)

js_path.write_text(text)

# Version the restored lane architecture as the next development minor release.
version = '2.8.0'
(ROOT / 'VERSION').write_text(version + '\n')

version_path = ROOT / 'version.js'
version_text = version_path.read_text()
version_text = re.sub(r"window\.CHRONA_VERSION\s*=\s*'[^']+'", f"window.CHRONA_VERSION = '{version}'", version_text)
version_path.write_text(version_text)

index_path = ROOT / 'index.html'
index_text = index_path.read_text()
index_text = re.sub(r'\?v=2\.7\.0', f'?v={version}', index_text)
index_text = re.sub(r'<code id="appVersion">v2\.7\.0</code>', f'<code id="appVersion">v{version}</code>', index_text)
index_path.write_text(index_text)

readme_path = ROOT / 'README.md'
readme = readme_path.read_text()
marker = '## Version history\n\n'
entry = '''### 2.8.0\n\nRestored fixed-height per-group timeline lanes on desktop/tablet. Each enabled group now owns a stable vertical band in source/config order, so horizontal panning cannot collapse different groups back into one shared packing pool. Point labels and periods pack only inside their group band; Major → Normal → Minor remains the deterministic space priority, overflow cues are clustered per group and appear at that lane’s outer edge, and overlapping duration spans receive group-aware micro-offsets. The v2.7 sticky central axis and radar synchronization remain intact.\n\n'''
if entry not in readme:
    readme = readme.replace(marker, marker + entry, 1)
readme_path.write_text(readme)

print('Recovered fixed group lanes and synchronized Chrona', version)
