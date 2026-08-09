from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
js_path=ROOT/'timeline.js'; css_path=ROOT/'css/year-ruler.css'; styles_path=ROOT/'styles.css'; index_path=ROOT/'index.html'; version_path=ROOT/'version.js'; readme_path=ROOT/'README.md'
js=js_path.read_text(); css=css_path.read_text(); styles=styles_path.read_text(); index=index_path.read_text(); version_js=version_path.read_text(); readme=readme_path.read_text()
assert '2.8.3' in index

# Constants
js=js.replace("  const GROUP_LANE_EXPAND_STEP = 34;\n", "  const GROUP_LANE_EXPAND_STEP = 34;\n  const AXIS_BLOCK_CLEARANCE = 14;\n",1)

# Single group on either side auto-expands enough to reveal all records.
marker="""  function groupLaneHeight(category) {
    return Math.max(GROUP_LANE_HEIGHT, Number(state.expandedGroupHeights.get(category)) || GROUP_LANE_HEIGHT);
  }

  function groupLaneLayout(axisY) {"""
replacement="""  function groupLaneHeight(category) {
    return Math.max(GROUP_LANE_HEIGHT, Number(state.expandedGroupHeights.get(category)) || GROUP_LANE_HEIGHT);
  }

  function singleGroupNaturalHeight(category) {
    const recordCount = state.events.filter(event =>
      event.elementType !== 'Title' &&
      state.enabledCategories.has(event.category) &&
      event.category === category
    ).length;
    // With only one group on a side there is no neighboring group to protect,
    // so remove the preset-height cap. Worst-case one record per packing row
    // guarantees that the group can reveal everything without an overflow cue.
    return Math.max(GROUP_LANE_HEIGHT, 54 + Math.max(1, recordCount) * GROUP_LANE_EXPAND_STEP);
  }

  function groupLaneLayout(axisY) {"""
assert marker in js
js=js.replace(marker,replacement,1)
js=js.replace("      const laneHeight = groupLaneHeight(category);\n      const bottom = primaryCursor;", "      const laneHeight = primary.length === 1 ? Math.max(groupLaneHeight(category), singleGroupNaturalHeight(category)) : groupLaneHeight(category);\n      const bottom = primaryCursor;",1)
js=js.replace("      const laneHeight = groupLaneHeight(category);\n      const top = referenceCursor;", "      const laneHeight = reference.length === 1 ? Math.max(groupLaneHeight(category), singleGroupNaturalHeight(category)) : groupLaneHeight(category);\n      const top = referenceCursor;",1)

# Symmetric block clearance from the axis-facing boundary.
old="""      const labelTop = band
        ? (isAbove
          ? band.bottom - 34 - lane * laneGap
          : band.top + 12 + lane * laneGap)
        : (isAbove ? axisY - 58 - lane * laneGap : axisY + 36 + lane * laneGap);"""
new="""      const labelTop = band
        ? (isAbove
          ? band.bottom - AXIS_BLOCK_CLEARANCE - labelHeight - lane * laneGap
          : band.top + AXIS_BLOCK_CLEARANCE + lane * laneGap)
        : (isAbove ? axisY - 58 - lane * laneGap : axisY + 36 + lane * laneGap);"""
assert old in js
js=js.replace(old,new,1)
js=js.replace("? (band ? band.bottom - 34 - (pointLaneCount - 1) * pointLaneGap : axisY - 58 - (pointLaneCount - 1) * pointLaneGap)", "? (band ? band.bottom - AXIS_BLOCK_CLEARANCE - pointLabelHeight - (pointLaneCount - 1) * pointLaneGap : axisY - 58 - (pointLaneCount - 1) * pointLaneGap)",1)
js=js.replace("? (band ? band.top + 12 + (pointLaneCount - 1) * pointLaneGap + pointLabelHeight : axisY + 36 + (pointLaneCount - 1) * pointLaneGap + pointLabelHeight)", "? (band ? band.top + AXIS_BLOCK_CLEARANCE + (pointLaneCount - 1) * pointLaneGap + pointLabelHeight : axisY + 36 + (pointLaneCount - 1) * pointLaneGap + pointLabelHeight)",1)

# Canonical vertical radar geometry helper.
insert="""  function overviewVerticalGeometry() {
    const viewportHeight = Math.max(1, viewport.getBoundingClientRect().height);
    const contentBands = groupLaneLayout(0);
    let contentMin = -AXIS_STICKY_TOP_INSET;
    let contentMax = AXIS_STICKY_BOTTOM_INSET;
    for (const band of contentBands.values()) {
      contentMin = Math.min(contentMin, band.top);
      contentMax = Math.max(contentMax, band.bottom);
    }
    const contentSpan = Math.max(1, contentMax - contentMin);
    const availableTravel = Math.max(0, contentSpan - viewportHeight);
    const visibleTop = -viewportHeight * state.axisYRatio;
    const clampedVisibleTop = availableTravel > 0
      ? Math.max(contentMin, Math.min(contentMax - viewportHeight, visibleTop))
      : contentMin;
    return { viewportHeight, contentMin, contentMax, contentSpan, availableTravel, visibleTop: clampedVisibleTop };
  }

  function setOverviewVerticalCenterRatio(centerRatio) {
    const geometry = overviewVerticalGeometry();
    if (geometry.availableTravel <= 0) return;
    const lensFraction = Math.min(1, geometry.viewportHeight / geometry.contentSpan);
    const halfLens = lensFraction / 2;
    const clampedCenter = Math.max(halfLens, Math.min(1 - halfLens, centerRatio));
    const topRatio = (clampedCenter - halfLens) / Math.max(0.0001, 1 - lensFraction);
    const visibleTop = geometry.contentMin + topRatio * geometry.availableTravel;
    state.axisYRatio = Math.max(DESKTOP_AXIS_MIN_RATIO, Math.min(DESKTOP_AXIS_MAX_RATIO, -visibleTop / geometry.viewportHeight));
    localStorage.setItem('chrona-axis-y-ratio', String(state.axisYRatio));
  }

"""
assert "  function drawOverview() {" in js
js=js.replace("  function drawOverview() {", insert+"  function drawOverview() {",1)

# Reuse helper in radar rendering.
pat=re.compile(r"      // Radar vertical geometry uses the same world coordinate system as the\n.*?      overviewWindow\.style\.height = `\$\{verticalWindowHeight\}px`;",re.S)
repl="""      // Radar lens is a miniature of the actual vertically scrollable content.
      const vertical = overviewVerticalGeometry();
      const lensFraction = Math.min(1, vertical.viewportHeight / vertical.contentSpan);
      const verticalWindowHeight = Math.max(10, rect.height * lensFraction);
      let verticalTop = 0;
      if (vertical.availableTravel > 0) {
        const scrollRatio = (vertical.visibleTop - vertical.contentMin) / vertical.availableTravel;
        verticalTop = (rect.height - verticalWindowHeight) * scrollRatio;
      }
      overviewWindow.style.top = `${verticalTop}px`;
      overviewWindow.style.bottom = 'auto';
      overviewWindow.style.height = `${verticalWindowHeight}px`;"""
js,count=pat.subn(repl,js,count=1); assert count==1

# 2D radar pointer helpers.
old="""  function overviewRatioFromPointer(event) {
    const rect = overviewTrack.getBoundingClientRect();
    if (isPhoneVerticalMode()) {
      return Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
    }
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
  }
"""
new="""  function overviewRatioFromPointer(event) {
    const rect = overviewTrack.getBoundingClientRect();
    if (isPhoneVerticalMode()) return Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
  }

  function overviewRatiosFromPointer(event) {
    const rect = overviewTrack.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)))
    };
  }

  function moveOverviewWindow2D(xCenterRatio, yCenterRatio) {
    moveOverviewWindowTo(xCenterRatio);
    setOverviewVerticalCenterRatio(yCenterRatio);
    scheduleRender();
  }
"""
assert old in js
js=js.replace(old,new,1)

# State for 2D drag offsets.
js=js.replace("    overviewDragOffsetRatio: 0,\n", "    overviewDragOffsetRatio: 0,\n    overviewDragOffsetYRatio: 0,\n",1)

# Replace desktop pointer down/move with true 2D pan while retaining phone behavior and horizontal edge zoom.
pdown=re.compile(r"  function onOverviewPointerDown\(event\) \{.*?\n  \}\n\n  function onOverviewPointerMove",re.S)
pdown_repl="""  function onOverviewPointerDown(event) {
    if (!overviewTrack.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    const ratios = overviewRatiosFromPointer(event);
    const ratio = overviewRatioFromPointer(event);
    const windowRect = overviewWindow.getBoundingClientRect();
    const trackRect = overviewTrack.getBoundingClientRect();
    const bounds = overviewDataBounds();
    const fullSpan = Math.max(0.0001, bounds.max - bounds.min);
    const windowCenterRatio = (((state.viewStart + state.viewEnd) / 2) - bounds.min) / fullSpan;
    const windowCenterYRatio = ((windowRect.top + windowRect.bottom) / 2 - trackRect.top) / Math.max(1, trackRect.height);
    const verticalPhone = isPhoneVerticalMode();

    overviewTrack.setPointerCapture?.(event.pointerId);
    state.overviewDragging = true;
    state.overviewDragStartRatio = ratio;
    state.overviewDragStartViewStart = state.viewStart;
    state.overviewDragStartViewEnd = state.viewEnd;

    if (verticalPhone) {
      const handleZone = 18;
      if (Math.abs(event.clientY - windowRect.top) <= handleZone) { state.overviewDragMode = 'left'; return; }
      if (Math.abs(event.clientY - windowRect.bottom) <= handleZone) { state.overviewDragMode = 'right'; return; }
      const inside = event.clientY >= windowRect.top && event.clientY <= windowRect.bottom;
      state.overviewDragMode = 'pan';
      state.overviewDragOffsetRatio = inside ? ratio - windowCenterRatio : 0;
      if (!inside) moveOverviewWindowTo(ratio);
      return;
    }

    const handleZone = 14;
    if (Math.abs(event.clientX - windowRect.left) <= handleZone && event.clientY >= windowRect.top && event.clientY <= windowRect.bottom) { state.overviewDragMode = 'left'; return; }
    if (Math.abs(event.clientX - windowRect.right) <= handleZone && event.clientY >= windowRect.top && event.clientY <= windowRect.bottom) { state.overviewDragMode = 'right'; return; }

    const inside = event.clientX >= windowRect.left && event.clientX <= windowRect.right && event.clientY >= windowRect.top && event.clientY <= windowRect.bottom;
    state.overviewDragMode = 'pan2d';
    state.overviewDragOffsetRatio = inside ? ratios.x - windowCenterRatio : 0;
    state.overviewDragOffsetYRatio = inside ? ratios.y - windowCenterYRatio : 0;
    if (!inside) moveOverviewWindow2D(ratios.x, ratios.y);
  }

  function onOverviewPointerMove"""
js,count=pdown.subn(pdown_repl,js,count=1); assert count==1

pmove=re.compile(r"  function onOverviewPointerMove\(event\) \{.*?\n  \}\n\n  function onOverviewPointerUp",re.S)
pmove_repl="""  function onOverviewPointerMove(event) {
    if (!state.overviewDragging) return;
    event.preventDefault();
    const ratios = overviewRatiosFromPointer(event);
    const ratio = overviewRatioFromPointer(event);
    if (state.overviewDragMode === 'pan2d') {
      moveOverviewWindow2D(ratios.x - state.overviewDragOffsetRatio, ratios.y - state.overviewDragOffsetYRatio);
      return;
    }
    if (state.overviewDragMode === 'pan') {
      moveOverviewWindowTo(ratio - state.overviewDragOffsetRatio);
      return;
    }

    const bounds = overviewDataBounds();
    const fullSpan = Math.max(0.0001, bounds.max - bounds.min);
    const start = state.overviewDragStartViewStart;
    const end = state.overviewDragStartViewEnd;
    if (state.overviewDragMode === 'left') {
      const nextStart = Math.min(end - MIN_VISIBLE_YEARS, bounds.min + ratio * fullSpan);
      clampView(nextStart, end);
    } else if (state.overviewDragMode === 'right') {
      const nextEnd = Math.max(start + MIN_VISIBLE_YEARS, bounds.min + ratio * fullSpan);
      clampView(start, nextEnd);
    }
    scheduleRender();
  }

  function onOverviewPointerUp"""
js,count=pmove.subn(pmove_repl,js,count=1); assert count==1
js=js.replace("    state.overviewDragOffsetRatio = 0;\n    overviewTrack.releasePointerCapture?.(event.pointerId);", "    state.overviewDragOffsetRatio = 0;\n    state.overviewDragOffsetYRatio = 0;\n    overviewTrack.releasePointerCapture?.(event.pointerId);",1)

# Cursor labels: one shared gap, no double transform on the year label.
css=css.replace(".year-cursor {\n  position: absolute;", ".year-cursor {\n  --cursor-label-gap: 7px;\n  position: absolute;",1)
css=css.replace("  right: 7px;\n  transform: translateX(-100%);", "  right: var(--cursor-label-gap);\n  transform: none;",1)
css=css.replace(".timeline-viewport:not(.is-phone-vertical) .year-cursor-relative { left: 7px; }", ".timeline-viewport:not(.is-phone-vertical) .year-cursor-relative { left: var(--cursor-label-gap); }",1)

# Radar cursor communicates 2D panning.
styles += "\n/* Chrona v2.8.4 — radar lens is draggable in both axes. */\n.overview-window { cursor: move; }\n.overview-window:active { cursor: grabbing; }\n"

# Version sync
(ROOT/'VERSION').write_text('2.8.4\n')
index=index.replace('2.8.3','2.8.4'); version_js=version_js.replace('2.8.3','2.8.4')
entry="""### 2.8.4

Made a single enabled group on either side of the axis auto-expand without the preset lane-height restriction, added symmetric axis-facing block clearance, corrected the yellow cursor year/relative-label spacing to use one shared gap, and upgraded the desktop/tablet radar lens to true 2D navigation: drag vertically or diagonally to move through timeline groups, click empty radar space to jump in both dimensions, while left/right lens edges continue controlling time zoom.

"""
if '### 2.8.4' not in readme: readme=readme.replace('## Version history\n\n','## Version history\n\n'+entry,1)

js_path.write_text(js); css_path.write_text(css); styles_path.write_text(styles); index_path.write_text(index); version_path.write_text(version_js); readme_path.write_text(readme)
assert 'singleGroupNaturalHeight' in js
assert 'AXIS_BLOCK_CLEARANCE = 14' in js
assert 'overviewDragMode = \'pan2d\'' in js
assert 'moveOverviewWindow2D' in js
assert '--cursor-label-gap: 7px' in css
assert 'transform: none;' in css
assert 'v2.8.4' in index and '?v=2.8.4' in index
print('Chrona 2.8.4 patch applied')
